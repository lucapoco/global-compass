import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

export function PopulationChart({ population }: { population: number }) {
  // Visualize population as a 10-step distribution curve, purely for context.
  const peak = Math.max(population, 1);
  const data = Array.from({ length: 12 }, (_, i) => {
    const x = (i - 6) / 3;
    const y = Math.exp(-(x * x)) * peak;
    return { x: i, y: Math.round(y) };
  });
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="pop" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.8} />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="x" hide />
          <YAxis hide />
          <Tooltip formatter={(v: number) => v.toLocaleString()} contentStyle={{ background: "oklch(0.21 0.03 250)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
          <Area type="monotone" dataKey="y" stroke="var(--color-chart-1)" fill="url(#pop)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
