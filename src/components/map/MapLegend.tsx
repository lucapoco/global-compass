export function MapLegend() {
  const items = [
    { label: "Earthquake", color: "#f59e0b" },
    { label: "Weather",    color: "#22d3ee" },
    { label: "Capital",    color: "#a78bfa" },
    { label: "Saved alert",color: "#fb7185" },
  ];
  return (
    <div className="glass-card flex flex-wrap gap-3 p-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: i.color, boxShadow: `0 0 8px ${i.color}` }} />
          {i.label}
        </div>
      ))}
    </div>
  );
}
