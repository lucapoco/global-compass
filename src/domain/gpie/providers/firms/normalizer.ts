/**
 * NASA FIRMS active-fire CSV row → GlobalEvent.
 *
 * Row shape: latitude, longitude, brightness, scan, track, acq_date,
 * acq_time, satellite, confidence, version, bright_t31, frp, daynight.
 *
 * `confidence` is "l"/"n"/"h" (VIIRS) or a 0-100 number (MODIS).
 * `frp` (Fire Radiative Power, MW) is the best available intensity proxy —
 * used together with confidence to derive severity.
 */
import { createGlobalEvent, type GlobalEvent, type GlobalEventSeverity } from "@/domain/models/GlobalEvent";
import { tokenize } from "@/domain/utils/text";

export type FirmsRow = Record<string, string>;

function parseConfidence(raw: string | undefined): number {
  if (!raw) return 50;
  const lower = raw.trim().toLowerCase();
  if (lower === "h") return 90;
  if (lower === "n") return 60;
  if (lower === "l") return 30;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 50;
}

function severityFromFire(frp: number, confidence: number): GlobalEventSeverity {
  if (frp >= 100 && confidence >= 70) return "critical";
  if (frp >= 40) return "high";
  if (frp >= 10) return "medium";
  return "low";
}

export function normalizeFirmsRow(row: FirmsRow): GlobalEvent | null {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const frp = Number(row.frp) || 0;
  const confidence = parseConfidence(row.confidence);
  const severity = severityFromFire(frp, confidence);

  const acqDate = row.acq_date;
  const acqTime = (row.acq_time ?? "0000").padStart(4, "0");
  const timestamp = acqDate
    ? new Date(`${acqDate}T${acqTime.slice(0, 2)}:${acqTime.slice(2, 4)}:00Z`).toISOString()
    : new Date().toISOString();

  return createGlobalEvent({
    id: `firms-${lat.toFixed(4)}-${lng.toFixed(4)}-${acqDate}-${acqTime}`,
    title: `Active fire detected — ${lat.toFixed(2)}, ${lng.toFixed(2)}`,
    description: `Satellite-detected fire hotspot (${row.satellite ?? "unknown satellite"}). Radiative power ${frp.toFixed(1)} MW.`,
    category: "disaster",
    subCategory: "wildfire",
    severity,
    source: "NASA FIRMS",
    provider: "nasa_firms",
    coordinates: { lat, lng },
    timestamp,
    tags: tokenize(`wildfire fire hotspot satellite ${row.satellite ?? ""}`).slice(0, 6),
    status: "live",
    live: true,
    verified: true,
    metadata: {
      brightness: Number(row.brightness) || undefined,
      frp,
      confidence,
      satellite: row.satellite,
      daynight: row.daynight,
    },
  });
}

export function normalizeFirmsBatch(rows: FirmsRow[]): GlobalEvent[] {
  return rows.map(normalizeFirmsRow).filter((e): e is GlobalEvent => e !== null);
}
