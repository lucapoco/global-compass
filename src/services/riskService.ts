import type { CountryRisk, Earthquake, IntelligenceItem, SavedAlert, Severity } from "@/types";

// Explainable Country Risk Index
// Formula (cap at 100):
//  +20 per critical intelligence item
//  +12 per high item
//  +6  per medium item
//  +2  per low item
//  +25 if any earthquake mag >= 6 in the country/region
//  +15 if any earthquake mag >= 5
//  +15 per saved alert with severity Critical
export const RISK_WEIGHTS = {
  critical: 20,
  high: 12,
  medium: 6,
  low: 2,
  quake6: 25,
  quake5: 15,
  savedCritical: 15,
} as const;

function severityFromScore(score: number): Severity {
  if (score >= 60) return "Critical";
  if (score >= 35) return "High";
  if (score >= 15) return "Medium";
  return "Low";
}

interface BuildArgs {
  intel: IntelligenceItem[];
  quakes: Earthquake[];
  saved: SavedAlert[];
}

export function buildCountryRiskIndex({ intel, quakes, saved }: BuildArgs): CountryRisk[] {
  const map = new Map<string, { score: number; factors: Map<string, number> }>();

  const bump = (country: string, label: string, amount: number) => {
    if (!country) return;
    const entry = map.get(country) ?? { score: 0, factors: new Map() };
    entry.score += amount;
    entry.factors.set(label, (entry.factors.get(label) ?? 0) + 1);
    map.set(country, entry);
  };

  for (const it of intel) {
    if (!it.country) continue;
    const w = RISK_WEIGHTS[it.severity];
    bump(it.country, `${it.severity} intel`, w);
  }

  for (const q of quakes) {
    // Try to extract a country-ish token from the place string (e.g. "10km E of Tokyo, Japan")
    const tail = q.place?.split(",").pop()?.trim();
    if (!tail) continue;
    if (q.magnitude >= 6) bump(tail, "M6+ earthquake", RISK_WEIGHTS.quake6);
    else if (q.magnitude >= 5) bump(tail, "M5+ earthquake", RISK_WEIGHTS.quake5);
  }

  for (const s of saved) {
    if (s.severity === "Critical" && s.location) {
      bump(s.location, "saved critical alert", RISK_WEIGHTS.savedCritical);
    }
  }

  const list: CountryRisk[] = [];
  for (const [country, { score, factors }] of map.entries()) {
    const capped = Math.min(100, score);
    const f: string[] = [];
    for (const [k, n] of factors.entries()) f.push(n > 1 ? `${n}× ${k}` : k);
    list.push({ country, score: capped, label: severityFromScore(capped), factors: f });
  }

  return list.sort((a, b) => b.score - a.score).slice(0, 10);
}
