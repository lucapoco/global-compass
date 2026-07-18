/**
 * GDACS GeoJSON Feature → GlobalEvent.
 *
 * Verified property shape (see routes/api/public/gdacs-proxy.ts docblock):
 *   eventid, episodeid, eventtype (EQ|TC|FL|VO|DR|WF), name, alertlevel
 *   (Green|Orange|Red), alertscore, fromdate, todate, country, iso3, glide,
 *   severitydata: { severity, severitytext, severityunit }, url?: { report }
 */
import { createGlobalEvent, type GlobalEvent, type GlobalEventCategory, type GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { toIsoOrNow } from "@/domain/utils/time";
import { tokenize } from "@/domain/utils/text";

export interface GdacsFeature {
  type: "Feature";
  geometry?: { type: string; coordinates: [number, number] };
  properties: {
    eventid: number | string;
    episodeid?: number | string;
    eventtype: "EQ" | "TC" | "FL" | "VO" | "DR" | "WF" | string;
    name?: string;
    alertlevel?: "Green" | "Orange" | "Red" | string;
    alertscore?: number;
    fromdate?: string;
    todate?: string;
    country?: string;
    iso3?: string;
    glide?: string;
    severitydata?: { severity?: number; severitytext?: string; severityunit?: string };
    url?: { report?: string; details?: string };
  };
}

const EVENT_TYPE_MAP: Record<string, { category: GlobalEventCategory; subCategory: string }> = {
  EQ: { category: "earthquake", subCategory: "earthquake" },
  TC: { category: "weather", subCategory: "storm" },
  FL: { category: "disaster", subCategory: "flood" },
  VO: { category: "disaster", subCategory: "volcano" },
  DR: { category: "climate", subCategory: "drought" },
  WF: { category: "disaster", subCategory: "wildfire" },
};

function severityFromAlertLevel(level: string | undefined): GlobalEventSeverity {
  switch (level) {
    case "Red": return "critical";
    case "Orange": return "high";
    case "Green": return "medium";
    default: return "low";
  }
}

export function normalizeGdacsFeature(feature: GdacsFeature): GlobalEvent | null {
  const p = feature.properties;
  if (!p?.eventid) return null;

  const mapping = EVENT_TYPE_MAP[p.eventtype] ?? { category: "disaster" as const, subCategory: "other" };
  const [lng, lat] = feature.geometry?.coordinates ?? [];
  const coordinates = typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined;

  const title = p.name?.trim() || `${mapping.subCategory} event — ${p.country ?? "unknown location"}`;
  const severityText = p.severitydata?.severitytext ? ` (${p.severitydata.severitytext})` : "";

  return createGlobalEvent({
    id: `gdacs-${p.eventid}-${p.episodeid ?? "0"}`,
    title,
    description: `${mapping.subCategory} — alert level ${p.alertlevel ?? "unknown"}${severityText}`,
    category: mapping.category,
    subCategory: mapping.subCategory,
    severity: severityFromAlertLevel(p.alertlevel),
    source: "GDACS",
    sourceUrl: p.url?.report,
    provider: "gdacs",
    country: p.country,
    locationName: p.country,
    coordinates,
    timestamp: toIsoOrNow(p.fromdate),
    tags: tokenize(`${title} ${mapping.subCategory} disaster`).slice(0, 6),
    status: "live",
    live: true,
    verified: true,
    metadata: {
      eventId: p.eventid,
      episodeId: p.episodeid,
      eventType: p.eventtype,
      alertLevel: p.alertlevel,
      alertScore: p.alertscore,
      iso3: p.iso3,
      glide: p.glide,
      severity: p.severitydata?.severity,
      severityUnit: p.severitydata?.severityunit,
    },
  });
}

export function normalizeGdacsBatch(features: GdacsFeature[]): GlobalEvent[] {
  return features
    .map(normalizeGdacsFeature)
    .filter((e): e is GlobalEvent => e !== null);
}
