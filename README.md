# Global Pulse

**Planetary Intelligence** — platformă educațională pentru monitorizarea și analiza evenimentelor globale în timp real.

Transformă informații din surse multiple (geopolitice, climatice, economice, sociale) într-o experiență clară: hartă interactivă, alerte, AI briefing, colecții personale și explorare pe țări — cu etichete transparente **LIVE** / **CACHED** / **DEMO**.

| | |
|---|---|
| **Demo** | https://www.global-pulse.app/ |
| **GitHub** | https://github.com/lucapoco/global-compass |


---


---

## Funcționalități

- **Hartă globală** — cutremure, intelligence, alerte, vreme și alți indicatori pe Mapbox
- **Mission Control** — vedere operațională tip command center
- **Alert Center** — alerte, watchlist-uri și notificări
- **Knowledge Graph** — relații între evenimente, țări și teme
- **Global Pulse AI** — analize și briefinguri cu Google Gemini
- **Analytics & rapoarte** — statistici și rapoarte executive
- **Saved Data** — articole salvate, colecții personale, istoric de lectură
- **Țări & comparații** — profil pe țară și comparații side-by-side
- **Autentificare** — email, Google, GitHub (Supabase Auth) + preferințe sincronizate
- **i18n** — română și engleză
- **Responsive** — desktop, tabletă și mobil

---

## Stack

**Frontend:** React 19 · TypeScript · Vite · TanStack Start / Router / Query · Tailwind CSS · Framer Motion · Recharts · Mapbox GL · Lucide · Radix UI · XYFlow · Sonner  

**Backend & cloud:** TanStack Start (API routes) · Nitro · Vercel · Supabase (PostgreSQL, Auth, RLS)  

**Date & AI:** Google Gemini · GNews · USGS · OpenWeather · REST Countries · Mapbox · ACLED · NASA FIRMS · GDACS · GDELT · ReliefWeb · RSS  

**Tooling:** ESLint · Prettier · Vitest  

---

## Cerințe

**Utilizare:** browser modern + internet  

**Dezvoltare:**

- Node.js 20+ (LTS)
- npm 10+
- Git
- minim 8 GB RAM (recomandat 16 GB)

---

## Rulare locală

```bash
npm install
cp .env.example .env
# Completează cheile în .env (vezi mai jos)
npm run dev
```

Deschide URL-ul afișat (de obicei `http://localhost:8080/`).

După orice modificare la `.env` / `.env.local`: oprește serverul (`Ctrl+C`), rulează din nou `npm run dev`, apoi hard refresh (`Ctrl+Shift+R`).

### Comenzi

| Comandă | Scop |
|--------|------|
| `npm run dev` | Server de dezvoltare (Vite + TanStack Start) |
| `npm run build` | Build producție (client + SSR) |
| `npm run preview` | Previzualizare build |
| `npm run lint` | ESLint |
| `npm test` | Teste Vitest |

---

## Variabile de mediu

Copiază `.env.example` → `.env`. Fără chei opționale, aplicația rulează în continuare cu fallback-uri **DEMO** acolo unde sunt implementate.

### Client (`VITE_*` — expuse în browser)

| Variabilă | Rol |
|-----------|-----|
| `VITE_SUPABASE_URL` | URL proiect Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Cheie anon / publishable |
| `VITE_MAPBOX_TOKEN` | Hartă Mapbox GL |

### Server (nu folosi prefix `VITE_` pentru secrete)

| Variabilă | Rol |
|-----------|-----|
| `GNEWS_API_KEY` | Proxy `/api/public/gnews-proxy` |
| `OPENWEATHER_API_KEY` | Proxy vreme |
| `GEMINI_API_KEY` | Global Pulse AI (`/api/ai-news-chat`) |
| `GEMINI_MODEL` | Implicit `gemini-2.5-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | Implicit `gemini-2.0-flash-lite` |
| `ACLED_USERNAME` / `ACLED_PASSWORD` | Date conflict (opțional) |
| `FIRMS_MAP_KEY` | Incendii NASA FIRMS (opțional) |
| `RELIEFWEB_APPNAME` | ReliefWeb (opțional) |
| `REST_COUNTRIES_API_KEY` | REST Countries v5 (opțional; există fallback local) |

**Nu folosi** `VITE_GEMINI_API_KEY` sau `VITE_GNEWS_API_KEY` — secretele nu trebuie să ajungă în bundle-ul de client.

Dacă `GEMINI_API_KEY` lipsește, AI-ul folosește un fallback local (**LOCAL FALLBACK**). Cu cheie validă: **GEMINI LIVE**.

Detalii complete: vezi `.env.example`.

---

## Deploy pe Vercel

Proiectul folosește **TanStack Start + Nitro**. `vercel.json` setează `framework: "tanstack-start"`. Deploy-ul principal este pe **Vercel** (nu Cloudflare).

1. Importă repo-ul pe [vercel.com/new](https://vercel.com/new).
2. Framework Preset: **TanStack Start** (nu seta Output Directory manual).
3. Adaugă Environment Variables (Production + Preview), cel puțin:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_MAPBOX_TOKEN`
   - `GEMINI_API_KEY`, `GNEWS_API_KEY`, `OPENWEATHER_API_KEY`
4. În Supabase → Authentication → URL Configuration, adaugă redirect:
   - `http://localhost:8080/auth/callback`
   - `https://www.global-pulse.app/auth/callback` (și domeniul Vercel, dacă diferă)
5. Redeploy după salvarea variabilelor.

Simulare build Vercel local:

```bash
# Windows PowerShell
$env:VERCEL="1"; $env:NITRO_PRESET="vercel"; npm run build
```

---

## Supabase

1. Creează un proiect pe [supabase.com](https://supabase.com).
2. Rulează migrările din `supabase/migrations/` (în ordine), în SQL Editor — sau folosește CLI Supabase.
3. Activează providerii Auth: Email, Google, GitHub.
4. Setează redirect URL-urile (local + producție) pentru `/auth/callback`.

Datele personale (colecții, articole salvate, preferințe, watchlist etc.) sunt izolate per utilizator prin **Row Level Security** (`user_id = auth.uid()`).

Schema legacy de referință (opțional): `docs/legacy-supabase-schema.sql`. Preferă migrările din `supabase/migrations/`.

---

## Transparența datelor

| Status | Semnificație |
|--------|----------------|
| **LIVE** | Date proaspete de la API |
| **CACHED** | Date live stocate temporar |
| **DEMO** | Fallback ilustrativ — **nu** este știre live |

---

## Licență / context

Proiect educațional — dezvoltat pentru prezentare / concurs. Nu este un instrument operațional de intelligence.
