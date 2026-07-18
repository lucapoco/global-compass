/**
 * Country Comparator
 *
 * Generates a structured side-by-side comparison of two countries
 * based exclusively on data already available on the platform.
 *
 * Compared dimensions:
 *   • Stability score
 *   • Risk score
 *   • Total event count
 *   • Critical + high event counts
 *   • Per-category activity (military, disaster, economy, etc.)
 *   • World Bank GDP per capita (if available)
 *   • World Bank population (if available)
 *   • Earthquake activity
 *   • Weather/climate events
 *   • Recent event volume (last 24h)
 *
 * The comparison conclusion is data-driven (not AI-generated here) and
 * describes which country shows higher instability signals and why.
 * The AI chat layer can enrich the conclusion separately.
 */
import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import type { CountryComparison, CountryComparisonMetric } from "../models/ReportModel";
import { computeCountryStabilityIndex } from "../stability/stabilityEngine";
import type { WorldBankIndicators } from "@/domain/gpie/models/WorldBankData";

// ─── Helper ───────────────────────────────────────────────────────────────────

type Winner = "a" | "b" | "tie" | "unknown";

function filterCountry(events: GlobalEvent[], name: string): GlobalEvent[] {
  return events.filter((e) => {
    if (!e.country) return false;
    const t = name.toLowerCase();
    const s = e.country.toLowerCase();
    return s === t || s.includes(t) || t.includes(s);
  });
}

function metricWinner(
  valueA: number | null,
  valueB: number | null,
  higherIsWorse = true,
): Winner {
  if (valueA === null || valueB === null) return "unknown";
  if (valueA === valueB) return "tie";
  return higherIsWorse
    ? (valueA < valueB ? "a" : "b")   // fewer problems = winner
    : (valueA > valueB ? "a" : "b");  // higher value = winner
}

function fmtNum(n: number | null): string {
  if (n === null) return "N/A";
  return n.toLocaleString("en-US");
}

function fmtMoney(n: number | null): string {
  if (n === null) return "N/A";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  return `$${(n / 1e6).toFixed(0)}M`;
}

const HOUR24 = 86_400_000;

// ─── Build metrics ────────────────────────────────────────────────────────────

function buildMetrics(
  evA: GlobalEvent[],
  evB: GlobalEvent[],
  stabilityA: number,
  stabilityB: number,
  wbA: WorldBankIndicators | null,
  wbB: WorldBankIndicators | null,
): CountryComparisonMetric[] {
  const now = Date.now();
  const metrics: CountryComparisonMetric[] = [];

  // Stability score (higher is better → lowerIsWorse applies inverse)
  metrics.push({
    label: "Stability Score",
    valueA: stabilityA,
    valueB: stabilityB,
    winner: metricWinner(stabilityA, stabilityB, false),
    explanation: `Stability is based on the GSI algorithm (0–100). Higher = more stable.`,
  });

  // Critical events
  const critA = evA.filter((e) => e.severity === "critical").length;
  const critB = evB.filter((e) => e.severity === "critical").length;
  metrics.push({
    label: "Critical Events",
    valueA: critA,
    valueB: critB,
    winner: metricWinner(critA, critB, true),
    explanation: "Number of critical-severity events attributed to each country.",
  });

  // High events
  const hiA = evA.filter((e) => e.severity === "high").length;
  const hiB = evB.filter((e) => e.severity === "high").length;
  metrics.push({
    label: "High-Severity Events",
    valueA: hiA,
    valueB: hiB,
    winner: metricWinner(hiA, hiB, true),
    explanation: "Number of high-severity events attributed to each country.",
  });

  // Military events
  const milA = evA.filter((e) => e.category === "military" || e.provider === "acled").length;
  const milB = evB.filter((e) => e.category === "military" || e.provider === "acled").length;
  metrics.push({
    label: "Military Activity",
    valueA: milA,
    valueB: milB,
    winner: metricWinner(milA, milB, true),
    explanation: "Armed conflict and military events from ACLED and news sources.",
  });

  // Earthquake activity
  const eqA = evA.filter((e) => e.category === "earthquake").length;
  const eqB = evB.filter((e) => e.category === "earthquake").length;
  metrics.push({
    label: "Earthquake Events",
    valueA: eqA,
    valueB: eqB,
    winner: metricWinner(eqA, eqB, true),
    explanation: "Seismic events from USGS attributed to each country.",
  });

  // Natural disasters
  const disA = evA.filter((e) => e.category === "disaster" || e.provider === "nasa_eonet").length;
  const disB = evB.filter((e) => e.category === "disaster" || e.provider === "nasa_eonet").length;
  metrics.push({
    label: "Natural Disasters",
    valueA: disA,
    valueB: disB,
    winner: metricWinner(disA, disB, true),
    explanation: "Natural disaster events from NASA EONET and news.",
  });

  // 24h activity
  const act24A = evA.filter((e) => now - new Date(e.timestamp).getTime() <= HOUR24).length;
  const act24B = evB.filter((e) => now - new Date(e.timestamp).getTime() <= HOUR24).length;
  metrics.push({
    label: "Activity (last 24h)",
    valueA: act24A,
    valueB: act24B,
    winner: metricWinner(act24A, act24B, true),
    explanation: "Total events published in the last 24 hours for each country.",
  });

  // Total events
  metrics.push({
    label: "Total Events on Platform",
    valueA: evA.length,
    valueB: evB.length,
    winner: "unknown",
    explanation: "Total number of events attributed to each country in the current event pool.",
  });

  // World Bank metrics (if available)
  if (wbA?.gdpPerCapitaUSD !== undefined || wbB?.gdpPerCapitaUSD !== undefined) {
    metrics.push({
      label: "GDP per Capita",
      valueA: wbA?.gdpPerCapitaUSD != null ? fmtMoney(wbA.gdpPerCapitaUSD) : "N/A",
      valueB: wbB?.gdpPerCapitaUSD != null ? fmtMoney(wbB.gdpPerCapitaUSD) : "N/A",
      winner: metricWinner(wbA?.gdpPerCapitaUSD ?? null, wbB?.gdpPerCapitaUSD ?? null, false),
      explanation: "World Bank GDP per capita in USD (latest available year).",
    });
  }

  if (wbA?.population !== undefined || wbB?.population !== undefined) {
    metrics.push({
      label: "Population",
      valueA: wbA?.population != null ? fmtNum(wbA.population) : "N/A",
      valueB: wbB?.population != null ? fmtNum(wbB.population) : "N/A",
      winner: "unknown",
      explanation: "World Bank total population (latest available year).",
    });
  }

  return metrics;
}

