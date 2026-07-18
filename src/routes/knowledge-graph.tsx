/**
 * Knowledge Graph Route — planetary intelligence network view.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { Cpu, Sparkles, Share2 } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { useKnowledgeGraph } from "@/knowledge-graph/hooks/useKnowledgeGraph";
import { KnowledgeGraphCanvas } from "@/knowledge-graph/components/KnowledgeGraphCanvas";
import { useT } from "@/i18n";

export const Route = createFileRoute("/knowledge-graph")({
  component: KnowledgeGraphPage,
});

function KnowledgeGraphPage() {
  const t = useT();
  const graphState = useKnowledgeGraph();
  const navigate = useNavigate();

  function handleNavigateToCountry(country: string) {
    void navigate({ to: "/country/$name", params: { name: country } });
  }

  return (
    <div className="fixed inset-0 lg:left-64 flex flex-col bg-background z-10">
      <header className="flex-shrink-0 flex items-center gap-4 px-5 py-4 border-b border-border bg-card z-10">
        <BrandLogo variant="icon" theme="light" size={32} />
        <div>
          <h1 className="text-sm font-semibold text-foreground leading-tight tracking-tight">{t("app.pages.knowledgeGraph.title")}</h1>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">
            {t("app.pages.knowledgeGraph.entityNetwork", {
              nodes: graphState.filteredGraph?.stats.nodeCount ?? 0,
              edges: graphState.filteredGraph?.stats.edgeCount ?? 0,
            })}
          </p>
        </div>

        <div className="flex-1" />

        {graphState.filteredGraph && (
          <div className="hidden lg:flex items-center gap-2">
            <Chip icon={<Share2 className="w-3 h-3" />} label={t("app.pages.knowledgeGraph.hubsCount", { count: graphState.filteredGraph.stats.hubNodes.length })} />
            <Chip icon={<Cpu className="w-3 h-3" />} label={t("app.pages.knowledgeGraph.countriesCount", { count: graphState.filteredGraph.stats.countryCount })} />
            {graphState.analytics?.clusters.length ? (
              <Chip icon={<Sparkles className="w-3 h-3" />} label={t("app.pages.knowledgeGraph.clustersCount", { count: graphState.analytics.clusters.length })} />
            ) : null}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground">
          <span className={`w-1.5 h-1.5 rounded-full ${graphState.loading ? "bg-amber-500" : graphState.error ? "bg-destructive" : "bg-emerald-500"}`} />
          {graphState.loading
            ? t("app.pages.knowledgeGraph.building")
            : graphState.error
              ? t("app.pages.knowledgeGraph.error")
              : t("app.pages.knowledgeGraph.ready")}
        </div>
      </header>

      <div className="flex-1 min-h-0 bg-muted/40">
        <ReactFlowProvider>
          <KnowledgeGraphCanvas
            state={graphState}
            onNavigateToCountry={handleNavigateToCountry}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card text-[11px] text-muted-foreground">
      {icon}
      {label}
    </div>
  );
}
