/**
 * Intelligence Cluster Engine
 *
 * Groups densely-connected events into named IntelligenceClusters.
 * Unlike the map-engine's geographic grid clustering, this engine uses
 * the correlation graph structure (edges) to identify semantic clusters —
 * groups of events that are meaningfully related regardless of distance.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CLUSTERING ALGORITHM: Union-Find
 * ─────────────────────────────────────────────────────────────────────────
 * 1. Treat high-confidence edges (≥ minEdgeConfidence) as "same component"
 *    links using Union-Find / Disjoint Set Union.
 * 2. Each connected component becomes a candidate cluster.
 * 3. Components with < minClusterSize events are discarded.
 * 4. Each cluster is assigned a title, summary, and centroid.
 *
 * This produces semantic clusters (earthquake + disaster + economic news
 * all in Japan) rather than purely geographic ones.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CLUSTER TITLING
 * ─────────────────────────────────────────────────────────────────────────
 * Title follows the pattern: "{Country/Region} {DominantCategory} {Qualifier}"
 * Examples:
 *   "Japan Earthquake Crisis"
 *   "Ukraine Military Conflict"
 *   "West Africa Climate Emergency"
 *   "Global Cyber Intelligence Alert"
 */
import type { GlobalEvent, GlobalEventCategory, GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { hasCoordinates } from "@/domain/utils/geo";
import type { CorrelationEdge } from "../correlation/types";
import type { IntelligenceCluster } from "../graph/types";

// ─── Configuration ────────────────────────────────────────────────────────────

const MIN_CLUSTER_SIZE = 2;
const MIN_EDGE_CONFIDENCE = 50; // edges below this don't form cluster bonds

// ─── Union-Find ───────────────────────────────────────────────────────────────

class UnionFind {
  private parent: Map<string, string> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      this.parent.set(x, this.find(p)); // path compression
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const px = this.find(x);
    const py = this.find(y);
    if (px !== py) this.parent.set(px, py);
  }
}

// ─── Severity utilities ───────────────────────────────────────────────────────

const SEVERITY_ORDER: GlobalEventSeverity[] = ["critical", "high", "medium", "low"];

function highestSeverity(events: GlobalEvent[]): GlobalEventSeverity {
  for (const s of SEVERITY_ORDER) {
    if (events.some((e) => e.severity === s)) return s;
  }
  return "low";
}

// ─── Centroid calculation ─────────────────────────────────────────────────────

function centroid(events: GlobalEvent[]): { lat: number; lng: number } | null {
  const withCoords = events.filter((e) => hasCoordinates(e.coordinates));
  if (!withCoords.length) return null;
  const sumLat = withCoords.reduce((s, e) => s + e.coordinates!.lat, 0);
  const sumLng = withCoords.reduce((s, e) => s + e.coordinates!.lng, 0);
  return { lat: sumLat / withCoords.length, lng: sumLng / withCoords.length };
}

// ─── Cluster titling ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Partial<Record<GlobalEventCategory, string>> = {
  earthquake: "Earthquake",
  military: "Military Conflict",
  disaster: "Disaster",
  climate: "Climate Crisis",
  geopolitics: "Political Crisis",
  economy: "Economic Instability",
  cyber: "Cyber Incident",
  health: "Health Emergency",
  energy: "Energy Crisis",
  weather: "Severe Weather",
  technology: "Technology Incident",
  general: "Intelligence",
};

const SEVERITY_QUALIFIER: Record<GlobalEventSeverity, string> = {
  critical: "Emergency",
  high: "Crisis",
  medium: "Alert",
  low: "Situation",
};

function dominantCategory(events: GlobalEvent[]): GlobalEventCategory {
  const counts = new Map<GlobalEventCategory, number>();
  for (const e of events) {
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }
  let best: GlobalEventCategory = "general";
  let bestCount = 0;
  for (const [cat, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = cat;
    }
  }
  return best;
}

function uniqueCountries(events: GlobalEvent[]): string[] {
  return [...new Set(events.map((e) => e.country).filter((c): c is string => !!c))];
}

