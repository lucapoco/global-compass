import type { GlobalEvent } from "@/domain/models/GlobalEvent";
import { normalizeTitleKey } from "@/domain/utils/text";

/**
 * Removes exact duplicates (same id) and near-duplicates (same provider + normalized
 * title) that can appear when a provider is re-loaded or two normalizers describe
 * the same underlying record (e.g. a saved copy of a live GNews item).
 */
export function dedupeEvents(events: GlobalEvent[]): GlobalEvent[] {
  const byId = new Set<string>();
  const byTitleProvider = new Set<string>();
  const out: GlobalEvent[] = [];

  for (const event of events) {
    if (byId.has(event.id)) continue;
    const titleKey = `${event.provider}:${normalizeTitleKey(event.title)}`;
    if (event.title && byTitleProvider.has(titleKey)) continue;

    byId.add(event.id);
    if (event.title) byTitleProvider.add(titleKey);
    out.push(event);
  }

  return out;
}
