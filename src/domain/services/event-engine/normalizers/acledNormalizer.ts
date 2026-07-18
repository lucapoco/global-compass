/**
 * ACLED Normalizer
 *
 * Maps raw Armed Conflict Location & Event Data (ACLED) records into the
 * unified GlobalEvent domain model.
 *
 * ACLED API reference: https://apidocs.acleddata.com/
 *
 * Severity algorithm:
 *   Critical  → Battles OR Violence against civilians OR fatalities > 100
 *   High      → Explosions / remote violence OR fatalities 11–100
 *   Medium    → Riots OR fatalities 1–10
 *   Low       → Protests, strategic developments, zero fatalities
 *
 * Category mapping:
 *   Battles / Violence / Explosions → "military"
 *   Protests / Riots / Strategic    → "geopolitics"
 */
import { createGlobalEvent, type GlobalEvent, type GlobalEventCategory, type GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { tokenize } from "@/domain/utils/text";

/* ── Raw ACLED shape ─────────────────────────────────────────────────────── */

export interface AcledRawEvent {
  event_id_cnty: string;
  event_date: string;       // "YYYY-MM-DD"
  year?: string;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  actor2?: string;
  assoc_actor_1?: string;
  country: string;
  iso?: string;
  admin1?: string;
  admin2?: string;
  location: string;
  latitude: string;
  longitude: string;
  geo_precision?: string;
  fatalities: string;
  notes: string;
  source?: string;
  source_scale?: string;
  timestamp?: string;
}

/* ── Lookup tables ───────────────────────────────────────────────────────── */

const EVENT_TYPE_TO_CATEGORY: Record<string, GlobalEventCategory> = {
  Battles: "military",
  "Violence against civilians": "military",
  "Explosions/Remote violence": "military",
  Protests: "geopolitics",
  Riots: "geopolitics",
  "Strategic developments": "geopolitics",
};

/* ── Severity logic ──────────────────────────────────────────────────────── */

function acledSeverity(fatalities: number, eventType: string): GlobalEventSeverity {
  if (fatalities > 100 || eventType === "Battles" || eventType === "Violence against civilians") {
    return "critical";
  }
  if (fatalities > 10 || eventType === "Explosions/Remote violence") {
    return "high";
  }
  if (fatalities > 0 || eventType === "Riots") {
    return "medium";
  }
  return "low";
}

/* ── Title builder ───────────────────────────────────────────────────────── */

function buildTitle(raw: AcledRawEvent): string {
  const actor2 = raw.actor2?.trim();
  const location = `${raw.location}${raw.admin1 ? `, ${raw.admin1}` : ""}`;

  const base = actor2
    ? `${raw.sub_event_type}: ${raw.actor1} vs ${actor2} — ${location}`
    : `${raw.sub_event_type}: ${raw.actor1} — ${location}`;

  return base.slice(0, 220);
}

/* ── Normalizer ──────────────────────────────────────────────────────────── */

/**
 * ACLED record → GlobalEvent.
 *
 * Fatality counts are embedded in metadata so the UI and scoring engine
 * can surface them, but the severity field already encodes the impact level.
 */
export function normalizeAcledEvent(raw: AcledRawEvent): GlobalEvent {
  const fatalities = parseInt(raw.fatalities, 10) || 0;
  const category = EVENT_TYPE_TO_CATEGORY[raw.event_type] ?? "geopolitics";
  const severity = acledSeverity(fatalities, raw.event_type);

  const lat = parseFloat(raw.latitude);
  const lng = parseFloat(raw.longitude);
  const coordinates =
    isFinite(lat) && isFinite(lng) ? { lat, lng } : undefined;

  const notes = raw.notes?.trim();
  const description = notes
    ? notes.slice(0, 500)
    : `${raw.event_type} — ${raw.country}`;

  const locationLabel = [raw.location, raw.admin1, raw.country]
    .filter(Boolean)
    .join(", ");

  return createGlobalEvent({
    id: `acled-${raw.event_id_cnty}`,
    title: buildTitle(raw),
    description,
    category,
    severity,
    source: "ACLED",
    sourceUrl: undefined,
    provider: "acled",
    country: raw.country,
    locationName: locationLabel,
    coordinates,
    timestamp: raw.event_date
      ? new Date(raw.event_date).toISOString()
      : new Date().toISOString(),
    tags: [
      raw.event_type,
      raw.sub_event_type,
      raw.country,
      ...tokenize(raw.actor1).slice(0, 2),
    ]
      .filter(Boolean)
      .map((t) => t.toLowerCase()),
    status: "live",
    live: true,
    verified: true,
    metadata: {
      originalId: raw.event_id_cnty,
      eventType: raw.event_type,
      subEventType: raw.sub_event_type,
      fatalities,
      actor1: raw.actor1,
      actor2: raw.actor2,
      admin1: raw.admin1,
      geoPrecision: raw.geo_precision,
      acledSource: raw.source,
    },
  });
}
