/**
 * Global Knowledge Graph — Type Definitions
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GRAPH MODEL
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Nodes represent intelligence entities extracted from the platform's data:
 *   • Real-world places (Country, City, Region)
 *   • Physical events (Earthquake, Wildfire, Flood, Volcano, Weather)
 *   • Human activity (Conflict, Political Event, Economic Indicator, Cyber)
 *   • Information (Breaking News, Keyword, Topic, AI Insight)
 *
 * Edges represent detected or inferred relationships between entities.
 * Every edge carries weight (0–1), confidence (0–100), and a human-readable reason.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DESIGN INVARIANTS
 * ─────────────────────────────────────────────────────────────────────────
 *   • No unexplained edges — every edge has a `reason` string
 *   • Every node has a `sourceEventIds` list — traceable to real data
 *   • `creationSource` tracks whether a relationship was auto-detected,
 *     correlation-derived, or user-initiated
 */

import type { GlobalEventSeverity, GlobalEventCategory } from "@/domain/models/GlobalEvent";

// ─── Node types ───────────────────────────────────────────────────────────────

export type KnowledgeNodeType =
  | "country"
  | "city"
  | "region"
  | "earthquake"
  | "weather"
  | "wildfire"
  | "flood"
  | "volcano"
  | "conflict"
  | "breaking_news"
  | "political"
  | "economic"
  | "organization"
  | "technology"
  | "cyber"
  | "energy"
  | "health"
  | "keyword"
  | "topic"
  | "ai_insight"
  | "saved_intelligence";

// ─── Edge types ───────────────────────────────────────────────────────────────

export type KnowledgeEdgeType =
  | "located_in"
  | "occurred_in"
  | "same_country"
  | "neighbor_country"
  | "same_region"
  | "same_category"
  | "similar_topic"
  | "same_time_window"
  | "possible_impact"
  | "economic_relation"
  | "political_relation"
  | "climate_relation"
  | "supply_chain"
  | "energy_relation"
  | "cyber_relation"
  | "shared_keywords"
  | "referenced_together"
  | "generated_by_ai"
  | "correlation_engine";  // derived from the Correlation Engine

export type EdgeCreationSource = "auto" | "correlation" | "user" | "ai";

// ─── Node ─────────────────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  label: string;
  sublabel?: string;

  // Spatial / geographical
  country?: string;
  region?: string;
  coordinates?: [number, number];  // [lat, lng]

  // Intelligence attributes
  severity?: GlobalEventSeverity;
  category?: GlobalEventCategory;
  riskScore: number;               // 0–100
  confidence: number;              // 0–100
  importance: number;              // 0–100

  // Connections (filled in by graph engine)
  degree: number;                  // number of edges
  isHub: boolean;                  // degree > hub threshold

  // Provenance
  provider?: string;
  sourceEventIds: string[];
  timestamp?: string;
  live?: boolean;

  // Layout (set by layout engine, used by React Flow)
  x: number;
  y: number;
}

// ─── Edge ─────────────────────────────────────────────────────────────────────

export interface KnowledgeEdge {
  id: string;
  source: string;    // KnowledgeNode.id
  target: string;    // KnowledgeNode.id
  type: KnowledgeEdgeType;
  label: string;     // e.g. "Located In", "Same Time Window"

  weight: number;    // 0–1: how strong the relationship is
  confidence: number; // 0–100: how certain we are of the relationship
  reason: string;    // human-readable explanation

  creationSource: EdgeCreationSource;
  timestamp: string;
}

// ─── Graph ────────────────────────────────────────────────────────────────────

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  generatedAt: string;
  totalEvents: number;

  stats: {
    nodeCount: number;
    edgeCount: number;
    countryCount: number;
    topicCount: number;
    hubNodes: string[];          // ids of hub nodes
    mostConnectedNode: KnowledgeNode | null;
    avgDegree: number;
    connectionDensity: number;   // edges / (n*(n-1)/2)
  };
}

// ─── Filter options ───────────────────────────────────────────────────────────

export interface GraphFilterOptions {
  countries?: string[];
  categories?: GlobalEventCategory[];
  nodeTypes?: KnowledgeNodeType[];
  edgeTypes?: KnowledgeEdgeType[];
  minRisk?: number;
  minConfidence?: number;
  severities?: GlobalEventSeverity[];
  providers?: string[];
  dateFrom?: number;  // ms timestamp
  dateTo?: number;
  maxNodes?: number;
}

// ─── Search result ────────────────────────────────────────────────────────────

export interface GraphSearchResult {
  node: KnowledgeNode;
  score: number;       // relevance 0–1
  matchField: string;  // "label" | "country" | "category"
}

