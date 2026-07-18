/**
 * NodeDetailPanel — Intelligence side panel for a selected knowledge node.
 *
 * Shows: summary, risk score (with explanation), connected nodes,
 * source events, confidence, and the edge reasons.
 */
import { useMemo } from "react";
import { X, Shield, Globe, Zap, Link2, AlertTriangle, Clock } from "lucide-react";
import type { KnowledgeNode, KnowledgeGraph } from "../types";
import { NODE_TYPE_CONFIG } from "../types";
import { useT } from "@/i18n";

interface Props {
  node: KnowledgeNode;
  graph: KnowledgeGraph;
  onClose: () => void;
  onNavigateToCountry?: (country: string) => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-600",
  high:     "text-orange-600",
  medium:   "text-amber-600",
  low:      "text-emerald-600",
};

const RISK_COLOR = (r: number) =>
  r >= 75 ? "#ef4444" : r >= 50 ? "#f97316" : r >= 30 ? "#eab308" : "#22c55e";

export function NodeDetailPanel({ node, graph, onClose, onNavigateToCountry }: Props) {
  const t = useT();
  const cfg = NODE_TYPE_CONFIG[node.type] ?? NODE_TYPE_CONFIG.topic;

  // Edges involving this node
  const edges = useMemo(
    () => graph.edges.filter((e) => e.source === node.id || e.target === node.id),
    [graph.edges, node.id],
  );

  // Connected node IDs
  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of edges) {
      if (e.source !== node.id) ids.add(e.source);
      if (e.target !== node.id) ids.add(e.target);
    }
    return ids;
  }, [edges, node.id]);

  const connectedNodes = useMemo(
    () => graph.nodes.filter((n) => connectedIds.has(n.id)).slice(0, 8),
    [graph.nodes, connectedIds],
  );

  const riskColor = RISK_COLOR(node.riskScore);

  return (
    <div
      className="absolute top-4 right-4 z-50 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border bg-card shadow-lg flex flex-col"
      style={{ scrollbarWidth: "thin" }}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 border-b border-border"
        style={{ background: `linear-gradient(135deg, ${cfg.color}22, transparent)` }}
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg border border-border"
          style={{ background: `${cfg.color}44` }}
        >
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{node.label}</div>
          <div className="text-[11px] text-muted-foreground capitalize">{node.type.replace(/_/g, " ")}</div>
          {node.country && (
            <div className="text-[11px] text-primary mt-0.5">{node.country}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t("app.ui.close")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Risk score */}
        <div className="glass-card p-3 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" /> {t("app.pages.knowledgeGraph.riskScore")}
            </span>
            <span className="text-xs font-bold" style={{ color: riskColor }}>
              {node.riskScore}/100
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${node.riskScore}%`, background: riskColor }}
            />
          </div>
          {node.severity && (
            <div className={`text-[10px] mt-1 ${SEVERITY_COLOR[node.severity] ?? "text-muted-foreground"}`}>
              {t("app.pages.knowledgeGraph.severityLabel", { level: t(`app.ui.severity.${node.severity}`) })}
            </div>
          )}
        </div>

        {/* Confidence */}
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-[11px] text-muted-foreground">{t("app.ui.confidence")}:</span>
          <span className="text-[11px] font-semibold text-foreground">{node.confidence}%</span>
        </div>

        {/* Connections */}
        <div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
            <Link2 className="w-3 h-3" /> {t("app.pages.knowledgeGraph.connections", { count: edges.length })}
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {edges.slice(0, 6).map((edge) => {
              const connNode = graph.nodes.find(
                (n) => n.id === (edge.source === node.id ? edge.target : edge.source),
              );
              if (!connNode) return null;
              const cCfg = NODE_TYPE_CONFIG[connNode.type] ?? NODE_TYPE_CONFIG.topic;
              return (
                <div
                  key={edge.id}
                  className="flex items-start gap-2 text-[10px] bg-muted/50 rounded-md p-2 border border-border/60"
                >
                  <span>{cCfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground truncate">{connNode.label}</div>
                    <div className="text-muted-foreground truncate">{edge.label}</div>
                    <div className="text-muted-foreground text-[9px] mt-0.5 line-clamp-2">{edge.reason}</div>
                  </div>
                  <div className="text-[9px] text-muted-foreground flex-shrink-0">
                    {Math.round(edge.confidence)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Connected entities */}
        {connectedNodes.length > 0 && (
          <div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-2">
              <Globe className="w-3 h-3" /> {t("app.pages.knowledgeGraph.connectedEntities")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {connectedNodes.map((cn) => {
                const cc = NODE_TYPE_CONFIG[cn.type] ?? NODE_TYPE_CONFIG.topic;
                return (
                  <button
                    key={cn.id}
                    className="flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 border border-border bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title={cn.label}
                  >
                    <span>{cc.icon}</span>
                    <span className="truncate max-w-[80px]">{cn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Source events count */}
        {node.sourceEventIds.length > 0 && (
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground">{t("app.pages.knowledgeGraph.sourceEvents")}:</span>
            <span className="text-[11px] font-semibold text-foreground">{node.sourceEventIds.length}</span>
          </div>
        )}

        {/* Timestamp */}
        {node.timestamp && (
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground">{t("app.pages.knowledgeGraph.lastUpdated")}:</span>
            <span className="text-[11px] text-muted-foreground" suppressHydrationWarning>
              {new Date(node.timestamp).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Navigate to country */}
        {node.country && onNavigateToCountry && (
          <button
            onClick={() => onNavigateToCountry(node.country!)}
            className="w-full text-[11px] rounded-lg py-2 bg-primary/10 hover:bg-primary/15 border border-primary/25 text-primary transition-colors"
          >
            {t("app.pages.knowledgeGraph.viewCountryIntel")}
          </button>
        )}

        {/* Provider */}
        {node.provider && (
          <div className="text-[10px] text-muted-foreground text-center border-t border-border pt-2">
            {t("app.pages.knowledgeGraph.source", { provider: node.provider })}
          </div>
        )}
      </div>
    </div>
  );
}
