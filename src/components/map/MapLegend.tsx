export function MapLegend() {
  const severity = [
    { label: "Critical", color: "#fb7185" },
    { label: "High", color: "#f59e0b" },
    { label: "Medium", color: "#22d3ee" },
    { label: "Low", color: "#34d399" },
  ];
  const special = [
    { label: "Capital / country marker", color: "#a78bfa" },
    { label: "Demo weather point", color: "#22d3ee" },
  ];
  return (
    <div className="glass-card flex flex-wrap items-center gap-4 p-3">
      <div className="flex flex-wrap gap-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Severity</span>
        {severity.map((i) => (
          <div key={i.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: i.color, boxShadow: `0 0 8px ${i.color}` }} />
            {i.label}
          </div>
        ))}
      </div>
      <span className="hidden h-4 w-px bg-border/60 sm:inline" />
      <div className="flex flex-wrap gap-3">
        {special.map((i) => (
          <div key={i.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: i.color, boxShadow: `0 0 8px ${i.color}` }} />
            {i.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/60 bg-primary/60 text-[9px] font-bold text-background">
            N
          </span>
          Cluster (N events, colored by average severity)
        </div>
      </div>
    </div>
  );
}