// ─── Cluster ──────────────────────────────────────────────────────────────────

export interface GraphCluster {
  id: string;
  title: string;
  nodeIds: string[];
  countries: string[];
  categories: GlobalEventCategory[];
  dominantTopic: string;
  riskLevel: number;
  confidence: number;
  supportingEventCount: number;
}

// ─── Analytics result ─────────────────────────────────────────────────────────

export interface GraphAnalyticsResult {
  mostConnectedNode: KnowledgeNode | null;
  highestRiskCluster: GraphCluster | null;
  mostActiveRegion: string;
  emergingTopics: string[];
  largestCluster: GraphCluster | null;
  mostInfluentialCountry: string;
  connectionDensity: number;
  relationshipDistribution: Record<KnowledgeEdgeType, number>;
  clusters: GraphCluster[];
}

// ─── Node type config (visual metadata) ──────────────────────────────────────

export interface NodeTypeConfig {
  color: string;      // primary fill color
  borderColor: string;
  icon: string;       // emoji fallback
  size: number;       // base size in px
  layer: number;      // z-index for stacking
}

export const NODE_TYPE_CONFIG: Record<KnowledgeNodeType, NodeTypeConfig> = {
  country:            { color: "#3b82f6", borderColor: "#60a5fa", icon: "🌍", size: 56, layer: 10 },
  city:               { color: "#6366f1", borderColor: "#818cf8", icon: "🏙️", size: 36, layer: 8 },
  region:             { color: "#8b5cf6", borderColor: "#a78bfa", icon: "🗺️", size: 44, layer: 9 },
  earthquake:         { color: "#f97316", borderColor: "#fb923c", icon: "⚡", size: 40, layer: 7 },
  weather:            { color: "#0ea5e9", borderColor: "#38bdf8", icon: "🌪️", size: 36, layer: 6 },
  wildfire:           { color: "#dc2626", borderColor: "#f87171", icon: "🔥", size: 40, layer: 7 },
  flood:              { color: "#0284c7", borderColor: "#38bdf8", icon: "🌊", size: 38, layer: 6 },
  volcano:            { color: "#b45309", borderColor: "#d97706", icon: "🌋", size: 42, layer: 7 },
  conflict:           { color: "#ef4444", borderColor: "#f87171", icon: "⚔️", size: 44, layer: 8 },
  breaking_news:      { color: "#7c3aed", borderColor: "#a78bfa", icon: "📡", size: 36, layer: 6 },
  political:          { color: "#4338ca", borderColor: "#6366f1", icon: "🏛️", size: 38, layer: 6 },
  economic:           { color: "#059669", borderColor: "#34d399", icon: "📈", size: 36, layer: 6 },
  organization:       { color: "#0891b2", borderColor: "#22d3ee", icon: "🏢", size: 34, layer: 5 },
  technology:         { color: "#7c3aed", borderColor: "#c084fc", icon: "💻", size: 34, layer: 5 },
  cyber:              { color: "#0891b2", borderColor: "#22d3ee", icon: "🔐", size: 40, layer: 7 },
  energy:             { color: "#d97706", borderColor: "#fbbf24", icon: "⚡", size: 36, layer: 6 },
  health:             { color: "#db2777", borderColor: "#f472b6", icon: "🏥", size: 38, layer: 6 },
  keyword:            { color: "#374151", borderColor: "#6b7280", icon: "🏷️", size: 28, layer: 3 },
  topic:              { color: "#4b5563", borderColor: "#9ca3af", icon: "📌", size: 32, layer: 4 },
  ai_insight:         { color: "#7c3aed", borderColor: "#a78bfa", icon: "🤖", size: 34, layer: 5 },
  saved_intelligence: { color: "#0d9488", borderColor: "#2dd4bf", icon: "🔖", size: 34, layer: 5 },
};

export const EDGE_TYPE_LABELS: Record<KnowledgeEdgeType, string> = {
  located_in:         "Located In",
  occurred_in:        "Occurred In",
  same_country:       "Same Country",
  neighbor_country:   "Neighboring Country",
  same_region:        "Same Region",
  same_category:      "Same Category",
  similar_topic:      "Similar Topic",
  same_time_window:   "Same Time Window",
  possible_impact:    "Possible Impact",
  economic_relation:  "Economic Relation",
  political_relation: "Political Relation",
  climate_relation:   "Climate Relation",
  supply_chain:       "Supply Chain",
  energy_relation:    "Energy Relation",
  cyber_relation:     "Cyber Relation",
  shared_keywords:    "Shared Keywords",
  referenced_together: "Referenced Together",
  generated_by_ai:    "Generated by AI",
  correlation_engine: "Intelligence Correlation",
};
