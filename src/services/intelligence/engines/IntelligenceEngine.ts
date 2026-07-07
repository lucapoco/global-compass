/**
 * Intelligence Engine — central orchestrator.
 *
 * Input:  IntelligenceItem[] (from newsApi.ts) + Earthquake[] + SavedAlert[]
 * Output: ProcessedIntelligence (events, countryRisks, globalRisk)
 *
 * Pipeline:
 *   1. Normalize  — raw IntelligenceItem → IntelligenceEvent draft
 *   2. Enrich     — entity extraction, multi-category detection, coordinates
 *   3. Score      — importance + confidence
 *   4. Cluster    — merge similar articles
 *   5. Correlate  — find related events within the pool
 *   6. Risk       — compute country risk + global risk index
 *   7. Sort       — by importance desc
 */
import type { IntelligenceItem } from "@/types";
import type { Earthquake, SavedAlert } from "@/types";
import type { IntelligenceEvent, ProcessedIntelligence, IntelligenceFilter, TimeRange } from "../types";

import { detectCategories }        from "../nlp/categoryEngine";
import { extractEntities, extractKeywords, detectPrimaryCountry } from "../nlp/entityExtractor";
import { COUNTRY_COORDS, COUNTRY_REGIONS }  from "../nlp/dictionaries";
import { classifyEventSeverity }   from "../ranking/severityEngine";
import { computeImportance, computeConfidence, byImportanceDesc } from "../ranking/importanceScore";
import { clusterItems, buildClusterSources, countClustered } from "../clustering/eventClusterer";
import { buildCountryRiskV2 }      from "../risk/countryRisk";
import { computeGlobalRisk }       from "../risk/globalRisk";

// ─── Stable ID generation ─────────────────────────────────────────────────────
function stableId(item: IntelligenceItem): string {
  if (item.url) {
    // Use URL hash as stable ID
    let hash = 0;
    for (let i = 0; i < item.url.length; i++) {
      hash = ((hash << 5) - hash + item.url.charCodeAt(i)) | 0;
    }
    return `ie-${Math.abs(hash).toString(36)}`;
  }
  return `ie-${item.id}`;
}

// ─── Normalization ────────────────────────────────────────────────────────────
function normalizeItem(item: IntelligenceItem): Omit<IntelligenceEvent, "relatedEventIds"> {
  const text = `${item.title} ${item.description ?? ""}`;

  // NLP
  const { category, categories, confidence: catConf } = detectCategories(text);
  const entities = extractEntities(text);
  const keywords = extractKeywords(text);

  // Primary country: from item.country (already extracted) or from NLP
  const country = item.country ?? detectPrimaryCountry(text);
  const region = country ? COUNTRY_REGIONS[country] : undefined;
  const coords = country ? COUNTRY_COORDS[country] : undefined;

  // Severity
  const severity = classifyEventSeverity(text);

  // Summary: use description if available, else trim title
  const summary = item.description?.trim() || item.title;

  // Scores
  const articleCount = 1;
  const importance = computeImportance({
    severity,
    category,
    categories,
    country,
    publishedAt: item.publishedAt,
    articleCount,
    isLive: item.isLive,
    confidence: catConf,
  });
  const confidence = computeConfidence({
    isLive: item.isLive,
    articleCount,
    categoryConfidence: catConf,
    hasUrl: Boolean(item.url),
    hasImage: Boolean(item.imageUrl),
  });

  return {
    id: stableId(item),
    title: item.title,
    summary,
    country,
    region,
    coordinates: coords ? { lat: coords[0], lng: coords[1] } : undefined,
    category,
    categories,
    severity,
    importance,
    confidence,
    publishedAt: item.publishedAt,
    source: item.source,
    url: item.url,
    imageUrl: item.imageUrl,
    keywords,
    entities,
    clusterSources: [],
    articleCount,
    isLive: item.isLive,
    isDemo: item.isLive === false,
  };
}

// ─── Correlation ──────────────────────────────────────────────────────────────
/**
 * For each event, find the IDs of related events based on:
 *   - Same country (within 48 h)
 *   - Same category (within 24 h)
 *   - Shared keywords (≥ 2 common)
 */
function correlateEvents(events: IntelligenceEvent[]): IntelligenceEvent[] {
  const MAX_RELATED = 5;

  return events.map((ev) => {
    const evTime = new Date(ev.publishedAt).getTime();
    const related: Array<{ id: string; score: number }> = [];

    for (const other of events) {
      if (other.id === ev.id) continue;
      let score = 0;
      const otherTime = new Date(other.publishedAt).getTime();
      const ageDiffMs = Math.abs(evTime - otherTime);
      const ageDiffH = ageDiffMs / (1000 * 60 * 60);

      // Country match within 48 h
      if (ev.country && other.country === ev.country && ageDiffH <= 48) score += 3;

      // Category match within 24 h
      if (other.category === ev.category && ageDiffH <= 24) score += 2;

      // Keyword overlap (≥ 2 shared keywords)
      const sharedKw = ev.keywords.filter((k) => other.keywords.includes(k)).length;
      if (sharedKw >= 2) score += sharedKw;

      if (score >= 3) related.push({ id: other.id, score });
    }

    const relatedEventIds = related
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RELATED)
      .map((r) => r.id);

    return { ...ev, relatedEventIds };
  });
}

