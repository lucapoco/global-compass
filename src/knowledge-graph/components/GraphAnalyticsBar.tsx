/**
 * GraphAnalyticsBar — Bottom analytics strip for the Knowledge Graph.
 * Shows: most connected node, active region, emerging topics, cluster count.
 */
import { Network, TrendingUp, Globe, Layers } from "lucide-react";
import type { GraphAnalyticsResult } from "../types";
import { NODE_TYPE_CONFIG } from "../types";
import { useT } from "@/i18n";

interface Props {
  analytics: GraphAnalyticsResult;
}

export function GraphAnalyticsBar({ analytics }: Props) {
  const t = useT();
  const { mostConnectedNode, mostActiveRegion, emergingTopics, clusters, connectionDensity } = analytics;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-xl bg-card border border-border shadow-md">
      {/* Most connected */}
      {mostConnectedNode && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <Network className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-muted-foreground">{t("app.pages.knowledgeGraph.hub")}:</span>
          <span className="text-foreground font-medium">
            {NODE_TYPE_CONFIG[mostConnectedNode.type]?.icon}{" "}
            {mostConnectedNode.label}
          </span>
          <span className="text-muted-foreground">({t("app.pages.knowledgeGraph.links", { count: mostConnectedNode.degree })})</span>
        </div>
      )}

      <div className="w-px h-4 bg-border" />

      {/* Most active region */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <Globe className="w-3.5 h-3.5 text-violet-600" />
        <span className="text-muted-foreground">{t("app.pages.knowledgeGraph.active")}:</span>
        <span className="text-foreground font-medium">{mostActiveRegion}</span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Emerging topics */}
      {emergingTopics.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-muted-foreground">{t("app.pages.knowledgeGraph.trending")}:</span>
          <span className="text-foreground font-medium">{emergingTopics.slice(0, 2).join(", ")}</span>
        </div>
      )}

      <div className="w-px h-4 bg-border" />

      {/* Clusters */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <Layers className="w-3.5 h-3.5 text-orange-600" />
        <span className="text-muted-foreground">{t("app.pages.knowledgeGraph.clusters")}:</span>
        <span className="text-foreground font-medium">{clusters.length}</span>
        <span className="text-muted-foreground text-[10px]">{t("app.pages.knowledgeGraph.density", { value: (connectionDensity * 100).toFixed(1) })}</span>
      </div>
    </div>
  );
}
