/**
 * ACLED Normalizer
 *
 * Maps raw ACLED API records (as returned by the server proxy at
 * `/api/acled/events`) into the unified Global Pulse `GlobalEvent` model.
 *
 * Every field extraction is null-safe. Missing coordinates, dates, or
 * notes produce sensible defaults rather than crashing.
 *
 * Extracted fields:
 *   event_id_cnty       → GlobalEvent.id
 *   event_date          → GlobalEvent.timestamp
 *   country + admin1    → GlobalEvent.country / locationName
 *   latitude/longitude  → GlobalEvent.coordinates
 *   actor1 + actor2     → GlobalEvent.title (constructed)
 *   event_type          → mapped to GlobalEvent.category via mapper.ts
 *   sub_event_type      → used in title and metadata
 *   fatalities          → severity + metadata.fatalities
 *   notes               → GlobalEvent.description
 *   source / scale      → GlobalEvent.source + confidence input
 */
import { createGlobalEvent, type GlobalEvent } from "@/domain/models/GlobalEvent";
import { tokenize } from "@/domain/utils/text";
import { mapAcledEvent } from "./mapper";
import type { AcledRawRecord } from "@/server/acled/client";

// ─── Title builder ────────────────────────────────────────────────────────────

function buildTitle(raw: AcledRawRecord, label: string): string {
  const location = [raw.location, raw.admin1].filter(Boolean).join(", ");
  const actor2 = raw.actor2?.trim();

  const base = actor2
    ? `${label}: ${raw.actor1} vs ${actor2} — ${location}`
    : `${label}: ${raw.actor1} — ${location}`;

  return base.slice(0, 220);
}

// ─── Coordinate extraction ────────────────────────────────────────────────────

function extractCoords(raw: AcledRawRecord): { lat: number; lng: number } | undefined {
  const lat = parseFloat(raw.latitude);
  const lng = parseFloat(raw.longitude);
  return isFinite(lat) && isFinite(lng) ? { lat, lng } : undefined;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

function parseDate(eventDate: string): string {
  if (!eventDate) return new Date().toISOString();
  // ACLED dates are "YYYY-MM-DD" — safe to append T00:00:00Z
  const ts = Date.parse(`${eventDate}T00:00:00Z`);
  return isNaN(ts) ? new Date().toISOString() : new Date(ts).toISOString();
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * AcledRawRecord → GlobalEvent
 *
 * The `confidence` field from the mapper replaces the default scoring engine
 * confidence for this event — it is embedded in `metadata` so that if the
 * scoring engine overwrites it, the original ACLED-sourced value is preserved.
 */
export function normalizeAcledRecord(raw: AcledRawRecord): GlobalEvent {
  const fatalities = parseInt(raw.fatalities, 10) || 0;

  const { category, severity, confidence, priority, label } = mapAcledEvent(
    raw.event_type,
    raw.sub_event_type,
    fatalities,
    raw.source_scale,
  );

  const coordinates = extractCoords(raw);

  const locationLabel = [raw.location, raw.admin1, raw.country]
    .filter(Boolean)
    .join(", ");

  const notes = raw.notes?.trim();
  const description = notes ? notes.slice(0, 500) : `${raw.event_type} — ${raw.country}`;

  const actorTags = tokenize(raw.actor1).slice(0, 2);
  const typeTags = [
    raw.event_type.toLowerCase(),
    raw.sub_event_type.toLowerCase(),
  ];

  return createGlobalEvent({
    id: `acled-${raw.event_id_cnty}`,
    title: buildTitle(raw, label),
    description,
    category,
    severity,
    source: "ACLED",
    sourceUrl: undefined,
    provider: "acled",
    country: raw.country,
    locationName: locationLabel,
    coordinates,
    timestamp: parseDate(raw.event_date),
    tags: [...typeTags, raw.country.toLowerCase(), ...actorTags].filter(Boolean),
    status: "live",
    live: true,
    verified: true,
    metadata: {
      originalId: raw.event_id_cnty,
      eventType: raw.event_type,
      subEventType: raw.sub_event_type,
      fatalities,
      actor1: raw.actor1,
      actor2: raw.actor2 ?? null,
      admin1: raw.admin1 ?? null,
      admin2: raw.admin2 ?? null,
      geoPrecision: raw.geo_precision ?? null,
      acledSource: raw.source ?? null,
      sourceScale: raw.source_scale ?? null,
      // Preserve ACLED-computed scores so downstream code can inspect them
      acledConfidence: confidence,
      acledPriority: priority,
    },
  });
}

/** Normalise a batch, silently skipping records that throw. */
export function normalizeAcledBatch(records: AcledRawRecord[]): GlobalEvent[] {
  const result: GlobalEvent[] = [];
  for (const r of records) {
    try {
      result.push(normalizeAcledRecord(r));
    } catch (e) {
      console.warn("[acledNormalizer] skipped malformed record:", r.event_id_cnty, e);
    }
  }
  return result;
}
