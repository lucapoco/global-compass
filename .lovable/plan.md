# Global Pulse — Monitoring Upgrade

This is a large, multi-phase change. I'll keep the existing structure (TanStack routes, services, GNews proxy at `/api/public/gnews-proxy`) and layer new functionality on top — no rebuild.

## Phase 1 — Dashboard upgrade

**New top status bar** (`src/components/dashboard/StatusBar.tsx`)
- Title + subtitle, global data-mode badge (LIVE / CACHED / DEMO / RATE LIMITED / ERROR), last-updated, global Refresh button (60 s cooldown, shared with newsApi lock), API Health shortcut.

**Re-laid-out grid** in `src/routes/index.tsx`:
- Row 1: Map preview (left, links to `/map`) · Live Intelligence Feed (middle, 6 items) · Country Risk (right).
- Row 2: Live Video Monitor · Critical Signals.
- Row 3: Category Distribution chart · API Health · World Activity Timeline.
- Row 4: Quick nav cards (kept).

**New components**
- `LiveIntelligencePanel.tsx` — 6 latest items via `fetchIntelligence`, shows status badge, Open / Save / Details / Refresh.
- `CriticalSignalsPanel.tsx` — critical+high intel, M≥5 quakes, saved critical alerts.
- `CategoryDistributionChart.tsx` — Recharts bar of intel categories.
- `WorldActivityTimeline.tsx` — merged feed (quakes + intel + saved alerts), sorted by time.

All read from a new `dashboardService.ts` so Dashboard makes ONE coordinated fetch (no duplicate news/quake/country calls).

## Phase 2 — Live Video Monitor

- `src/data/videoSources.ts` — curated public YouTube live embeds (NASA ISS live, news live streams, weather cams, city cams). Easy to swap.
- `src/components/video/LiveVideoPanel.tsx` — one main `<iframe>` (lazy, muted, no autoplay-with-sound), source selector grid, LIVE/provider badges, Open source + Fullscreen buttons. Only the selected iframe is rendered.
- `VideoSourceCard.tsx`, `VideoSourceSelector.tsx`.

## Phase 3 — Map control center (`src/routes/map.tsx`)

Keep existing Mapbox/MapLibre `ProfessionalWorldMap`. Add:
- **Toolbar**: Refresh · Reset view · Fullscreen · Toggle side panel · Toggle heatmap (translucent large markers fallback) · Toggle clusters (disabled w/ tooltip if not wired) · High-severity-only · Clear filters.
- **Layer toggles**: earthquakes, intelligence, saved alerts, demo weather, countries, risk zones.
- **Severity chips**: All / Critical / High / Medium / Low.
- **Category chips**: 12 categories from spec.
- **Search box**: filters events; if matches a country, fly to its capital (REST Countries `latlng`).
- **Event side panel**: list of currently-visible events with Locate / Details / Save / Open source.
- **Improved popups** + **legend**.

Side-panel ↔ map sync via shared filter state + a `flyTo(lat,lng)` ref exposed by `ProfessionalWorldMap`.

## Phase 4 — Wire up every button

Audit pass across Dashboard, Intelligence, Map, Countries, Earthquakes, Weather, Saved, About. Any button that can't be implemented gets `disabled` + tooltip explaining why. Specifics:
- Save buttons → `supabaseService.saveIntelligence` / `saveAlert` (table `saved_intelligence` already exists).
- Open source → `window.open(url, '_blank', 'noopener')`.
- Details → existing `IntelligenceDetailsModal`.
- Map Locate → `flyTo`.
- Saved page: add delete-saved-intelligence + refresh.

## Phase 5 — Stability, cache, audit

- Confirm zero `gnews.io` references outside `src/routes/api/public/gnews-proxy.ts`.
- `dashboardService` deduplicates per-page fetches.
- Skeletons / empty / error states on all new panels.
- Dev-only debug: extend `GNewsDebugPanel` with cache age + proxy reachable + last successful update; small map debug overlay (visible events count, active filters); video debug (selected source, iframe loaded). All gated by `import.meta.env.DEV`.
- Mobile: panels stack to single column < `lg`.

## Files I'll create

```
src/components/dashboard/StatusBar.tsx
src/components/dashboard/LiveIntelligencePanel.tsx
src/components/dashboard/CriticalSignalsPanel.tsx
src/components/dashboard/CategoryDistributionChart.tsx
src/components/dashboard/WorldActivityTimeline.tsx
src/components/dashboard/MapPreview.tsx
src/components/video/LiveVideoPanel.tsx
src/components/video/VideoSourceCard.tsx
src/components/video/VideoSourceSelector.tsx
src/components/map/MapToolbar.tsx
src/components/map/MapSidePanel.tsx
src/components/map/MapSearchBox.tsx
src/data/videoSources.ts
src/services/dashboardService.ts
```

## Files I'll edit

```
src/routes/index.tsx                  — new layout
src/routes/map.tsx                    — toolbar, side panel, search, fullscreen
src/routes/saved.tsx                  — add saved-intel delete + refresh
src/components/map/ProfessionalWorldMap.tsx  — expose flyTo, heatmap toggle
src/components/map/MapFilters.tsx     — extend with severity + categories
src/components/dashboard/ApiHealthPanel.tsx  — add Mapbox row, real refresh
src/components/debug/GNewsDebugPanel.tsx     — proxy reachable + last success
src/services/newsApi.ts               — expose cache-age + last-success getters
src/services/supabaseService.ts       — saveIntelligence / deleteIntelligence
src/types/index.ts                    — GlobalEvent + VideoSource types
```

## Out of scope / risks
- `saved_intelligence` table already exists with the right columns and public RLS — no migration needed.
- Real heatmap/clustering needs Mapbox-specific layer code; if `ProfessionalWorldMap` uses MapLibre fallback, I'll implement the translucent-marker simulation and disable the cluster button with a tooltip in fallback mode.
- Video sources will be safe public YouTube embeds (NASA ISS, etc.). You can swap URLs in `videoSources.ts`.
- I will NOT touch `client.ts`, `types.ts`, `.env`, or `routeTree.gen.ts`.

## Approximate size
~14 new files, ~10 edits. One big turn. After approval I'll implement straight through and end with the requested audit summary.
