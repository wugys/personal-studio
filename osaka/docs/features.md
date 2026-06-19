# Features, capabilities, and hard-won lessons

## Feature inventory (where each lives, and what it needs)

| Feature | Tab | Needs |
|---|---|---|
| Live clock + date | 今日 | static |
| Meetup countdown (`MEETS`) | 今日 | static |
| "Now / next" line, today weather, 食衣住行購 reminders | 今日 | static |
| Trip key facts (keygrid) | 今日 | static |
| Day itinerary cards (food/play/shop/tip + video chips) | 行程 | static (YouTube links open externally) |
| Suitability radar, rainy/night/family/transit cards | 探索 | static |
| Schematic SVG route map + per-day filter | 地圖 | static, **offline** |
| "我的位置": distance to spots + navigate-from-here | 地圖 | **https** (Geolocation) |
| Real Leaflet map + GPS blue dot (`map.html`) | linked | **https + network** (tiles) |
| Packing checklist, FAQ, phrases, money/welfare/luggage | 須知 | static |
| Expense log (JPY→local ×rate) | 須知 | static (localStorage) |
| Step log (manual) | 須知 | static (localStorage) |
| GPS walk: distance + estimated steps + "加入今日" | 須知 | **https**, foreground |
| Budget + tax-refund calculator | 須知 | static |
| Group roll-call (groups, present/absent, counts) | 須知 | static (localStorage) |
| Roll-call **cloud sync** (shared by team code) | 須知 | **https + Supabase** |
| Contacts, lost-passport flow, emergency phrases | 聯絡 | static (tel: links) |
| Large-text mode | header | static |
| PWA: add-to-home-screen + offline | — | **https** (service worker) |

"static" features work even when opening the file directly. The **https**-gated ones (GPS, cloud, tiles, service worker) only work on a deployed secure URL — say so plainly.

## Key code patterns

- **localStorage** — always `try/catch` both read and write; never let blocked storage white-screen the app. Keys are namespaced (`osaka_expense_v1`, `osaka_roster_v1`, etc.); rename the prefix per tour if you want isolated state.
- **DOMContentLoaded** — one handler calls every `build*()` once, then sets `setInterval(tick,1000)` (clock) and `setInterval(buildRoute,60000)` (route refresh), and registers the service worker only when `location.protocol==="https:"`.
- **Day-driven rendering** — map, route timeline, and step log derive their day count from the data; only `DAY_COLOR` is fixed-length.
- **YouTube chips** — build a search URL and append `&sp=CAMSAhAB` to sort by view count.
- **Maps navigation** — spot buttons open Google Maps search by name; "from here" links use `https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=NAME`.

## The schematic map (most error-prone — read before touching)

The 地圖 tab is a **hand-projected SVG**, not a tile map. Two bugs were fixed here; preserve their fixes:

1. **Markers need coordinates.** The point list (`KP`) must carry `lat`/`lng` for every spot. A version that pushed points *without* coords made every marker `NaN` and stacked them in the top-left corner. When editing, confirm each `KP.push(...)` includes `lat:s.c[0], lng:s.c[1]`.
2. **Declutter before drawing.** Real city coords are tightly clustered (e.g. 16 Osaka spots had ~35 overlapping pairs). The template runs `declutter(points, minDist)`: iteratively push overlapping points apart, clamp to the viewbox, then center + scale-to-fit (only enlarge, never shrink the spread). In the "全部" view, markers shrink and lines fade so it stays legible. After any change, eyeball that no two markers overlap in any filter.
3. **Do not plot GPS on the schematic map.** Its projection is distorted by declutter, so a real lat/lng dot would be meaningless. GPS is used only for *distance to spots* and *navigate-from-here*. For a true moving dot, use the real Leaflet page (`map.html`).

## GPS (Geolocation) — capabilities and limits

- `navigator.geolocation.watchPosition` / `getCurrentPosition` require **https** (or localhost) and a **foreground** tab with the screen on. iOS suspends JS when backgrounded/locked — **no background tracking**.
- **Cannot read Apple Health / the phone's pedometer.** Steps are *estimated* from GPS distance (`meters / 0.71`), not counted. Keep the manual step log as the accurate source.
- **Filtering** (in the template, keep it): ignore fixes with `accuracy > 35` m; ignore a segment if its distance `< 4` m (jitter while standing) or implies speed `> 12` m/s (a GPS jump). This stops the distance inflating when still.
- Always handle the error callback (code 1 = denied, 3 = timeout) and the insecure-context case with a clear message.

## `map.html` (real map)

Leaflet 1.9.4 + OpenStreetMap tiles (free, no key). Day-colored numbered `divIcon` markers, per-day polylines, Day/All filter chips, a `watchPosition` **blue dot** + accuracy circle, "回我的位置" recenter, and a back link to `index.html`. To retarget: regenerate the `SPOTS` array from the new tour coords. Needs https + network; not offline.

## Cloud roll-call (Supabase)

- Opt-in. The in-app "雲端同步" section takes a Supabase URL, anon key, and a **team code**. Only when enabled does it **lazy-load** the Supabase UMD client from CDN; until then everything is localStorage.
- Model: one row per team code in `rosters(code pk, data jsonb, updated_at)` (see `assets/schema_v2.sql`). Load on enable, **upsert on every change**, **poll every ~6s** to pull others' edits. Last-write-wins — fine for a single guide editing.
- RLS is permissive (anon read/write) for MVP; the **team code is the password**, so it must be hard to guess. Never expose the `service_role` key.

## PWA

- `<head>` has `apple-touch-icon` + a `manifest` as data URIs, plus `theme-color` and `apple-mobile-web-app-*`. The icon is a small base64 PNG (a gold map-pin on bone in the reference build). To regenerate per destination, render an SVG to a 180×180 PNG (e.g. `cairosvg`) and base64-embed it.
- `sw.js` is cache-first, precaches `./` + `./index.html`, runtime-caches the rest, and falls back to the cached page offline. It only activates on https; registration is guarded.

## Verification checklist (run every build)
1. Extract the inline `<script>`, `node --check` it — must parse.
2. `grep` for duplicate `id="..."` — expect zero.
3. Every function named in the `DOMContentLoaded` handler is defined exactly once.
4. Map: `KP` entries include `lat`/`lng`; no overlapping markers after declutter, in every filter.
5. If you changed day count, confirm `DAY_COLOR` has enough colors.
