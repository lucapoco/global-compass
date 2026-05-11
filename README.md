# Global Pulse

A real-time global intelligence dashboard combining country, seismic, weather, and news data.

## Environment setup

All API keys are read exclusively from environment variables — none are hardcoded in the source.

### Required variables

| Variable | Used for | Required |
|---|---|---|
| `VITE_GNEWS_API_KEY` | GNews intelligence feed | Recommended |
| `VITE_OPENWEATHER_API_KEY` | Live weather | Recommended |
| `VITE_MAPBOX_TOKEN` | Mapbox basemap (falls back to MapLibre/CARTO if missing) | Optional |
| `VITE_SUPABASE_URL` | Backend (saved items, alerts, feedback) | Required for persistence |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Backend public key | Required for persistence |

Never expose Supabase `service_role` keys or any admin secrets in a frontend Vite app.

### On Lovable

Add the variables above in **Workspace Settings → Build Secrets**. They are injected at build time and accessible via `import.meta.env.VITE_*`.

### Local development (Cursor / VS Code)

Create a `.env.local` file in the project root:

```
VITE_GNEWS_API_KEY=your_gnews_api_key_here
VITE_OPENWEATHER_API_KEY=your_openweather_api_key_here
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
```

Then:

```bash
npm install
npm run dev
```

`.env`, `.env.local`, and `.env.*.local` are git-ignored.

## Behavior when keys are missing

- **GNews missing** → demo intelligence feed + DEMO badge
- **OpenWeather missing** → demo weather + DEMO badge
- **Mapbox missing** → MapLibre/CARTO fallback basemap
- **Supabase missing** → save/read/delete features show "Supabase is not configured" message; rest of the app still works

The **API Health** panel on the dashboard shows live status for every integration.
