/**
 * REST Countries v5 client + bundled fallback.
 *
 * The legacy v3.1 API (restcountries.com/v3.1) was shut down and now returns
 * `{ success: false }` for every request. v5 lives at api.restcountries.com
 * and requires a Bearer API key (free tier available at restcountries.com/sign-up).
 *
 * When no key is configured, or v5 is unreachable, we serve the bundled
 * FALLBACK_COUNTRIES dataset so the platform never shows "No country found."
 */
import "@/server/loadServerEnv";
import { readWorkerEnvString } from "@/server/workerEnv";
import { FALLBACK_COUNTRIES, searchFallbackCountries } from "@/data/fallbackCountries";
import type { Country } from "@/types";

const V5_BASE = "https://api.restcountries.com/countries/v5";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 600;

const RESPONSE_FIELDS = [
  "names.common",
  "names.official",
  "codes.alpha_2",
  "codes.alpha_3",
  "capitals.name",
  "region",
  "subregion",
  "population",
  "area.kilometers",
  "languages.name",
  "languages.iso639_1",
  "currencies.code",
  "currencies.name",
  "currencies.symbol",
  "timezones",
  "borders",
  "flag.url_png",
  "flag.url_svg",
  "links.google_maps",
  "coordinates.lat",
  "coordinates.lng",
].join(",");

const SEARCH_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  america: "United States",
  uk: "United Kingdom",
  britain: "United Kingdom",
  england: "United Kingdom",
  uae: "United Arab Emirates",
  korea: "South Korea",
  drc: "Democratic Republic of the Congo",
  russia: "Russia",
};

export type CountriesFetchSource = "live" | "cached" | "local";

export function readRestCountriesApiKey(): string | undefined {
  return readWorkerEnvString("REST_COUNTRIES_API_KEY");
}

export function normalizeCountryQuery(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return SEARCH_ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface V5Capital {
  name?: string;
}
interface V5Language {
  iso639_1?: string;
  name?: string;
}
interface V5Currency {
  code?: string;
  name?: string;
  symbol?: string;
}
interface V5Object {
  names?: { common?: string; official?: string };
  codes?: { alpha_2?: string; alpha_3?: string };
  capitals?: V5Capital[];
  region?: string;
  subregion?: string;
  population?: number;
  area?: { kilometers?: number };
  languages?: V5Language[];
  currencies?: V5Currency[];
  timezones?: string[];
  borders?: string[];
  flag?: { url_png?: string; url_svg?: string };
  links?: { google_maps?: string };
  coordinates?: { lat?: number; lng?: number };
}

function extractV5Objects(payload: unknown): V5Object[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { success?: boolean; data?: { _demo?: unknown; objects?: unknown[] } };
  if (root.success === false) return [];
  const data = root.data;
  if (!data || data._demo) return [];
  return Array.isArray(data.objects) ? (data.objects as V5Object[]) : [];
}

export function mapV5ToCountry(obj: V5Object): Country {
  const languages: Record<string, string> = {};
  for (const lang of obj.languages ?? []) {
    const key = lang.iso639_1 ?? lang.name ?? "lang";
    if (lang.name) languages[key] = lang.name;
  }

  const currencies: Record<string, { name: string; symbol?: string }> = {};
  for (const cur of obj.currencies ?? []) {
    if (cur.code && cur.name) {
      currencies[cur.code] = { name: cur.name, symbol: cur.symbol };
    }
  }

  const lat = obj.coordinates?.lat;
  const lng = obj.coordinates?.lng;

  return {
    name: {
      common: obj.names?.common ?? "Unknown",
      official: obj.names?.official ?? obj.names?.common ?? "Unknown",
    },
    cca2: obj.codes?.alpha_2,
    cca3: obj.codes?.alpha_3,
    capital: (obj.capitals ?? []).map((c) => c.name).filter(Boolean) as string[],
    region: obj.region,
    subregion: obj.subregion,
    population: obj.population,
    area: obj.area?.kilometers,
    languages: Object.keys(languages).length ? languages : undefined,
    currencies: Object.keys(currencies).length ? currencies : undefined,
    timezones: obj.timezones,
    borders: obj.borders,
    flags: {
      png: obj.flag?.url_png,
      svg: obj.flag?.url_svg,
    },
    maps: obj.links?.google_maps ? { googleMaps: obj.links.google_maps } : undefined,
    latlng: lat != null && lng != null ? [lat, lng] : undefined,
  };
}

async function fetchV5(url: string, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchV5Json(url: string, apiKey: string): Promise<V5Object[]> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);
    try {
      const res = await fetchV5(url, apiKey);
      const payload = (await res.json()) as unknown;
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error(`REST Countries v5 HTTP ${res.status}`);
      }
      return extractV5Objects(payload);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt >= MAX_RETRIES) break;
    }
  }
  throw lastError ?? new Error("REST Countries v5 request failed");
}

