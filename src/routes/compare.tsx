import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataBadge } from "@/components/ui/DataBadge";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CountryComparisonChart } from "@/components/charts/CountryComparisonChart";
import { searchCountryByName } from "@/services/countriesApi";
import type { Country } from "@/types";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare Countries — Global Pulse" }] }),
  component: ComparePage,
});

function ComparePage() {
  const [aName, setAName] = useState("Romania");
  const [bName, setBName] = useState("Germany");
  const [a, setA] = useState<Country | null>(null);
  const [b, setB] = useState<Country | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null);
    try {
      const [ra, rb] = await Promise.all([searchCountryByName(aName), searchCountryByName(bName)]);
      if (!ra.length || !rb.length) { setError("One of the countries was not found."); return; }
      setA(ra[0]); setB(rb[0]);
    } catch (e: any) { setError(e.message ?? "Failed"); }
    finally { setLoading(false); }
  }

  const insight = (() => {
    if (!a || !b) return null;
    const popDiff = (a.population ?? 0) - (b.population ?? 0);
    const densA = (a.population ?? 0) / Math.max(a.area ?? 1, 1);
    const densB = (b.population ?? 0) / Math.max(b.area ?? 1, 1);
    const larger = popDiff > 0 ? a.name.common : b.name.common;
    const denser = densA > densB ? a.name.common : b.name.common;
    return `${larger} has a larger population, while ${denser} has a higher population density.`;
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compare Countries</h1>
          <p className="text-xs text-muted-foreground">Side-by-side data and charts</p>
        </div>
        <DataBadge variant="source">REST Countries API</DataBadge>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SearchInput value={aName} onChange={setAName} placeholder="Country A" />
        <SearchInput value={bName} onChange={setBName} placeholder="Country B" />
      </div>
      <button onClick={run} className="rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-xs text-primary">Compare</button>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      {a && b && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {[a, b].map((c) => (
              <div key={c.name.common} className="glass-card p-4">
                <div className="flex items-center gap-3">
                  {c.flags?.svg && <img src={c.flags.svg} alt="" className="h-10 w-14 rounded object-cover border border-border/60" />}
                  <div>
                    <div className="text-lg font-semibold">{c.name.common}</div>
                    <div className="text-xs text-muted-foreground">{c.capital?.[0] ?? "—"} · {c.region}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Cell k="Population" v={c.population?.toLocaleString()} />
                  <Cell k="Area" v={c.area ? `${c.area.toLocaleString()} km²` : "—"} />
                  <Cell k="Density" v={c.area && c.population ? `${(c.population / c.area).toFixed(1)} / km²` : "—"} />
                  <Cell k="Languages" v={c.languages ? Object.values(c.languages).join(", ") : "—"} />
                  <Cell k="Currencies" v={c.currencies ? Object.values(c.currencies).map((x) => x.name).join(", ") : "—"} />
                </div>
              </div>
            ))}
          </div>

          <div className="glass-card p-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Visual comparison</div>
            <CountryComparisonChart
              aName={a.name.common}
              bName={b.name.common}
              data={[
                { label: "Population (M)", a: Math.round((a.population ?? 0) / 1e6), b: Math.round((b.population ?? 0) / 1e6) },
                { label: "Area (k km²)", a: Math.round((a.area ?? 0) / 1e3), b: Math.round((b.area ?? 0) / 1e3) },
                { label: "Density", a: Math.round((a.population ?? 0) / Math.max(a.area ?? 1, 1)), b: Math.round((b.population ?? 0) / Math.max(b.area ?? 1, 1)) },
              ]}
            />
          </div>

          {insight && <div className="glass-card p-4 text-sm text-foreground/90">{insight}</div>}
        </>
      )}
    </div>
  );
}

function Cell({ k, v }: { k: string; v?: string | null }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5">{v ?? "—"}</div>
    </div>
  );
}
