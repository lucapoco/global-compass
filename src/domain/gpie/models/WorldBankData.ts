/**
 * World Bank Indicator Models
 *
 * Typed interfaces for macroeconomic and development data fetched from the
 * World Bank Open Data API (https://datahelpdesk.worldbank.org/knowledgebase/articles/889392).
 *
 * All indicator values are nullable — historical data may be missing for
 * some countries or time periods.
 */

/** Raw single-indicator response from the World Bank v2 REST API. */
export interface WorldBankIndicatorResponse {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
  unit: string;
  obs_status: string;
  decimal: number;
}

/** Catalogue of World Bank indicator codes used by the GPIE. */
export const WB_INDICATORS = {
  GDP: "NY.GDP.MKTP.CD",               // GDP (current US$)
  GDP_PER_CAPITA: "NY.GDP.PCAP.CD",    // GDP per capita (current US$)
  POPULATION: "SP.POP.TOTL",           // Population, total
  INFLATION: "FP.CPI.TOTL.ZG",         // Inflation, consumer prices (% annual)
  LIFE_EXPECTANCY: "SP.DYN.LE00.IN",   // Life expectancy at birth (years)
  CO2: "EN.ATM.CO2E.PC",               // CO2 emissions (metric tons per capita)
  ENERGY_USE: "EG.USE.PCAP.KG.OE",     // Energy use (kg oil equivalent per capita)
  INTERNET_USAGE: "IT.NET.USER.ZS",    // Individuals using the Internet (%)
  GOV_EFFECTIVENESS: "GE.EST",         // Government Effectiveness (−2.5 to +2.5)
  UNEMPLOYMENT: "SL.UEM.TOTL.ZS",      // Unemployment, total (% of labour force)
} as const;

export type WbIndicatorKey = keyof typeof WB_INDICATORS;

/** Normalised country economic profile produced by the World Bank service. */
export interface WorldBankIndicators {
  /** ISO 2-letter country code as provided to the query (may differ from WB ISO-3). */
  countryCode: string;
  /** Display name returned by the World Bank API. */
  countryName: string | null;

  /** GDP in current US dollars (can be very large). */
  gdpCurrentUSD: number | null;
  /** GDP per capita in current US dollars. */
  gdpPerCapitaUSD: number | null;
  /** Total population. */
  population: number | null;
  /** Annual consumer price inflation rate (%). */
  inflationPct: number | null;
  /** Life expectancy at birth, both sexes (years). */
  lifeExpectancy: number | null;
  /** CO2 emissions in metric tons per capita. */
  co2EmissionsPerCapita: number | null;
  /** Energy use in kg of oil equivalent per capita. */
  energyUsePerCapita: number | null;
  /** Share of population using the Internet (%). */
  internetUsagePct: number | null;
  /** World Bank Government Effectiveness estimate (−2.5 to +2.5). */
  govEffectivenessScore: number | null;
  /** Unemployment rate (% of total labour force). */
  unemploymentPct: number | null;

  /** Most recent data year across all indicators. */
  dataYear: number | null;
  /** Unix timestamp (ms) when these indicators were fetched. */
  fetchedAt: number;
}

/** Lightweight summary used by the country intelligence profile header. */
export interface WorldBankSummary {
  gdpFormatted: string;    // e.g. "$1.4T" or "$342B"
  populationFormatted: string; // e.g. "83M"
  inflationFormatted: string;  // e.g. "4.2%"
  lifeExpectancy: number | null;
  internetPct: number | null;
  dataYear: number | null;
}

export function formatGDP(gdp: number | null): string {
  if (gdp === null) return "N/A";
  if (gdp >= 1e12) return `$${(gdp / 1e12).toFixed(1)}T`;
  if (gdp >= 1e9) return `$${(gdp / 1e9).toFixed(1)}B`;
  if (gdp >= 1e6) return `$${(gdp / 1e6).toFixed(1)}M`;
  return `$${gdp.toFixed(0)}`;
}

export function formatPopulation(pop: number | null): string {
  if (pop === null) return "N/A";
  if (pop >= 1e9) return `${(pop / 1e9).toFixed(2)}B`;
  if (pop >= 1e6) return `${(pop / 1e6).toFixed(1)}M`;
  if (pop >= 1e3) return `${(pop / 1e3).toFixed(0)}K`;
  return String(pop);
}

export function summariseWorldBankData(data: WorldBankIndicators): WorldBankSummary {
  return {
    gdpFormatted: formatGDP(data.gdpCurrentUSD),
    populationFormatted: formatPopulation(data.population),
    inflationFormatted: data.inflationPct !== null ? `${data.inflationPct.toFixed(1)}%` : "N/A",
    lifeExpectancy: data.lifeExpectancy,
    internetPct: data.internetUsagePct,
    dataYear: data.dataYear,
  };
}
