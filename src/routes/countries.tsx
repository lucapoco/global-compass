import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bookmark, ExternalLink } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { DataBadge } from "@/components/ui/DataBadge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { PopulationChart } from "@/components/charts/PopulationChart";
import { searchCountryByName } from "@/services/countriesApi";
import { supabaseService, isSupabaseConfigured } from "@/services/supabaseService";
import type { Country } from "@/types";

export const Route = createFileRoute("/countries")({
  head: () => ({ meta: [{ title: "Countries — Global Pulse" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : undefined }),
  component: CountriesPage,
});

function CountriesPage() {
  const initialQ = Route.useSearch().q;
  const [q, setQ] = useState(initialQ ?? "Romania");
  const [country, setCountry] = useState<Country | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(name?: string) {
    const term = (name ?? q).trim();
    if (!term) return;
    setLoading(true); setError(null); setCountry(null);
    try {
      const res = await searchCountryByName(term);
      if (!res.length) setError("No country found.");
      else setCountry(res[0]);
    } catch (e: any) { setError(e.message ?? "Failed to fetch."); }
    finally { setLoading(false); }
  }

  // Auto-run when arriving with ?q=
  useEffect(() => { if (initialQ) run(initialQ); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [initialQ]);

  async function save() {
    if (!country) return;
    if (!isSupabaseConfigured()) { toast.error("Connect Supabase to enable saved countries."); return; }
    try {
      await supabaseService.saveCountry({
        country_name: country.name.common,
        country_code: country.cca2 ?? null,
        capital: country.capital?.[0] ?? null,
        region: country.region ?? null,
        population: country.population ?? null,
        flag_url: country.flags?.svg ?? country.flags?.png ?? null,
        notes: null,
      });
      toast.success(`${country.name.common} saved.`);
    } catch (e: any) { toast.error(e.message ?? "Save failed."); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Countries</h1>
          <p className="text-xs text-muted-foreground">Live data from REST Countries API</p>
        </div>
        <DataBadge variant="source">REST Countries API</DataBadge>
      </div>

      <div className="glass-card p-4">
        <SearchInput value={q} onChange={setQ} onSubmit={run} placeholder="Search country (e.g. Japan, Romania)" />
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && !country && <EmptyState title="Search any country to begin" />}

      {country && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-card p-4 lg:col-span-1">
            <div className="flex items-center gap-3">
              {country.flags?.svg && <img src={country.flags.svg} alt={country.name.common} className="h-10 w-14 rounded object-cover border border-border/60" />}
              <div>
                <div className="text-lg font-semibold">{country.name.common}</div>
                <div className="text-xs text-muted-foreground">{country.name.official}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <Info k="Capital" v={country.capital?.[0]} />
              <Info k="Region" v={country.region} />
              <Info k="Subregion" v={country.subregion} />
              <Info k="Population" v={country.population?.toLocaleString()} />
              <Info k="Area" v={country.area ? `${country.area.toLocaleString()} km²` : undefined} />
              <Info k="Density" v={country.area && country.population ? `${(country.population / country.area).toFixed(1)} / km²` : undefined} />
              <Info k="Timezones" v={country.timezones?.slice(0, 2).join(", ")} />
              <Info k="Borders" v={country.borders?.join(", ") || "—"} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={save} className="inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
                <Bookmark className="h-3.5 w-3.5" /> Save country
              </button>
              {country.maps?.googleMaps && (
                <a href={country.maps.googleMaps} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" /> Google Maps
                </a>
              )}
            </div>
          </div>

          <div className="glass-card p-4 lg:col-span-2">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Population context</div>
            <PopulationChart population={country.population ?? 0} />
            <div className="mt-4 grid gap-2 text-xs md:grid-cols-2">
              <Info k="Languages" v={country.languages ? Object.values(country.languages).join(", ") : undefined} />
              <Info k="Currencies" v={country.currencies ? Object.values(country.currencies).map((c) => `${c.name}${c.symbol ? ` (${c.symbol})` : ""}`).join(", ") : undefined} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ k, v }: { k: string; v?: string | number | null }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-foreground">{v ?? "—"}</div>
    </div>
  );
}
