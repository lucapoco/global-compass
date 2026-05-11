import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: "cyan" | "emerald" | "amber" | "rose";
}

const accentMap = {
  cyan: "from-cyan-glow/20 to-transparent text-cyan-glow",
  emerald: "from-emerald-glow/20 to-transparent text-emerald-glow",
  amber: "from-amber-glow/20 to-transparent text-amber-glow",
  rose: "from-rose-glow/20 to-transparent text-rose-glow",
} as const;

export function StatCard({ label, value, hint, icon, accent = "cyan" }: Props) {
  return (
    <div className="glass-card relative overflow-hidden p-4">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${accentMap[accent]} blur-2xl opacity-60`} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {icon && <div className={`rounded-md border border-border/60 p-2 ${accentMap[accent].split(" ").pop()}`}>{icon}</div>}
      </div>
    </div>
  );
}
