# Global Pulse

Educational “planetary monitoring” dashboard: earthquakes (USGS), intelligence headlines (GNews via same-origin proxy), Mapbox globe, OpenWeather, and optional Supabase persistence for saved countries, alerts, and feedback.

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+

## Run locally

```bash
npm install
cp .env.example .env
# Edit `.env` with your keys (see table below), then:
npm run dev
```

The dev server prints a local URL (often `http://localhost:8080/`; another port is used if that one is busy).

Other scripts:

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite + TanStack Start dev server |
| `npm run build` | Production client + SSR bundles |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |

## Environment variables

Create a `.env` file in the project root (see `.env.example`). Required for a **fully live** experience:

| Variable | Used for |
|----------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon / publishable key (client-safe) |
| `VITE_MAPBOX_TOKEN` | Mapbox GL globe map |
| `VITE_OPENWEATHER_API_KEY` | Live current weather |
| `VITE_GNEWS_API_KEY` | GNews — consumed by the server handler at `/api/public/gnews-proxy` (same-origin fetch from the app) |

Without optional keys, the app still runs using public feeds and demo fallbacks where implemented.

**Optional:** `GNEWS_API_KEY` (non-`VITE_`) is also read by the GNews proxy if you prefer not to expose a `VITE_` name in some deployments. `VITE_NEWS_API_KEY` enables an optional NewsAPI.org client fallback in `src/services/newsApi.ts` (not listed in `.env.example`).

## Supabase

SQL that matches the app’s expected tables is in **`supabase-schema.sql`**. Apply it in the Supabase SQL editor (or CLI) on a new project, then align Row Level Security with your auth model before production.

## Stack (short)

React 19, TypeScript, Vite 7, TanStack Router / Start, Tailwind CSS 4, Radix UI, Mapbox GL, Supabase JS.