// ─── Conclusion generator ────────────────────────────────────────────────────

function buildConclusion(
  countryA: string,
  countryB: string,
  metrics: CountryComparisonMetric[],
  stabilityA: number,
  stabilityB: number,
): string {
  const winsA = metrics.filter((m) => m.winner === "a").length;
  const winsB = metrics.filter((m) => m.winner === "b").length;

  const stabDiff = Math.abs(stabilityA - stabilityB);
  const leader = stabilityA >= stabilityB ? countryA : countryB;
  const trailer = stabilityA >= stabilityB ? countryB : countryA;

  let conclusion = "";
  if (stabDiff < 5) {
    conclusion = `${countryA} and ${countryB} show similar stability levels (${stabilityA} vs ${stabilityB}). `;
  } else {
    conclusion = `${leader} shows higher current stability (score ${Math.max(stabilityA, stabilityB)}) compared to ${trailer} (score ${Math.min(stabilityA, stabilityB)}). `;
  }

  if (winsA > winsB) {
    conclusion += `${countryA} has fewer concerning signals across ${winsA} of ${metrics.length} measured dimensions. `;
  } else if (winsB > winsA) {
    conclusion += `${countryB} has fewer concerning signals across ${winsB} of ${metrics.length} measured dimensions. `;
  } else {
    conclusion += `Both countries show comparable signal levels across measured dimensions. `;
  }

  conclusion += `This comparison reflects data currently available on the Global Pulse platform — it is not a comprehensive geopolitical assessment.`;

  return conclusion;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function compareCountries(
  events: GlobalEvent[],
  countryA: string,
  countryB: string,
  worldBankA: WorldBankIndicators | null = null,
  worldBankB: WorldBankIndicators | null = null,
): CountryComparison {
  const evA = filterCountry(events, countryA);
  const evB = filterCountry(events, countryB);

  const csiA = computeCountryStabilityIndex(events, countryA);
  const csiB = computeCountryStabilityIndex(events, countryB);

  const metrics = buildMetrics(evA, evB, csiA.score, csiB.score, worldBankA, worldBankB);
  const conclusion = buildConclusion(countryA, countryB, metrics, csiA.score, csiB.score);

  return {
    countryA,
    countryB,
    metrics,
    stabilityScoreA: csiA.score,
    stabilityScoreB: csiB.score,
    eventCountA: evA.length,
    eventCountB: evB.length,
    conclusion,
    generatedAt: new Date().toISOString(),
  };
}
