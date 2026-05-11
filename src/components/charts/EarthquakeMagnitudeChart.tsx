import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { Earthquake } from "@/types";

export function EarthquakeMagnitudeChart({ data }: { data: Earthquake[] }) {
  const buckets = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => ({
    range: `${m}-${m + 1}`,
    count: data.filter((d) => d.magnitude >= m && d.magnitude < m + 1).length,
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={buckets}>
          <CartesianGrid strokeOpacity={0.1} vertical={false} />
          <XAxis dataKey="range" stroke="oklch(0.7 0.03 240)" fontSize={11} />
          <YAxis stroke="oklch(0.7 0.03 240)" fontSize={11} />
          <Tooltip contentStyle={{ background: "oklch(0.21 0.03 250)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
          <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
