# Global Pulse

Dashboard educațional de „monitorizare planetară”: cutremure prin USGS, știri/intelligence prin GNews folosind un proxy same-origin, hartă globală Mapbox, OpenWeather și persistență opțională prin Supabase pentru țări salvate, alerte și feedback.

## Cerințe preliminare

- Node.js 20+ (recomandat LTS)
- npm 10+

## Rulare locală

bash
npm install
cp .env.example .env
# Editează `.env` cu cheile tale (vezi tabelul de mai jos), apoi:
npm run dev

Serverul de dezvoltare va afișa un URL local, de obicei http://localhost:8080/. Dacă portul este ocupat, se va folosi alt port.

Modificarea fișierelor .env sau .env.local — Supabase, Mapbox etc.

Variabilele VITE_* sunt citite când pornește serverul de dezvoltare Vite. După ce modifici .env sau .env.local:

Oprește serverul de dezvoltare cu Ctrl+C.
Rulează din nou npm run dev.
Fă hard refresh în browser cu Ctrl+Shift+R sau deschide aplicația într-un tab nou.

Altfel, import.meta.env poate păstra încă vechiul proiect Supabase sau vechile chei.

Alte comenzi:

Comandă	Scop
npm run dev	Pornește serverul Vite + TanStack Start
npm run build	Generează build-ul de producție pentru client + SSR
npm run preview	Previzualizează build-ul de producție
npm run lint	Rulează ESLint
Variabile de mediu

Creează un fișier .env în rădăcina proiectului. Poți folosi .env.example ca model.

Pentru o experiență complet live sunt necesare:

Variabilă	Folosită pentru
VITE_SUPABASE_URL	URL-ul proiectului Supabase
VITE_SUPABASE_PUBLISHABLE_KEY	Cheia anon / publishable Supabase, sigură pentru client
VITE_MAPBOX_TOKEN	Harta globală Mapbox GL
VITE_OPENWEATHER_API_KEY	Vreme live curentă
VITE_GNEWS_API_KEY	GNews — folosită de handlerul server de la /api/public/gnews-proxy, aplicația făcând request same-origin

Fără cheile opționale, aplicația rulează în continuare folosind feed-uri publice și fallback-uri demo acolo unde sunt implementate.

Opțional: GNEWS_API_KEY, fără prefixul VITE_, este citită de proxy-ul GNews dacă preferi ca în anumite deployment-uri cheia să nu aibă nume expus frontend-ului. VITE_NEWS_API_KEY activează un fallback opțional prin NewsAPI.org în src/services/newsApi.ts, dar nu este listată în .env.example.

Global Pulse AI — Google Gemini

Pagina Global Pulse AI (/ai-news) apelează POST /api/ai-news-chat pe server, care trimite request-ul mai departe către Google Gemini. Modelul implicit este gemini-2.5-flash-lite.

Creează o cheie API din Google AI Studio.
În .env sau .env.local, adaugă:
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
Repornește serverul de dezvoltare după orice modificare în .env:
# Ctrl+C pentru oprire, apoi:
npm run dev
Variabilă	Scop
GEMINI_API_KEY	Cheia API Google Gemini, folosită doar server-side
GEMINI_MODEL	Modelul principal, implicit gemini-2.5-flash-lite
GEMINI_FALLBACK_MODEL	Model fallback când modelul principal este ocupat, implicit gemini-2.0-flash-lite

Nu folosi VITE_GEMINI_API_KEY — cheia nu trebuie să ajungă niciodată în browser. Serverul citește variabilele GEMINI_* prin process.env, încărcate din .env la pornire și injectate în worker bundle de Vite.

Dacă GEMINI_API_KEY lipsește, interfața folosește un fallback local bazat pe reguli, cu badge-ul LOCAL FALLBACK. Când Gemini funcționează, răspunsurile afișează GEMINI LIVE.

Pentru Cloudflare production, setează GEMINI_API_KEY ca secret Wrangler:

wrangler secret put GEMINI_API_KEY

Nu o pune în bundle-ul de client.

Supabase

SQL-ul care corespunde tabelelor așteptate de aplicație și politicilor RLS pentru anon se află în fișierul supabase-schema.sql.

În Supabase → SQL Editor, lipește întregul fișier și rulează-l o singură dată pentru fiecare proiect.

Dacă tabelele există, dar aplicația tot nu poate citi sau scrie date, probabil ai RLS activat fără politici. În acest caz, rulează secțiunea RLS de la finalul fișierului sau rulează din nou întregul fișier. Acesta folosește IF NOT EXISTS și DROP POLICY IF EXISTS acolo unde este necesar.

Înainte de o lansare reală în producție, ajustează Row Level Security în funcție de modelul tău de autentificare. Politicile incluse sunt permisive pentru anon și sunt gândite pentru uz local / educațional.

Stack — pe scurt

React 19, TypeScript, Vite 7, TanStack Router / Start, Tailwind CSS 4, Radix UI, Mapbox GL, Supabase JS.