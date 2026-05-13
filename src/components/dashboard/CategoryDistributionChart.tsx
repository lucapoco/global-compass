import { useMemo } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { LayoutGrid } from "lucide-react";
import type { IntelligenceItem } from "@/types";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface Props { items: IntelligenceItem[] }

const COLORS = [
  "#22d3ee", "#f59e0b", "#34d399", "#a78bfa", "#fb7185",
  "#38bdf8", "#fbbf24", "#facc15", "#f472b6", "#94a3b8",
];

export function CategoryDistributionChart({ items }: Props) {
  const data = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  return (
    <div className="glass-card p-4">
      <SectionHeader
        title="Category Distribution"
        subtitle="Live intelligence items grouped by category"
        right={<LayoutGrid className="h-4 w-4 text-cyan-glow" />}
      />
      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/50 p-6 text-center text-xs text-muted-foreground">No data yet.</div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <XAxis dataKey="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "hsl(var(--muted) / 0.2)" }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
