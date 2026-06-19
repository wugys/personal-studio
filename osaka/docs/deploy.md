# Deploy & activate

The app runs as static files. "static" features work the moment the file is opened, but GPS, the GPS blue dot, cloud roll-call, the real map tiles, and offline/PWA all require a **deployed https URL**. Three stages, each independent and free.

## Stage 1 — put the app online (≈10 min)
Enables: GPS step tracking, map GPS, offline, add-to-home-screen.
1. GitHub → **New repository** (Public) → **Add file → Upload files** → upload `index.html`, `map.html`, `sw.js` → Commit.
2. Vercel → **Continue with GitHub** → **Add New → Project** → import the repo → Framework Preset **Other** → **Deploy**.
3. Get the `https://...vercel.app` URL.
4. iPhone: open it in **Safari** → Share → **Add to Home Screen**.

GitHub Pages works too (repo Settings → Pages → deploy from branch). Re-uploading a changed file triggers an automatic redeploy.

## Stage 2 — cloud roll-call (≈10 min)
Enables: group roll-call shared across everyone's phones.
1. Supabase → **New project** (nearest region).
2. **SQL Editor** → paste `schema_v2.sql` → **Run** (creates the `rosters` table). If you also want the platform DB, run `schema.sql` too.
3. **Project Settings → API** → copy **Project URL** and **anon public key**.
4. In the app: 須知 → 分組點名 → 雲端同步 → paste URL + anon key + a self-chosen **team code** (everyone enters the same) → enable.

## Stage 3 — platform + AI Q&A (optional, advanced)
`assets/schema.sql` seeds a Next.js platform (trips/days/spots/faqs/phrases/contacts). To add open-ended AI itinerary Q&A, stand up an API route that calls an LLM with the itinerary as context; do a **FAQ-first, LLM-fallback** lookup to keep cost low, and for a single tour just stuff the itinerary JSON into the system prompt (no vector DB needed).

## Security rules (non-negotiable)
- **Safe to expose / share:** the site URL, the Supabase **anon public key**, the roll-call **team code** (pick a non-obvious one — it's the password).
- **Never in frontend, never shared with anyone:** the Supabase **`service_role` key**, the **database password**, any **LLM API key**.
- Keys belong in deploy-time environment variables, not committed to the repo.
