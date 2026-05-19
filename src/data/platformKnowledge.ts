/**
 * Compact platform knowledge for Global Pulse AI (sent to Gemini as static context).
 */
export const PLATFORM_KNOWLEDGE = `
## Global Pulse — platform overview
Global Pulse is an educational planetary monitoring / situational awareness dashboard built for InfoEducație. It aggregates public feeds and optional Supabase persistence into one interface: live headlines, earthquakes, a world map, country risk scores, and saved bookmarks.

**Stack:** React, TypeScript, Vite, TanStack Router/Start, Tailwind, Mapbox GL (with fallback), Supabase (optional), USGS, GNews via same-origin proxy, REST Countries, OpenWeather (optional demo fallback).

## Main pages
- **Dashboard** — stats, live intelligence preview, map preview, country risk top 5, API health (advanced), activity timeline.
- **Intelligence Feed** (/intelligence) — normalized GNews headlines with category/severity filters, search, sort, country risk sidebar.
- **Global Pulse AI** (/ai-news) — this assistant; explains news and how to use the app using in-app data only.
- **Live World Map** (/map) — Mapbox globe with layers: earthquakes, intelligence, saved alerts, weather demo, capitals; filters by severity/category/search.
- **Countries** — REST Countries reference data; save countries to Supabase.
- **Earthquakes** — USGS last 24h / week feeds.
- **Weather** — OpenWeather when keyed; otherwise demo.
- **Global Alerts** — combines USGS + high/critical intelligence + demo alerts.
- **Compare Countries** — side-by-side country metrics.
- **Saved Data** — Supabase saved_countries, saved_alerts, saved_intelligence.
- **About** — project info.

## Data status labels (critical)
- **LIVE** — fresh upstream data (GNews proxy or USGS).
- **CACHED LIVE DATA** — previously fetched live data from localStorage cache (still real headlines, not invented).
- **DEMO** — sample/fallback data when API missing, rate-limited, or error; must never be presented as live breaking news.
- **RATE LIMITED / API ERROR** — GNews quota or network issues; app may show cache or demo.

## Intelligence feed
Headlines come from **GNews through /api/public/gnews-proxy** (server holds the API key). Items are classified locally into categories (geopolitics, military, economy, technology, energy, climate, disaster, cyber, health, general) and severities (low, medium, high, critical). Never call gnews.io from the browser.

## Globe Map
Markers only for events with coordinates. Layers can be toggled. Heatmap mode shows density. Clusters may be unavailable depending on map mode. Filters: layers, severity, categories, search, high-severity-only.

## Country Risk Index
Explainable score 0–100 from weighted factors: critical/high/medium/low intelligence per country, M6+/M5+ earthquakes near place names, saved critical alerts. Shown on Dashboard, Intelligence page, and AI context. Not a prediction model.

## Saved Data (Supabase)
When configured: saved_countries, saved_alerts, saved_intelligence, user_feedback, project_logs. Save actions from intelligence cards, map, alerts. Requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.

## Simple View vs Advanced View
Toggle in sidebar/header; persisted in localStorage. **Simple View** hides advanced panels (API health, some map filters, category chips). **Advanced View** shows full controls.

## API Health panel (advanced Dashboard)
Probes REST Countries, USGS, GNews proxy, OpenWeather, Supabase, Mapbox token presence.

## Severity meanings
- **critical** — war, major attacks, M6+ quake context, mass casualties keywords, etc.
- **high** — crisis, major conflict, M5+ context.
- **medium** — protests, storms, economic stress.
- **low** — background items.

## Limitations
- No real-time access outside data provided in context.
- GNews free tier may cap articles per request; cache reduces API calls.
- Demo weather and demo alerts exist for teaching when APIs are off.
- AI must not invent headlines, coordinates, or risk scores not in context.

## InfoEducație presentation tips
Demonstrate: Dashboard live feed → Map layers → Intelligence filters → Save to Supabase → explain LIVE vs DEMO badges → Country Risk explanation.
`.trim();

export function getPlatformKnowledgeCompact(): string {
  return PLATFORM_KNOWLEDGE;
}