// ─── Time range filter ────────────────────────────────────────────────────────
function withinTimeRange(publishedAt: string, range: TimeRange): boolean {
  if (range === "all") return true;
  const ms = { "1h": 3.6e6, "6h": 2.16e7, "24h": 8.64e7, "48h": 1.728e8, "7d": 6.048e8 };
  return Date.now() - new Date(publishedAt).getTime() <= (ms[range] ?? Infinity);
}

// ─── Filter ───────────────────────────────────────────────────────────────────
export function applyIntelligenceFilter(
  events: IntelligenceEvent[],
  filter: IntelligenceFilter,
): IntelligenceEvent[] {
  const q = filter.query.trim().toLowerCase();
  return events.filter((ev) => {
    if (filter.categories.length && !filter.categories.includes(ev.category)) return false;
    if (filter.severities.length && !filter.severities.includes(ev.severity)) return false;
    if (filter.countries.length && !filter.countries.includes(ev.country ?? "")) return false;
    if (filter.sources.length && !filter.sources.includes(ev.source)) return false;
    if (ev.importance < filter.minImportance) return false;
    if (filter.liveOnly && !ev.isLive) return false;
    if (!withinTimeRange(ev.publishedAt, filter.timeRange)) return false;
    if (q) {
      const blob = [ev.title, ev.summary, ev.country, ev.category, ev.source,
        ...ev.keywords, ...ev.entities.countries, ...ev.entities.leaders,
        ...ev.entities.organizations].filter(Boolean).join(" ").toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

// ─── Sort ─────────────────────────────────────────────────────────────────────
export function sortEvents(events: IntelligenceEvent[], mode: "newest" | "importance" | "severity" | "country" | "source"): IntelligenceEvent[] {
  const copy = [...events];
  switch (mode) {
    case "importance": return copy.sort(byImportanceDesc);
    case "severity": return copy.sort((a, b) => {
      const sd = (["critical","high","medium","low"].indexOf(a.severity)) - (["critical","high","medium","low"].indexOf(b.severity));
      return sd !== 0 ? sd : byImportanceDesc(a, b);
    });
    case "country": return copy.sort((a, b) => (a.country ?? "").localeCompare(b.country ?? "") || byImportanceDesc(a, b));
    case "source":  return copy.sort((a, b) => a.source.localeCompare(b.source) || byImportanceDesc(a, b));
    default: // "newest"
      return copy.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export interface IntelligenceEngineInput {
  items: IntelligenceItem[];
  quakes?: Earthquake[];
  savedAlerts?: SavedAlert[];
  previousRisk?: ProcessedIntelligence;
}

/**
 * Run the full intelligence processing pipeline.
 * Pure function — no side effects, no network calls.
 */
export function runIntelligenceEngine(input: IntelligenceEngineInput): ProcessedIntelligence {
  const { items, quakes = [], savedAlerts = [], previousRisk } = input;

  const totalArticles = items.length;

  // Step 1: cluster similar articles first (before normalization for efficiency)
  const clusters = clusterItems(items);
  const totalClustered = countClustered(clusters);

  // Step 2: normalize + enrich each cluster's primary article
  const drafts: IntelligenceEvent[] = clusters.map((cluster) => {
    const draft = normalizeItem(cluster.primary) as IntelligenceEvent;
    const extraSources = buildClusterSources(cluster);
    const articleCount = cluster.members.length;

    // Re-score with correct article count
    const importance = computeImportance({
      severity: draft.severity,
      category: draft.category,
      categories: draft.categories,
      country: draft.country,
      publishedAt: draft.publishedAt,
      articleCount,
      isLive: draft.isLive,
      confidence: draft.confidence,
    });

    return {
      ...draft,
      relatedEventIds: [],
      clusterSources: extraSources,
      articleCount,
      importance,
    };
  });

  // Step 3: correlate events (fill in relatedEventIds)
  const events = correlateEvents(drafts);

  // Step 4: sort by importance
  const sorted = sortEvents(events, "importance");

  // Step 5: compute risk indices
  const previousScores = previousRisk
    ? new Map(previousRisk.countryRisks.map((r) => [r.country, r.score]))
    : undefined;

  const countryRisks = buildCountryRiskV2({ events: sorted, quakes, savedAlerts, previousScores });

  const globalRisk = computeGlobalRisk({
    events: sorted,
    quakes,
    previous: previousRisk?.globalRisk,
  });

  return {
    events: sorted,
    countryRisks,
    globalRisk,
    processedAt: new Date().toISOString(),
    totalClustered,
    totalArticles,
  };
}
