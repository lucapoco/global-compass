/**
 * useKnowledgeGraph — React hook for graph state management.
 *
 * Responsibilities:
 *   • Load GlobalEvents from the EventEngine
 *   • Build and cache the KnowledgeGraph
 *   • Expose filtered graph based on current filter state
 *   • Track selected node, search query, and filter options
 *   • Run graph analytics
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { eventEngine } from "@/domain/services/event-engine/EventEngine";
import { generateGraph, filterGraph, searchGraph } from "../engine/graphEngine";
import { analyzeGraph } from "../analytics/graphAnalytics";
import type {
  KnowledgeGraph,
  KnowledgeNode,
  GraphFilterOptions,
  GraphSearchResult,
  GraphAnalyticsResult,
} from "../types";

// ─── Cache ────────────────────────────────────────────────────────────────────

let _cachedGraph: KnowledgeGraph | null = null;
let _cacheExpiry = 0;
const CACHE_TTL = 5 * 60_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface KnowledgeGraphState {
  graph: KnowledgeGraph | null;
  filteredGraph: KnowledgeGraph | null;
  analytics: GraphAnalyticsResult | null;
  selectedNode: KnowledgeNode | null;
  searchQuery: string;
  searchResults: GraphSearchResult[];
  filter: GraphFilterOptions;
  loading: boolean;
  error: string | null;
  // actions
  selectNode: (node: KnowledgeNode | null) => void;
  setSearchQuery: (q: string) => void;
  setFilter: (f: Partial<GraphFilterOptions>) => void;
  resetFilter: () => void;
  refresh: () => void;
}

const DEFAULT_FILTER: GraphFilterOptions = {};

export function useKnowledgeGraph(): KnowledgeGraphState {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilterState] = useState<GraphFilterOptions>(DEFAULT_FILTER);
  const [tick, setTick] = useState(0);

  const loadGraph = useCallback(async () => {
    if (_cachedGraph && Date.now() < _cacheExpiry) {
      setGraph(_cachedGraph);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const events = await eventEngine.loadAll();
      const g = generateGraph(events);
      _cachedGraph = g;
      _cacheExpiry = Date.now() + CACHE_TTL;
      setGraph(g);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph, tick]);

  const filteredGraph = useMemo(() => {
    if (!graph) return null;
    const hasFilter =
      (filter.countries?.length ?? 0) > 0 ||
      (filter.nodeTypes?.length ?? 0) > 0 ||
      (filter.severities?.length ?? 0) > 0 ||
      (filter.providers?.length ?? 0) > 0 ||
      filter.minRisk !== undefined ||
      filter.minConfidence !== undefined;
    return hasFilter ? filterGraph(graph, filter) : graph;
  }, [graph, filter]);

  const analytics = useMemo(() => {
    if (!filteredGraph) return null;
    return analyzeGraph(filteredGraph);
  }, [filteredGraph]);

  const searchResults = useMemo(() => {
    if (!filteredGraph || !searchQuery.trim()) return [];
    return searchGraph(filteredGraph, searchQuery);
  }, [filteredGraph, searchQuery]);

  const selectNode = useCallback((node: KnowledgeNode | null) => {
    setSelectedNode(node);
  }, []);

  const setFilter = useCallback((partial: Partial<GraphFilterOptions>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilterState(DEFAULT_FILTER);
  }, []);

  const refresh = useCallback(() => {
    _cachedGraph = null;
    _cacheExpiry = 0;
    setTick((t) => t + 1);
  }, []);

  return {
    graph,
    filteredGraph,
    analytics,
    selectedNode,
    searchQuery,
    searchResults,
    filter,
    loading,
    error,
    selectNode,
    setSearchQuery,
    setFilter,
    resetFilter,
    refresh,
  };
}
