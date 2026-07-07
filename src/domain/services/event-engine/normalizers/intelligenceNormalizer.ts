import type { IntelligenceItem, SavedIntelligence } from "@/types";
import { createGlobalEvent, type GlobalEvent, type GlobalEventStatus } from "@/domain/models/GlobalEvent";
import { toIsoOrNow } from "@/domain/utils/time";
import { tokenize } from "@/domain/utils/text";

/** GNews (via `newsApi.fetchIntelligence`) → GlobalEvent. */
export function normalizeIntelligenceItem(item: IntelligenceItem, status: GlobalEventStatus): GlobalEvent {
  const coordinates =
    typeof item.latitude === "number" && typeof item.longitude === "number"
      ? { lat: item.latitude, lng: item.longitude }
      : undefined;

  return createGlobalEvent({
    id: `gnews-${item.id}`,
    title: item.title,
    description: item.description,
    category: item.category,
    severity: item.severity,
    source: item.source,
    sourceUrl: item.url,
    provider: "gnews",
    country: item.country,
    locationName: item.country,
    coordinates,
    timestamp: toIsoOrNow(item.publishedAt),
    image: item.imageUrl,
    tags: tokenize(`${item.title} ${item.category}`).slice(0, 6),
    status,
    live: status === "live",
    verified: status === "live",
    metadata: { originalId: item.id },
  });
}

/** Supabase `saved_intelligence` (a user-bookmarked GNews item) → GlobalEvent. */
export function normalizeSavedIntelligence(item: SavedIntelligence): GlobalEvent {
  return createGlobalEvent({
    id: `saved-intel-${item.id}`,
    title: item.title,
    description: item.description ?? undefined,
    category: (item.category as GlobalEvent["category"]) ?? "general",
    severity: (item.severity as GlobalEvent["severity"]) ?? "low",
    source: item.source ?? "Supabase",
    sourceUrl: item.url ?? undefined,
    provider: "supabase_intelligence",
    country: item.country ?? undefined,
    locationName: item.country ?? undefined,
    timestamp: toIsoOrNow(item.published_at ?? item.created_at),
    image: item.image_url ?? undefined,
    tags: tokenize(item.title).slice(0, 6),
    status: "cached",
    live: false,
    verified: true,
    metadata: { originalId: item.id, savedAt: item.created_at },
  });
}
