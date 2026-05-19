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

### Changing `.env` or `.env.local` (Supabase, Mapbox, etc.)

`VITE_*` variables are read when the **Vite dev server starts**. After you edit `.env` or `.env.local`:

1. Stop the dev server (**Ctrl+C**).
2. Run `npm run dev` again.
3. Hard-refresh the browser (**Ctrl+Shift+R**) or open a new tab.

Otherwise `import.meta.env` can still reflect the previous Supabase project or keys.

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

### Global Pulse AI (Google Gemini)

The **Global Pulse AI** page (`/ai-news`) calls `POST /api/ai-news-chat` on the server, which forwards to **Google Gemini** (`gemini-2.5-flash-lite` by default).

1. Create a [Google AI Studio](https://aistudio.google.com/apikey) API key.
2. In `.env` or `.env.local` (server secrets), add:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
```

3. Restart the dev server after any `.env` change:

```bash
# Ctrl+C to stop, then:
npm run dev
```

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API key (server-side only) |
| `GEMINI_MODEL` | Primary model (default `gemini-2.5-flash-lite`) |
| `GEMINI_FALLBACK_MODEL` | Fallback when primary is busy (default `gemini-2.0-flash-lite`) |

Do **not** use `VITE_GEMINI_API_KEY` — the key must never reach the browser. The server reads `GEMINI_*` via `process.env` (loaded from `.env` at startup and injected into the worker bundle by Vite). If `GEMINI_API_KEY` is missing, the UI uses a **local rule-based fallback** (badge: `LOCAL FALLBACK`). When Gemini works, responses show `GEMINI LIVE`.

For **Cloudflare production**, set `GEMINI_API_KEY` as a Wrangler secret (`wrangler secret put GEMINI_API_KEY`), not in the client bundle.

## Supabase

SQL that matches the app’s expected tables **and anon RLS policies** is in **`supabase-schema.sql`**. In **Supabase → SQL Editor**, paste the **entire** file and run it once per project. If tables exist but the app still cannot read/write, you likely have RLS on without policies — run the **RLS** section at the bottom of that file (or the full file again; it uses `IF NOT EXISTS` / `DROP POLICY IF EXISTS` where needed).

Then align Row Level Security with your auth model before any production launch (the bundled policies are permissive for `anon` for local/educational use).

## Stack (short)

React 19, TypeScript, Vite 7, TanStack Router / Start, Tailwind CSS 4, Radix UI, Mapbox GL, Supabase JS.
