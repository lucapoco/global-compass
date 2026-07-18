/**
 * GraphSearchBar — Search + filter controls for the Knowledge Graph.
 */
import { useState, useRef, useEffect } from "react";
import { Search, X, Filter, RefreshCw } from "lucide-react";
import type { GraphFilterOptions, KnowledgeNodeType } from "../types";
import { NODE_TYPE_CONFIG } from "../types";
import type { GraphSearchResult } from "../types";
import { useT } from "@/i18n";

interface Props {
  searchQuery: string;
  searchResults: GraphSearchResult[];
  filter: GraphFilterOptions;
  onSearchChange: (q: string) => void;
  onFilterChange: (f: Partial<GraphFilterOptions>) => void;
  onResetFilter: () => void;
  onRefresh: () => void;
  onSelectSearchResult: (nodeId: string) => void;
  nodeCount: number;
  edgeCount: number;
}

const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;

const NODE_TYPE_OPTIONS: KnowledgeNodeType[] = [
  "country",
  "conflict",
  "earthquake",
  "wildfire",
  "cyber",
  "economic",
  "political",
  "health",
  "weather",
  "breaking_news",
  "topic",
];

export function GraphSearchBar({
  searchQuery, searchResults, filter,
  onSearchChange, onFilterChange, onResetFilter, onRefresh,
  onSelectSearchResult, nodeCount, edgeCount,
}: Props) {
  const t = useT();
  const [showFilters, setShowFilters] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowResults(searchResults.length > 0 && searchQuery.length > 0);
  }, [searchResults.length, searchQuery]);

  const hasActiveFilter = (filter.severities?.length ?? 0) > 0 ||
    (filter.nodeTypes?.length ?? 0) > 0 ||
    filter.minRisk !== undefined;

  function toggleSeverity(s: typeof SEVERITY_OPTIONS[number]) {
    const current = filter.severities ?? [];
    const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
    onFilterChange({ severities: next.length > 0 ? next as GraphFilterOptions["severities"] : undefined });
  }

  function toggleNodeType(type: KnowledgeNodeType) {
    const current = filter.nodeTypes ?? [];
    const next = current.includes(type) ? current.filter((x) => x !== type) : [...current, type];
    onFilterChange({ nodeTypes: next.length > 0 ? next : undefined });
  }

  return (
    <div className="absolute top-4 left-4 z-40 w-72 flex flex-col gap-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          placeholder={t("app.pages.knowledgeGraph.searchPlaceholder")}
          className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-card border border-border shadow-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t("app.ui.clearSearch")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Search results dropdown */}
        {showResults && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl overflow-hidden shadow-lg">
            {searchResults.slice(0, 8).map((r) => {
              const cfg = NODE_TYPE_CONFIG[r.node.type];
              return (
                <button
                  key={r.node.id}
                  onMouseDown={() => {
                    onSelectSearchResult(r.node.id);
                    onSearchChange("");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                >
                  <span>{cfg?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-foreground truncate">{r.node.label}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">
                      {r.node.type.replace(/_/g, " ")}
                      {r.node.country ? ` · ${r.node.country}` : ""}
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex-shrink-0">{t("app.pages.knowledgeGraph.links", { count: r.node.degree })}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats + controls row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-[11px] text-muted-foreground shadow-sm">
          {t("app.pages.knowledgeGraph.nodesEdges", { nodes: nodeCount, edges: edgeCount })}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`p-2 rounded-lg border transition-colors ${
            hasActiveFilter
              ? "bg-accent border-primary/40 text-primary"
              : "bg-card border-border text-muted-foreground hover:text-foreground shadow-sm"
          }`}
          title={t("app.pages.knowledgeGraph.filters")}
          aria-label={t("app.pages.knowledgeGraph.filters")}
        >
          <Filter className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground shadow-sm transition-colors"
          title={t("app.pages.knowledgeGraph.refreshGraph")}
          aria-label={t("app.ui.refresh")}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl bg-card border border-border shadow-lg p-3 space-y-3">
          {/* Severity */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1.5 uppercase">{t("app.pages.knowledgeGraph.severity")}</div>
            <div className="flex flex-wrap gap-1">
              {SEVERITY_OPTIONS.map((s) => {
                const active = (filter.severities ?? []).includes(s);
                const colors: Record<string, string> = {
                  critical: "border-red-300 text-red-600",
                  high: "border-orange-300 text-orange-600",
                  medium: "border-amber-300 text-amber-600",
                  low: "border-emerald-300 text-emerald-600",
                };
                return (
                  <button
                    key={s}
                    onClick={() => toggleSeverity(s)}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      active
                        ? `${colors[s]} bg-muted`
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t(`app.ui.severity.${s}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Node types */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1.5 uppercase">{t("app.pages.knowledgeGraph.nodeTypes")}</div>
            <div className="flex flex-wrap gap-1">
              {NODE_TYPE_OPTIONS.map((type) => {
                const active = (filter.nodeTypes ?? []).includes(type);
                const cfg = NODE_TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    onClick={() => toggleNodeType(type)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      active
                        ? "border-primary/40 text-primary bg-accent"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{cfg?.icon}</span>
                    {t(`app.pages.knowledgeGraph.nodeType.${type}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Risk threshold */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1.5 uppercase">
              {t("app.pages.knowledgeGraph.minRisk", { value: filter.minRisk ?? 0 })}
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={10}
              value={filter.minRisk ?? 0}
              onChange={(e) => onFilterChange({ minRisk: Number(e.target.value) || undefined })}
              className="w-full accent-primary"
            />
          </div>

          {/* Reset */}
          <button
            onClick={onResetFilter}
            className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 border-t border-border transition-colors"
          >
            {t("app.pages.knowledgeGraph.resetAllFilters")}
          </button>
        </div>
      )}
    </div>
  );
}
