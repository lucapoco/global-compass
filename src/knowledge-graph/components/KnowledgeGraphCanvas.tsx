/**
 * KnowledgeGraphCanvas — Main React Flow canvas for the Global Knowledge Graph.
 *
 * Features:
 *   • Custom node rendering (GraphNodeCard)
 *   • Color-coded edges by relationship type
 *   • Animated edge markers
 *   • MiniMap, Controls, Background
 *   • Selected node side panel
 *   • Filter bar + search
 *   • Analytics bottom bar
 *   • Keyboard navigation
 */
import { useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { GraphNodeCard } from "./GraphNodeCard";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { GraphSearchBar } from "./GraphSearchBar";
import { GraphAnalyticsBar } from "./GraphAnalyticsBar";
import type { KnowledgeGraph } from "../types";
import type { KnowledgeGraphState } from "../hooks/useKnowledgeGraph";
import { useT } from "@/i18n";

// ─── Edge colors by type ──────────────────────────────────────────────────────

const EDGE_COLOR: Record<string, string> = {
  occurred_in:        "#3b82f6",  // blue
  same_category:      "#6b7280",  // gray
  same_time_window:   "#8b5cf6",  // purple
  same_country:       "#f97316",  // orange
  same_region:        "#374151",  // dark gray
  correlation_engine: "#22d3ee",  // cyan
  neighbor_country:   "#1f2937",
  political_relation: "#4338ca",
  economic_relation:  "#059669",
  climate_relation:   "#0ea5e9",
  cyber_relation:     "#0891b2",
  energy_relation:    "#d97706",
  default:            "#4b5563",
};

// ─── Adapters: KnowledgeGraph → React Flow ────────────────────────────────────

function toFlowNodes(graph: KnowledgeGraph, selectedId?: string): Node[] {
  return graph.nodes.map((kn) => ({
    id: kn.id,
    type: "knowledgeNode",
    position: { x: kn.x, y: kn.y },
    data: kn as unknown as Record<string, unknown>,
    selected: kn.id === selectedId,
    // Disable default React Flow node controls
    draggable: true,
    connectable: false,
  }));
}

function toFlowEdges(graph: KnowledgeGraph): Edge[] {
  return graph.edges.map((ke) => {
    const color = EDGE_COLOR[ke.type] ?? EDGE_COLOR.default;
    const isStrong = ke.weight > 0.7;
    const isCausal = ke.type === "correlation_engine" || ke.type === "same_time_window";

    return {
      id: ke.id,
      source: ke.source,
      target: ke.target,
      type: "default",
      animated: isCausal,
      label: isStrong ? undefined : undefined, // labels clutter — rely on panel
      style: {
        stroke: color,
        strokeWidth: Math.max(0.5, ke.weight * 2),
        opacity: 0.5 + ke.weight * 0.4,
        strokeDasharray: ke.creationSource === "correlation" ? "4 2" : undefined,
      },
      markerEnd: {
        type: "arrowclosed" as const,
        color,
        width: 8,
        height: 8,
      },
    } satisfies Edge;
  });
}

// ─── Node types registration ──────────────────────────────────────────────────

const NODE_TYPES = { knowledgeNode: GraphNodeCard };

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  state: KnowledgeGraphState;
  onNavigateToCountry?: (country: string) => void;
}

