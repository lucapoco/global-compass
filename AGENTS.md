# AGENTS.md

## Cursor Cloud specific instructions

Global Pulse is a single frontend web app: React 19 + TypeScript + Vite + TanStack Start (with Nitro for SSR/API routes). There is no separate backend service — API routes live under `src/routes/api/` and run inside the same TanStack Start server. Standard commands are in `README.md` and `package.json` scripts (`dev`, `build`, `preview`, `lint`, `test`).

### Node version (important, non-obvious)
- Use **Node 20** for `npm run dev`, `npm run build`, and `npm run preview`. The VM default `node` is v22 (`/exec-daemon/node`, first on `PATH`), which breaks Vite with `Error [ERR_REQUIRE_CYCLE_MODULE]` coming from `@lovable.dev/vite-tanstack-config`. `npm install` and `npm test` (Vitest) work fine on either version.
- Node 20 is installed via nvm by the startup update script. Activate it in a shell before running dev/build (nvm's `use` alone is not enough because `/exec-daemon` precedes nvm on `PATH`, so prepend the bin dir explicitly):
  ```bash
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20
  export PATH="$NVM_DIR/versions/node/v20.20.2/bin:$PATH"
  ```

### Running (demo mode)
- `npm run dev` serves on `http://localhost:8080/`.
- The app runs fully in **DEMO / local-fallback mode with no `.env` and no API keys** — this is the simplest way to run it. Prefer running with **no `.env` file** over copying `.env.example`: the example's placeholder values (e.g. `GEMINI_API_KEY=your_gemini_api_key_here`) are treated as *real* keys by the "configured" checks (`Boolean(apiKey)`), so the AI chat then calls Gemini with a fake key and returns `GEMINI ERROR`. With no key set, the AI chat correctly uses a local analyst fallback.
- Without `VITE_MAPBOX_TOKEN` the map tiles do not render (blank map area with a "Mapbox token not configured" notice), but event data still loads and lists correctly. Real keys (Supabase, Mapbox, Gemini, etc.) are documented in `.env.example` and only needed to exercise live integrations.

### Lint
- `npm run lint` runs ESLint but currently reports thousands of pre-existing `prettier/prettier` formatting errors across the repo. The tooling works; these are the repo's existing state — do not mass-reformat unless asked.
