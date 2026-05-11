import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface Row { label: string; a: number; b: number }
export function CountryComparisonChart({ data, aName, bName }: { data: Row[]; aName: string; bName: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeOpacity={0.1} vertical={false} />
          <XAxis dataKey="label" stroke="oklch(0.7 0.03 240)" fontSize={11} />
          <YAxis stroke="oklch(0.7 0.03 240)" fontSize={11} />
          <Tooltip contentStyle={{ background: "oklch(0.21 0.03 250)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
          <Bar dataKey="a" name={aName} fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="b" name={bName} fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