export function KnowledgeGraphCanvas({ state, onNavigateToCountry }: Props) {
  const t = useT();
  const {
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
  } = state;

  const flowNodes = useMemo(
    () => (filteredGraph ? toFlowNodes(filteredGraph, selectedNode?.id) : []),
    [filteredGraph, selectedNode?.id],
  );
  const flowEdges = useMemo(
    () => (filteredGraph ? toFlowEdges(filteredGraph) : []),
    [filteredGraph],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      const kn = filteredGraph?.nodes.find((n) => n.id === node.id);
      selectNode(kn ?? null);
    },
    [filteredGraph, selectNode],
  );

  const onPaneClick = useCallback(() => selectNode(null), [selectNode]);

  function handleSearchSelect(nodeId: string) {
    const node = filteredGraph?.nodes.find((n) => n.id === nodeId);
    if (node) selectNode(node);
  }

  if (loading && !filteredGraph) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <div className="text-muted-foreground text-sm">{t("app.pages.knowledgeGraph.buildingGraph")}</div>
          <div className="text-muted-foreground/70 text-xs mt-1">{t("app.pages.knowledgeGraph.loadingEvents")}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/30">
        <div className="text-center max-w-md px-4">
          <div className="text-destructive text-sm mb-2">{t("app.pages.knowledgeGraph.graphFailed")}</div>
          <div className="text-muted-foreground text-xs mb-4">{error}</div>
          <button
            onClick={refresh}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
          >
            {t("app.ui.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!filteredGraph) return null;

  return (
    <div className="w-full h-full relative bg-[#eef2f7]">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.08}
        maxZoom={3}
        attributionPosition="bottom-left"
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#ffffff08"
        />
        <Controls
          className="!bottom-16 !right-4"
          showInteractive={false}
          style={{
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
          }}
        />
        <MiniMap
          style={{
            background: "rgba(0,0,0,0.8)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
          }}
          nodeColor={(node) => {
            const kn = filteredGraph.nodes.find((n) => n.id === node.id);
            if (!kn) return "#374151";
            if (kn.severity === "critical") return "#ef4444";
            if (kn.severity === "high") return "#f97316";
            if (kn.type === "country") return "#3b82f6";
            if (kn.type === "topic") return "#6b7280";
            return "#6366f1";
          }}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      {/* Search + filter */}
      <GraphSearchBar
        searchQuery={searchQuery}
        searchResults={searchResults}
        filter={filter}
        onSearchChange={setSearchQuery}
        onFilterChange={setFilter}
        onResetFilter={resetFilter}
        onRefresh={refresh}
        onSelectSearchResult={handleSearchSelect}
        nodeCount={filteredGraph.stats.nodeCount}
        edgeCount={filteredGraph.stats.edgeCount}
      />

      {/* Selected node panel */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          graph={filteredGraph}
          onClose={() => selectNode(null)}
          onNavigateToCountry={onNavigateToCountry}
        />
      )}

      {/* Analytics bar */}
      {analytics && (
        <GraphAnalyticsBar analytics={analytics} />
      )}

      {/* Legend */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-1.5 px-3 py-2 rounded-xl bg-card border border-border shadow-md">
        <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">{t("app.pages.knowledgeGraph.legend")}</div>
        {[
          { color: "#3b82f6", label: t("app.pages.knowledgeGraph.legendCountry") },
          { color: "#ef4444", label: t("app.pages.knowledgeGraph.legendConflict") },
          { color: "#f97316", label: t("app.pages.knowledgeGraph.legendEarthquake") },
          { color: "#0ea5e9", label: t("app.pages.knowledgeGraph.legendWeather") },
          { color: "#059669", label: t("app.pages.knowledgeGraph.legendEconomy") },
          { color: "#4b5563", label: t("app.pages.knowledgeGraph.legendTopic") },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="border-t border-border mt-1 pt-1">
          <div className="text-[9px] text-muted-foreground">{t("app.pages.knowledgeGraph.edges")}</div>
          {[
            { color: "#3b82f6", label: t("app.pages.knowledgeGraph.occurredIn") },
            { color: "#22d3ee", label: t("app.pages.knowledgeGraph.intelligenceCorrelation"), dashed: true },
            { color: "#8b5cf6", label: t("app.pages.knowledgeGraph.sameTimeWindow") },
          ].map(({ color, label, dashed }) => (
            <div key={label} className="flex items-center gap-2 mt-0.5">
              <div
                className="flex-shrink-0"
                style={{
                  width: 16, height: 2, background: color,
                  borderTop: dashed ? `1px dashed ${color}` : "none",
                  opacity: 0.8,
                }}
              />
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Loading overlay when refreshing */}
      {loading && filteredGraph && (
        <div className="absolute inset-0 bg-background/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-muted-foreground text-sm">{t("app.pages.knowledgeGraph.refreshing")}</div>
        </div>
      )}
    </div>
  );
}