function buildClusterTitle(events: GlobalEvent[]): { title: string; summary: string } {
  const countries = uniqueCountries(events);
  const severity = highestSeverity(events);
  const catLabel = CATEGORY_LABELS[dominantCategory(events)] ?? "Intelligence";
  const qualifier = SEVERITY_QUALIFIER[severity];

  const locationStr =
    countries.length === 0 ? "Global" :
    countries.length === 1 ? countries[0] :
    countries.length <= 3 ? countries.join(" / ") :
    `${countries[0]} + ${countries.length - 1} more`;

  const title = `${locationStr} ${catLabel} ${qualifier}`;

  const catCounts = new Map<GlobalEventCategory, number>();
  for (const e of events) catCounts.set(e.category, (catCounts.get(e.category) ?? 0) + 1);
  const topCats = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([c]) => CATEGORY_LABELS[c] ?? c)
    .join(" and ");

  const summary = `${events.length} correlated events involving ${topCats} in ${locationStr}.`;

  return { title, summary };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ClusterResult {
  clusters: IntelligenceCluster[];
  /** Map from event ID → cluster IDs it belongs to. */
  membership: Map<string, string[]>;
}

/**
 * Group correlated events into IntelligenceClusters using Union-Find.
 *
 * @param events  All events (used to build cluster membership)
 * @param edges   All correlation edges (determines cluster bonds)
 */
export function buildClusters(
  events: GlobalEvent[],
  edges: CorrelationEdge[],
): ClusterResult {
  const uf = new UnionFind();
  const eventById = new Map(events.map((e) => [e.id, e]));

  // Build union-find structure from high-confidence edges
  for (const edge of edges) {
    if (edge.confidence >= MIN_EDGE_CONFIDENCE) {
      uf.union(edge.sourceId, edge.targetId);
    }
  }

  // Group event IDs by their root
  const components = new Map<string, string[]>();
  for (const event of events) {
    const root = uf.find(event.id);
    const arr = components.get(root) ?? [];
    arr.push(event.id);
    components.set(root, arr);
  }

  const clusters: IntelligenceCluster[] = [];
  const membership = new Map<string, string[]>();

  let clusterIndex = 0;
  for (const [, memberIds] of components) {
    if (memberIds.length < MIN_CLUSTER_SIZE) continue;

    const clusterEvents = memberIds
      .map((id) => eventById.get(id))
      .filter((e): e is GlobalEvent => !!e);

    const timestamps = clusterEvents.map((e) => new Date(e.timestamp).getTime());
    const startMs = Math.min(...timestamps);
    const endMs = Math.max(...timestamps);

    const riskScore = Math.max(...clusterEvents.map((e) => e.riskScore));
    const avgRiskScore = Math.round(
      clusterEvents.reduce((s, e) => s + e.riskScore, 0) / clusterEvents.length,
    );

    const internalEdges = edges.filter(
      (e) => memberIds.includes(e.sourceId) && memberIds.includes(e.targetId),
    );

    const { title, summary } = buildClusterTitle(clusterEvents);
    const clusterId = `cluster-${clusterIndex++}-${Math.abs(startMs) % 100000}`;

    const cluster: IntelligenceCluster = {
      id: clusterId,
      title,
      summary,
      events: clusterEvents.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
      countries: uniqueCountries(clusterEvents),
      categories: [...new Set(clusterEvents.map((e) => e.category))],
      highestSeverity: highestSeverity(clusterEvents),
      riskScore,
      avgRiskScore,
      internalEdges,
      timeRange: {
        startMs,
        endMs,
        startIso: new Date(startMs).toISOString(),
        endIso: new Date(endMs).toISOString(),
      },
      centerCoordinates: centroid(clusterEvents),
      size: clusterEvents.length,
    };

    clusters.push(cluster);

    for (const id of memberIds) {
      const current = membership.get(id) ?? [];
      current.push(clusterId);
      membership.set(id, current);
    }
  }

  // Sort clusters by risk score descending
  clusters.sort((a, b) => b.riskScore - a.riskScore);

  return { clusters, membership };
}