function searchLocalCountries(query: string, allCache?: Country[]): Country[] {
  const normalized = normalizeCountryQuery(query);
  const demo = searchFallbackCountries(normalized);
  if (demo.length) return demo;

  const q = normalized.toLowerCase();
  const pool = allCache ?? FALLBACK_COUNTRIES;
  return pool.filter(
    (c) =>
      c.name.common.toLowerCase().includes(q) ||
      c.name.official.toLowerCase().includes(q) ||
      c.cca2?.toLowerCase() === q ||
      c.cca3?.toLowerCase() === q,
  );
}

/** Fetch all countries — v5 when keyed, otherwise bundled reference data. */
export async function fetchAllCountries(): Promise<{ countries: Country[]; source: CountriesFetchSource }> {
  const apiKey = readRestCountriesApiKey();
  if (!apiKey) {
    return { countries: FALLBACK_COUNTRIES, source: "local" };
  }

  try {
    const all: Country[] = [];
    let offset = 0;
    const limit = 100;

    while (offset < 400) {
      const url =
        `${V5_BASE}?limit=${limit}&offset=${offset}` +
        `&response_fields=${encodeURIComponent(RESPONSE_FIELDS)}`;
      const batch = await fetchV5Json(url, apiKey);
      if (!batch.length) break;
      all.push(...batch.map(mapV5ToCountry));
      if (batch.length < limit) break;
      offset += limit;
    }

    if (all.length === 0) {
      return { countries: FALLBACK_COUNTRIES, source: "local" };
    }
    return { countries: all, source: "live" };
  } catch {
    return { countries: FALLBACK_COUNTRIES, source: "local" };
  }
}

/** Search countries by name — v5 when keyed, otherwise bundled reference data. */
export async function searchCountriesByName(
  rawQuery: string,
  allCache?: Country[],
): Promise<{ countries: Country[]; source: CountriesFetchSource }> {
  const query = normalizeCountryQuery(rawQuery);
  if (!query) return { countries: [], source: "local" };

  const apiKey = readRestCountriesApiKey();
  if (!apiKey) {
    const local = searchLocalCountries(query, allCache);
    return { countries: local, source: "local" };
  }

  try {
    const encoded = encodeURIComponent(query);
    let objects = await fetchV5Json(
      `${V5_BASE}/names.common/${encoded}?response_fields=${encodeURIComponent(RESPONSE_FIELDS)}`,
      apiKey,
    );

    if (!objects.length) {
      objects = await fetchV5Json(
        `${V5_BASE}?q=${encoded}&limit=10&response_fields=${encodeURIComponent(RESPONSE_FIELDS)}`,
        apiKey,
      );
    }

    if (objects.length) {
      return { countries: objects.map(mapV5ToCountry), source: "live" };
    }
  } catch {
    /* fall through to local */
  }

  const local = searchLocalCountries(query, allCache);
  return { countries: local, source: local.length ? "local" : "local" };
}
