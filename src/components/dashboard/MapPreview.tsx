import { Link } from "@tanstack/react-router";
import { Globe2, ArrowRight } from "lucide-react";
import { useT } from "@/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DataBadge } from "@/components/ui/DataBadge";

interface Props {
  earthquakeCount: number;
  intelCount: number;
  alertCount: number;
}

export function MapPreview({ earthquakeCount, intelCount, alertCount }: Props) {
  const t = useT();

  return (
    <Link to="/map" className="glass-card group relative flex min-h-[180px] flex-col overflow-hidden p-4 transition-colors hover:border-primary/40">
      <SectionHeader
        title={t("app.pages.dashboard.mapPreview.title")}
        subtitle={t("app.pages.dashboard.mapPreview.subtitle")}
        right={<DataBadge variant="live">{t("app.ui.dataStatus.live")}</DataBadge>}
      />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 p-6">
        <div className="pointer-events-none absolute inset-0 opacity-60" style={{
          backgroundImage: "radial-gradient(circle at 30% 35%, rgba(2,132,199,0.15), transparent 35%), radial-gradient(circle at 70% 60%, rgba(14,165,233,0.12), transparent 35%), radial-gradient(circle at 50% 80%, rgba(100,116,139,0.1), transparent 35%)",
        }} />
        <Globe2 className="relative h-24 w-24 text-primary transition-transform group-hover:scale-110" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">{t("app.nav.earthquakes")}</div>
          <div className="text-sm font-semibold tabular-nums text-amber-glow">{earthquakeCount}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">{t("app.pages.dashboard.quickLinks.intel")}</div>
          <div className="text-sm font-semibold tabular-nums text-cyan-glow">{intelCount}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">{t("app.pages.dashboard.quickLinks.alerts")}</div>
          <div className="text-sm font-semibold tabular-nums text-rose-glow">{alertCount}</div>
        </div>
      </div>

      <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary group-hover:underline">
        {t("app.pages.dashboard.mapPreview.openControlCenter")} <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
