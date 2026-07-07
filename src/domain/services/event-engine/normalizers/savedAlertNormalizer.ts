import type { SavedAlert } from "@/types";
import { createGlobalEvent, type GlobalEvent } from "@/domain/models/GlobalEvent";
import { toIsoOrNow } from "@/domain/utils/time";
import { tokenize } from "@/domain/utils/text";

function alertTypeToCategory(type: string | undefined): GlobalEvent["category"] {
  const t = (type ?? "").toLowerCase();
  if (t.includes("weather")) return "weather";
  if (t.includes("earthquake") || t.includes("quake")) return "earthquake";
  if (t.includes("military")) return "military";
  if (t.includes("economy")) return "economy";
  if (t.includes("cyber")) return "cyber";
  return "general";
}

function parseLatLng(location?: string | null): { lat: number; lng: number } | undefined {
  const m = location?.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
}

/** Supabase `saved_alerts` (user-bookmarked alert) → GlobalEvent. */
export function normalizeSavedAlert(alert: SavedAlert): GlobalEvent {
  return createGlobalEvent({
    id: `saved-alert-${alert.id}`,
    title: alert.title,
    description: alert.description ?? undefined,
    category: alertTypeToCategory(alert.type),
    severity: (alert.severity?.toLowerCase() as GlobalEvent["severity"]) ?? "low",
    source: alert.source ?? "Supabase",
    provider: "supabase_alerts",
    locationName: alert.location ?? undefined,
    coordinates: parseLatLng(alert.location),
    timestamp: toIsoOrNow(alert.created_at),
    tags: tokenize(alert.title).slice(0, 6),
    status: "cached",
    live: false,
    verified: true,
    metadata: { originalId: alert.id, type: alert.type },
  });
}
