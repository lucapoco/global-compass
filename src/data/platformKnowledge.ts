/**
 * Cunoștințe compacte despre platformă pentru Global Pulse AI (context static Gemini).
 */
export const PLATFORM_KNOWLEDGE = `
## Global Pulse — platform overview
Global Pulse is an educational Planetary Intelligence dashboard for InfoEducație. It aggregates public feeds and optional Supabase persistence into one interface: live headlines, earthquakes, world map, country risk, alerts, knowledge graph, AI briefing, collections, and saved bookmarks.

**Stack:** React 19, TypeScript, Vite, TanStack Start / Router / Query, Tailwind, Mapbox GL, Recharts, XYFlow, Supabase (Auth + RLS), Nitro / Vercel. Data via same-origin server proxies: GNews, USGS, REST Countries, OpenWeather, ACLED, NASA FIRMS, GDACS, GDELT, ReliefWeb, RSS. Optional Google Gemini for AI.

## Main pages
- **Dashboard** — stats, live intelligence, map preview, country risk, API health (advanced), timeline.
- **Mission Control** (/mission-control) — command-center operational view.
- **Intelligence Feed** (/intelligence) — GNews headlines with category/severity filters.
- **Global Pulse AI** (/ai-news) — this assistant; explains news and the app using in-app data only.
- **Live World Map** (/map) — Mapbox globe: earthquakes, intelligence, alerts, weather, capitals.
- **Alert Center** (/alert-center) — severity, correlation, crisis detection, watchlists.
- **Knowledge Graph** (/knowledge-graph) — relationships between events, countries, topics.
- **Countries / Compare / Earthquakes / Weather** — reference and live feeds.
- **Reports** — country / event / global briefings (Gemini optional).
- **Saved Articles, Collections, Reading History, Saved Data** — auth-gated cloud persistence.
- **About** — project info, sources, feedback.

## Data status labels (critical)
- **LIVE** — fresh upstream data.
- **CACHED** — previously fetched live data (still real, not invented).
- **DEMO** — illustrative fallback when API missing/rate-limited; never present as live breaking news.
- **GEMINI LIVE / LOCAL FALLBACK** — AI status (model vs rule-based fallback).

## Intelligence feed
Headlines from **GNews through /api/public/gnews-proxy** (server holds the key). Local classification into categories and severities. Never call gnews.io from the browser.

## Globe Map
Mapbox GL. Markers only for events with coordinates. Layers and filters: severity, categories, search.

## Country Risk Index
Explainable score 0–100 from intelligence severity, nearby earthquakes, and related signals. Not a prediction model.

## Auth & Saved Data (Supabase)
Email / Google / GitHub. Per-user RLS (\`user_id = auth.uid()\`) for collections, saved articles, reading history, watchlists, preferences. Requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Schema via supabase/migrations/.

## Limitations
- No data outside the provided context.
- Free API tiers may rate-limit; cache reduces calls.
- DEMO data is labeled for teaching when APIs are off.
- AI must not invent headlines, coordinates, or scores not in context.
- Educational project — not an operational intelligence tool.

## InfoEducație presentation tips
Demonstrate: Dashboard → Map layers → Intelligence filters → Alert Center → Knowledge Graph → Global Pulse AI (LIVE vs FALLBACK) → Collections (sign-in) → explain LIVE vs DEMO badges.
`.trim();

export function getPlatformKnowledgeCompact(): string {
  return PLATFORM_KNOWLEDGE;
}
