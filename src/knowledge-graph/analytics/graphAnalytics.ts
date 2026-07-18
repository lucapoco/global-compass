/**
 * Graph Analytics
 *
 * Derives intelligence insights from the KnowledgeGraph topology:
 *   • Most connected node (hub detection)
 *   • Highest-risk cluster
 *   • Most active region
 *   • Emerging topics
 *   • Relationship distribution
 *   • Intelligence cluster groups (Union-Find based)
 */
import type {
  KnowledgeGraph,
  KnowledgeNode,
  GraphCluster,
  GraphAnalyticsResult,
  KnowledgeEdgeType,
} from "../types";
import type { GlobalEventCategory } from "@/domain/models/GlobalEvent";
import { REGION_COUNTRIES } from "@/domain/decision/stability/stabilityEngine";

// ─── Union-Find for clustering ────────────────────────────────────────────────

class UnionFind {
  private parent: Map<string, string>;
  constructor(ids: string[]) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }
  find(id: string): string {
    let root = this.parent.get(id) ?? id;
    while (root !== this.parent.get(root)) {
      const gp = this.parent.get(root) ?? root;
      this.parent.set(root, gp);
      root = gp;
    }
    this.parent.set(id, root);
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

// ─── Build clusters ───────────────────────────────────────────────────────────

function buildClusters(graph: KnowledgeGraph): GraphCluster[] {
  const nodeIds = graph.nodes
    .filter((n) => n.type !== "topic") // topics are connectors, not cluster members
    .map((n) => n.id);
  const uf = new UnionFind(nodeIds);

  // Connect nodes sharing strong edges (weight > 0.5)
  for (const edge of graph.edges) {
    if (edge.weight > 0.5) uf.union(edge.source, edge.target);
  }

  // Group by root
  const groups = new Map<string, string[]>();
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const id of nodeIds) {
    const root = uf.find(id);
    const arr = groups.get(root) ?? [];
    arr.push(id);
    groups.set(root, arr);
  }

  const clusters: GraphCluster[] = [];
  let cIdx = 0;
  for (const [, memberIds] of groups) {
    if (memberIds.length < 2) continue;

    const members = memberIds.map((id) => nodeById.get(id)).filter(Boolean) as KnowledgeNode[];
    const countries = [...new Set(members.map((n) => n.country).filter(Boolean) as string[])];
    const cats = [...new Set(members.map((n) => n.category).filter(Boolean) as GlobalEventCategory[])];

    // Dominant topic: most common category
    const catCounts = new Map<string, number>();
    for (const n of members) if (n.category) catCounts.set(n.category, (catCounts.get(n.category) ?? 0) + 1);
    const dominantTopic = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";

    const avgRisk = Math.round(members.reduce((s, n) => s + n.riskScore, 0) / members.length);
    const avgConf = Math.round(members.reduce((s, n) => s + n.confidence, 0) / members.length);

    // Title heuristic
    const title = countries.length > 0
      ? `${countries.slice(0, 2).join(" / ")} ${dominantTopic} cluster`
      : `${dominantTopic} event cluster`;

    clusters.push({
      id: `cluster-${cIdx++}`,
      title,
      nodeIds: memberIds,
      countries,
      categories: cats,
      dominantTopic,
      riskLevel: avgRisk,
      confidence: avgConf,
      supportingEventCount: members.filter((n) => n.sourceEventIds.length > 0).length,
    });
  }

  return clusters.sort((a, b) => b.riskLevel - a.riskLevel);
}

// ─── Region activity ──────────────────────────────────────────────────────────

const COUNTRY_REGIONS: Record<string, string> = {};
function getRegionForCountry(country: string): string | null {
  return COUNTRY_REGIONS[country.toLowerCase()] ?? null;
}

// Built once on module load from the shared REGION_COUNTRIES map (Decision
// Support Engine) rather than duplicating the country→region table here.
let _regionsLoaded = false;
function ensureRegions() {
  if (_regionsLoaded) return;
  _regionsLoaded = true;
  for (const [region, countries] of Object.entries(REGION_COUNTRIES)) {
    for (const c of countries) COUNTRY_REGIONS[c.toLowerCase()] = region;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function analyzeGraph(graph: KnowledgeGraph): GraphAnalyticsResult {
  ensureRegions();

  // Most connected node
  const mostConnectedNode = graph.stats.mostConnectedNode ?? null;

  // Clusters
  const clusters = buildClusters(graph);
  const highestRiskCluster = clusters[0] ?? null;
  const largestCluster = [...clusters].sort((a, b) => b.nodeIds.length - a.nodeIds.length)[0] ?? null;

  // Most active region
  const regionCounts = new Map<string, number>();
  for (const n of graph.nodes) {
    if (n.country) {
      const region = getRegionForCountry(n.country) ?? "Other";
      regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    }
  }
  const mostActiveRegion = [...regionCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

  // Most influential country (country node with highest degree × riskScore)
  const countryNodes = graph.nodes.filter((n) => n.type === "country");
  const mostInfluentialCountry = countryNodes.length > 0
    ? countryNodes
        .sort((a, b) => (b.degree * b.riskScore) - (a.degree * a.riskScore))[0]?.label ?? "Unknown"
    : "Unknown";

  // Emerging topics: topic nodes with most connections
  const topicNodes = graph.nodes.filter((n) => n.type === "topic");
  const emergingTopics = topicNodes
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5)
    .map((n) => n.label);

  // Relationship distribution
  const relationshipDistribution = {} as Record<KnowledgeEdgeType, number>;
  for (const edge of graph.edges) {
    relationshipDistribution[edge.type] = (relationshipDistribution[edge.type] ?? 0) + 1;
  }

  return {
    mostConnectedNode,
    highestRiskCluster,
    mostActiveRegion,
    emergingTopics,
    largestCluster,
    mostInfluentialCountry,
    connectionDensity: graph.stats.connectionDensity,
    relationshipDistribution,
    clusters,
  };
}
