/**
 * Bulk World Bank indicator fetch — one HTTP request returns the latest
 * value for EVERY country at once (`country=all`), instead of the
 * per-country loop `worldBankProvider.ts` uses for the Country Intelligence
 * page. This is what makes an "Economic Indicators" / "Population" /
 * "Energy" map layer (200+ pins) practical without hundreds of requests.
 *
 * No API key required — public, CORS-enabled endpoint.
 */
import type { WorldBankIndicatorResponse } from "../../models/WorldBankData";

const WB_BASE = "https://api.worldbank.org/v2/country/all/indicator";

export interface BulkIndicatorValue {
  value: number;
  year: number;
}

/** Fetches the latest (mrv=1) value for one indicator across every country, keyed by ISO-3 code. */
export async function fetchBulkIndicator(indicatorCode: string): Promise<Map<string, BulkIndicatorValue>> {
  const url = `${WB_BASE}/${indicatorCode}?format=json&mrv=1&per_page=400`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`World Bank bulk indicator ${indicatorCode} responded ${res.status}`);

  const json = (await res.json()) as [unknown, WorldBankIndicatorResponse[] | null];
  const records = json[1] ?? [];

  const out = new Map<string, BulkIndicatorValue>();
  for (const r of records) {
    if (r.value === null || !r.countryiso3code) continue;
    const year = r.date ? parseInt(r.date, 10) : NaN;
    if (Number.isNaN(year)) continue;
    out.set(r.countryiso3code, { value: r.value, year });
  }
  return out;
}
