import { Link } from "@tanstack/react-router";
import { Globe2, ArrowRight } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DataBadge } from "@/components/ui/DataBadge";

interface Props {
  earthquakeCount: number;
  intelCount: number;
  alertCount: number;
}

export function MapPreview({ earthquakeCount, intelCount, alertCount }: Props) {
  return (
    <Link to="/map" className="glass-card group relative flex h-full flex-col overflow-hidden p-4 transition-colors hover:border-primary/40">
      <SectionHeader
        title="Global Activity Map"
        subtitle="Live geo-located events"
        right={<DataBadge variant="live">Live</DataBadge>}
      />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-6">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{
          backgroundImage: "radial-gradient(circle at 30% 35%, rgba(34,211,238,0.25), transparent 35%), radial-gradient(circle at 70% 60%, rgba(245,158,11,0.18), transparent 35%), radial-gradient(circle at 50% 80%, rgba(251,113,133,0.18), transparent 35%)",
        }} />
        <Globe2 className="relative h-24 w-24 text-primary/70 transition-transform group-hover:scale-110" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Quakes</div>
          <div className="text-sm font-semibold tabular-nums text-amber-glow">{earthquakeCount}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Intel</div>
          <div className="text-sm font-semibold tabular-nums text-cyan-glow">{intelCount}</div>
        </div>
        <div className="rounded-md border border-border/40 bg-secondary/20 p-2">
          <div className="text-[10px] uppercase text-muted-foreground">Alerts</div>
          <div className="text-sm font-semibold tabular-nums text-rose-glow">{alertCount}</div>
        </div>
      </div>

      <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary group-hover:underline">
        Open control center <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  );
}
