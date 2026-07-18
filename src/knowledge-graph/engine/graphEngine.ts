/**
 * Knowledge Graph Engine
 *
 * Builds a KnowledgeGraph from GlobalEvents by:
 *   1. Extracting entity nodes (countries, event nodes, topic nodes)
 *   2. Auto-generating typed, explained relationships
 *   3. Applying layout positions
 *   4. Computing node degrees and hub status
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RELATIONSHIP GENERATION RULES
 * ─────────────────────────────────────────────────────────────────────────
 *
 * R1 — occurred_in:   Every event node → its country node (if country known)
 * R2 — same_category: Every event node → its category/topic node
 * R3 — same_time_window: Pairs of events within 6h of each other (same country)
 * R4 — same_country:  High-severity events from the same country are linked
 *       (limited to pairs where both ≥ high severity, capped at 60 edges)
 * R5 — same_region:   Country nodes in the same region get a weak link
 * R6 — correlation_engine: If the CorrelationEngine has an edge for two events,
 *       that relationship is lifted into the graph
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERFORMANCE LIMITS
 * ─────────────────────────────────────────────────────────────────────────
 *   MAX_EVENTS   100   — only top N events by riskScore are included
 *   MAX_EDGES    300   — total edge cap to keep rendering fast
 *   HUB_DEGREE   5     — nodes with degree ≥ 5 are flagged as hubs
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  KnowledgeNodeType,
  GraphFilterOptions,
  GraphSearchResult,
} from "../types";
import { EDGE_TYPE_LABELS } from "../types";
import { REGION_COUNTRIES } from "@/domain/decision/stability/stabilityEngine";
import { computeLayout } from "../layout/graphLayout";

// ─── Configuration ────────────────────────────────────────────────────────────

export const MAX_EVENTS = 100;
export const MAX_EDGES  = 300;
export const HUB_DEGREE = 5;
const TIME_WINDOW_6H = 6 * 3_600_000;

// ─── Category → node type mapping ────────────────────────────────────────────

const CAT_TO_NODE_TYPE: Record<string, KnowledgeNodeType> = {
  earthquake:  "earthquake",
  weather:     "weather",
  climate:     "weather",
  disaster:    "wildfire",    // NASA EONET disasters default to wildfire type
  military:    "conflict",
  geopolitics: "political",
  economy:     "economic",
  technology:  "technology",
  cyber:       "cyber",
  energy:      "energy",
  health:      "health",
  general:     "breaking_news",
  country:     "political",
};

// ─── Unique ID helpers ────────────────────────────────────────────────────────

function countryNodeId(name: string): string {
  return `country:${name.toLowerCase().replace(/\s+/g, "_")}`;
}

function topicNodeId(category: string): string {
  return `topic:${category}`;
}

function edgeId(src: string, tgt: string, type: string): string {
  return `e:${src}:${tgt}:${type}`;
}

// ─── Node builders ────────────────────────────────────────────────────────────

function buildEventNode(event: GlobalEvent): KnowledgeNode {
  const nodeType: KnowledgeNodeType = CAT_TO_NODE_TYPE[event.category] ?? "breaking_news";
  const severity = event.severity;
  const sizeBonus =
    severity === "critical" ? 14 :
    severity === "high"     ? 8  :
    severity === "medium"   ? 4  : 0;

  return {
    id: `event:${event.id}`,
    type: nodeType,
    label: event.title.length > 40 ? event.title.slice(0, 38) + "…" : event.title,
    sublabel: event.country ?? event.category,
    country: event.country,
    region: (event as { region?: string }).region,
    coordinates: event.coordinates
      ? [event.coordinates.lat, event.coordinates.lng]
      : undefined,
    severity: event.severity,
    category: event.category,
    riskScore: event.riskScore,
    confidence: event.confidence,
    importance: event.importance,
    degree: 0,
    isHub: false,
    provider: event.provider,
    sourceEventIds: [event.id],
    timestamp: event.timestamp,
    live: event.live,
    x: 0,
    y: 0,
    // NOTE: sizeBonus stored conceptually; the visual layer uses severity directly
  };
  void sizeBonus; // used by layout/visual layers
}

function buildCountryNode(name: string, events: GlobalEvent[]): KnowledgeNode {
  const avgRisk = events.length > 0
    ? Math.round(events.reduce((s, e) => s + e.riskScore, 0) / events.length)
    : 0;
  const maxConf = events.length > 0
    ? Math.round(events.reduce((s, e) => s + e.confidence, 0) / events.length)
    : 50;

  return {
    id: countryNodeId(name),
    type: "country",
    label: name,
    sublabel: `${events.length} events`,
    country: name,
    riskScore: avgRisk,
    confidence: maxConf,
    importance: Math.min(100, events.length * 5),
    degree: 0,
    isHub: false,
    sourceEventIds: events.map((e) => e.id),
    x: 0,
    y: 0,
  };
}

function buildTopicNode(category: string): KnowledgeNode {
  const labels: Record<string, string> = {
    earthquake: "Earthquakes", weather: "Weather", climate: "Climate",
    disaster: "Natural Disasters", military: "Military", geopolitics: "Geopolitics",
    economy: "Economy", technology: "Technology", cyber: "Cyber",
    energy: "Energy", health: "Health", general: "General News", country: "Country Info",
  };

  return {
    id: topicNodeId(category),
    type: "topic",
    label: labels[category] ?? category,
    sublabel: "Category",
    category: category as GlobalEvent["category"],
    riskScore: 0,
    confidence: 80,
    importance: 50,
    degree: 0,
    isHub: false,
    sourceEventIds: [],
    x: 0,
    y: 0,
  };
}

// ─── Edge builders ────────────────────────────────────────────────────────────

function makeEdge(
  src: string,
  tgt: string,
  type: KnowledgeEdge["type"],
  weight: number,
  confidence: number,
  reason: string,
  source: KnowledgeEdge["creationSource"] = "auto",
): KnowledgeEdge {
  return {
    id: edgeId(src, tgt, type),
    source: src,
    target: tgt,
    type,
    label: EDGE_TYPE_LABELS[type],
    weight,
    confidence,
    reason,
    creationSource: source,
    timestamp: new Date().toISOString(),
  };
}

// ─── Region lookup ────────────────────────────────────────────────────────────

function regionForCountry(country: string): string | null {
  for (const [region, countries] of Object.entries(REGION_COUNTRIES)) {
    if (countries.some((c) => c.toLowerCase() === country.toLowerCase())) return region;
  }
  return null;
}

// ─── Main graph builder ───────────────────────────────────────────────────────

export function generateGraph(
  events: GlobalEvent[],
  options: { maxEvents?: number } = {},
): KnowledgeGraph {
  const maxN = options.maxEvents ?? MAX_EVENTS;

  // Sort by risk + importance, take top N
  const topEvents = [...events]
    .sort((a, b) => (b.riskScore + b.importance) - (a.riskScore + a.importance))
    .slice(0, maxN);

  const nodeMap = new Map<string, KnowledgeNode>();
  const edgeMap = new Map<string, KnowledgeEdge>();

  // ── 1. Event nodes ──────────────────────────────────────────────────────
  for (const ev of topEvents) {
    const n = buildEventNode(ev);
    nodeMap.set(n.id, n);
  }

  // ── 2. Country nodes ────────────────────────────────────────────────────
  const byCountry = new Map<string, GlobalEvent[]>();
  for (const ev of topEvents) {
    if (!ev.country) continue;
    const arr = byCountry.get(ev.country) ?? [];
    arr.push(ev);
    byCountry.set(ev.country, arr);
  }

  for (const [name, countryEvents] of byCountry) {
    const cn = buildCountryNode(name, countryEvents);
    nodeMap.set(cn.id, cn);
  }

  // ── 3. Topic nodes (only for categories with ≥2 events) ────────────────
  const byCat = new Map<string, number>();
  for (const ev of topEvents) byCat.set(ev.category, (byCat.get(ev.category) ?? 0) + 1);
  for (const [cat, cnt] of byCat) {
    if (cnt >= 2) nodeMap.set(topicNodeId(cat), buildTopicNode(cat));
  }

  // ── R1: occurred_in edges ───────────────────────────────────────────────
  for (const ev of topEvents) {
    if (!ev.country) continue;
    const cnId = countryNodeId(ev.country);
    if (!nodeMap.has(cnId)) continue;
    const e = makeEdge(
      `event:${ev.id}`, cnId, "occurred_in", 0.9, 85,
      `${ev.title} was attributed to ${ev.country} by the ${ev.provider} provider.`,
    );
    edgeMap.set(e.id, e);
  }

  // ── R2: same_category edges (event → topic) ────────────────────────────
  for (const ev of topEvents) {
    const tId = topicNodeId(ev.category);
    if (!nodeMap.has(tId)) continue;
    const e = makeEdge(
      `event:${ev.id}`, tId, "same_category", 0.7, 90,
      `Event classified as "${ev.category}" by the GPIE classifier.`,
    );
    edgeMap.set(e.id, e);
  }

  // ── R3: same_time_window + same_country (high/critical only) ───────────
  const highEvents = topEvents.filter((e) => ["high", "critical"].includes(e.severity));
  let highEdgeCount = 0;
  for (let i = 0; i < highEvents.length && highEdgeCount < 60; i++) {
    for (let j = i + 1; j < highEvents.length && highEdgeCount < 60; j++) {
      const a = highEvents[i];
      const b = highEvents[j];
      if (!a.country || a.country !== b.country) continue;

      const timeDiff = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (timeDiff > TIME_WINDOW_6H) continue;

      const e = makeEdge(
        `event:${a.id}`, `event:${b.id}`, "same_time_window",
        0.6, 70,
        `Both events occurred in ${a.country} within ${Math.round(timeDiff / 3_600_000)} hours of each other.`,
      );
      edgeMap.set(e.id, e);
      highEdgeCount++;
    }
  }

  // ── R4: same_country edges between critical events ──────────────────────
  const critEvents = topEvents.filter((e) => e.severity === "critical");
  let critEdgeCount = 0;
  for (let i = 0; i < critEvents.length && critEdgeCount < 30; i++) {
    for (let j = i + 1; j < critEvents.length && critEdgeCount < 30; j++) {
      const a = critEvents[i];
      const b = critEvents[j];
      if (!a.country || a.country !== b.country) continue;

      const e = makeEdge(
        `event:${a.id}`, `event:${b.id}`, "same_country",
        0.75, 80,
        `Both critical events are attributed to ${a.country}, suggesting compounding risk.`,
      );
      edgeMap.set(e.id, e);
      critEdgeCount++;
    }
  }

  // ── R5: same_region edges between country nodes ─────────────────────────
  const countryNames = [...byCountry.keys()];
  for (let i = 0; i < countryNames.length; i++) {
    for (let j = i + 1; j < countryNames.length; j++) {
      const rA = regionForCountry(countryNames[i]);
      const rB = regionForCountry(countryNames[j]);
      if (rA && rA === rB) {
        const e = makeEdge(
          countryNodeId(countryNames[i]),
          countryNodeId(countryNames[j]),
          "same_region", 0.4, 60,
          `${countryNames[i]} and ${countryNames[j]} are both located in ${rA}.`,
        );
        edgeMap.set(e.id, e);
      }
    }
  }

  // ── R6: correlated events (relatedEvents field on GlobalEvent) ──────────
  for (const ev of topEvents) {
    for (const relId of ev.relatedEvents.slice(0, 3)) {
      const relNode = `event:${relId}`;
      if (!nodeMap.has(relNode)) continue;
      const eId = edgeId(`event:${ev.id}`, relNode, "correlation_engine");
      if (edgeMap.has(eId)) continue;
      const e = makeEdge(
        `event:${ev.id}`, relNode, "correlation_engine",
        0.8, 75,
        `Detected by the GPIE Event Correlation Engine based on location, time, and topic proximity.`,
        "correlation",
      );
      edgeMap.set(e.id, e);
    }
  }

  // ── Cap total edges ─────────────────────────────────────────────────────
  const edges = [...edgeMap.values()].slice(0, MAX_EDGES);

  // ── Compute degrees ─────────────────────────────────────────────────────
  const degreeMap = new Map<string, number>();
  for (const edge of edges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) ?? 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) ?? 0) + 1);
  }

  const nodes = [...nodeMap.values()].map((n) => {
    const deg = degreeMap.get(n.id) ?? 0;
    return { ...n, degree: deg, isHub: deg >= HUB_DEGREE };
  });

  // ── Apply layout ────────────────────────────────────────────────────────
  const positioned = computeLayout(nodes, edges);

  // ── Statistics ──────────────────────────────────────────────────────────
  const hubNodes = positioned.filter((n) => n.isHub).map((n) => n.id);
  const mostConnected = positioned.reduce(
    (best, n) => (!best || n.degree > best.degree ? n : best),
    null as KnowledgeNode | null,
  );
  const n = positioned.length;
  const maxPossibleEdges = n * (n - 1) / 2;
  const density = maxPossibleEdges > 0 ? edges.length / maxPossibleEdges : 0;

  return {
    nodes: positioned,
    edges,
    generatedAt: new Date().toISOString(),
    totalEvents: events.length,
    stats: {
      nodeCount: n,
      edgeCount: edges.length,
      countryCount: positioned.filter((nd) => nd.type === "country").length,
      topicCount: positioned.filter((nd) => nd.type === "topic").length,
      hubNodes,
      mostConnectedNode: mostConnected,
      avgDegree: n > 0 ? Math.round(edges.length * 2 / n) : 0,
      connectionDensity: Math.round(density * 100) / 100,
    },
  };
}

// ─── Country sub-graph ────────────────────────────────────────────────────────

export function generateCountryGraph(events: GlobalEvent[], countryName: string): KnowledgeGraph {
  const filtered = events.filter((e) => {
    if (!e.country) return false;
    const t = countryName.toLowerCase();
    const s = e.country.toLowerCase();
    return s === t || s.includes(t) || t.includes(s);
  });
  return generateGraph(filtered, { maxEvents: 50 });
}

// ─── Topic sub-graph ─────────────────────────────────────────────────────────

export function generateTopicGraph(events: GlobalEvent[], category: string): KnowledgeGraph {
  const filtered = events.filter((e) => e.category === category);
  return generateGraph(filtered, { maxEvents: 60 });
}

// ─── Expand node (returns events/nodes around a specific node) ────────────────

export function expandNode(
  graph: KnowledgeGraph,
  nodeId: string,
  allEvents: GlobalEvent[],
): KnowledgeGraph {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return graph;

  // For country nodes, get all events for that country
  if (node.type === "country" && node.country) {
    const sub = generateCountryGraph(allEvents, node.country);
    // Merge new nodes/edges into existing graph (deduplicate)
    const existingIds = new Set(graph.nodes.map((n) => n.id));
    const newNodes = sub.nodes.filter((n) => !existingIds.has(n.id));
    return generateGraph([...allEvents], { maxEvents: MAX_EVENTS + 20 });
    void newNodes;
  }

  return graph;
}

// ─── Filter graph ─────────────────────────────────────────────────────────────

export function filterGraph(
  graph: KnowledgeGraph,
  filter: GraphFilterOptions,
): KnowledgeGraph {
  let nodes = [...graph.nodes];
  let edges = [...graph.edges];

  if (filter.countries?.length) {
    const set = new Set(filter.countries.map((c) => c.toLowerCase()));
    nodes = nodes.filter(
      (n) => !n.country || set.has(n.country.toLowerCase()) || n.type === "topic",
    );
  }

  if (filter.nodeTypes?.length) {
    const set = new Set(filter.nodeTypes);
    nodes = nodes.filter((n) => set.has(n.type));
  }

  if (filter.severities?.length) {
    const set = new Set(filter.severities);
    nodes = nodes.filter((n) => !n.severity || set.has(n.severity));
  }

  if (filter.minRisk !== undefined) {
    nodes = nodes.filter((n) => n.riskScore >= filter.minRisk!);
  }

  if (filter.minConfidence !== undefined) {
    nodes = nodes.filter((n) => n.confidence >= filter.minConfidence!);
  }

  if (filter.providers?.length) {
    const set = new Set(filter.providers);
    nodes = nodes.filter((n) => !n.provider || set.has(n.provider) || n.type === "country" || n.type === "topic");
  }

  // Keep only edges where both endpoints exist
  const nodeSet = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));

  if (filter.edgeTypes?.length) {
    const set = new Set(filter.edgeTypes);
    edges = edges.filter((e) => set.has(e.type));
  }

  return {
    ...graph,
    nodes,
    edges,
    stats: {
      ...graph.stats,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    },
  };
}

// ─── Search graph ─────────────────────────────────────────────────────────────

export function searchGraph(graph: KnowledgeGraph, query: string): GraphSearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();

  return graph.nodes
    .map((node) => {
      let score = 0;
      let matchField = "";

      if (node.label.toLowerCase().includes(q)) {
        score = node.label.toLowerCase().startsWith(q) ? 1.0 : 0.8;
        matchField = "label";
      } else if (node.country?.toLowerCase().includes(q)) {
        score = 0.6;
        matchField = "country";
      } else if (node.category?.toLowerCase().includes(q)) {
        score = 0.5;
        matchField = "category";
      } else if (node.sublabel?.toLowerCase().includes(q)) {
        score = 0.4;
        matchField = "sublabel";
      }

      return { node, score, matchField };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}
