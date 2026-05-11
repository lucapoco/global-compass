import type { Country } from "@/types";

const BASE = "https://restcountries.com/v3.1";
const FIELDS = "name,cca2,cca3,capital,region,subregion,population,area,languages,currencies,timezones,borders,flags,maps,latlng";

export async function searchCountryByName(name: string): Promise<Country[]> {
  const res = await fetch(`${BASE}/name/${encodeURIComponent(name)}?fields=${FIELDS}`);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`Country search failed (${res.status})`);
  }
  return res.json();
}

export async function getAllCountries(): Promise<Country[]> {
  const res = await fetch(`${BASE}/all?fields=name,cca2,population,region,capital,flags,latlng`);
  if (!res.ok) throw new Error(`Country list failed (${res.status})`);
  return res.json();
}
