# Data model — what to replace in `index.html`

Everything below lives in the inline `<script>` of `assets/index.html` (except the few HTML spots noted at the end). Replace the **values**, keep the **shape**. All text is the traveler-facing language (Traditional Chinese in the reference build).

## `DAY_COLOR`
Per-day accent colors, index 0 = Day 1. Reference build has 5; add entries for longer tours.
```js
const DAY_COLOR = ["#6E665C","#BC4630","#A9854F","#5F7367","#8A5A6B"];
```

## `TRIP` — the itinerary (drives 今日, 行程, 地圖)
Array of day objects. `c:[lat,lng]`. Spots with `c[0] <= 30` (i.e. far from the destination, like the home-country airport) are auto-excluded from the map.
```js
const TRIP = [
  { d:1, iso:"2026-06-19", wd:"週五", theme:"抵達 · 啟程",
    guide:"領隊風格的當日導讀，1–3 句。",
    quick:[["集合時間","13:10 桃一航廈"],["別忘了","行動電源放手提"]],
    spots:[
      { n:"關西國際機場 KIX", t:"交通", c:[34.4320,135.2304],
        f:"一句特色介紹。",
        eat:"美食推薦（可省略）", play:"玩樂/體驗（可省略）", buy:"購物（可省略）",
        tip:"玩家提醒（可省略）",
        yt:[["入境攻略","關西機場 入境 教學"]]   // [影片標籤, YouTube 搜尋字串]
      }
      // ...more spots
    ]
  }
  // ...more days
];
```
Field notes: `f` = feature/description (shown as the spot blurb). `eat/play/buy/tip` optional. `yt` = list of `[label, query]`; the app builds a view-sorted YouTube search link per chip.

## `ROUTE` — daily flow + times (drives 地圖 → 每日動線 and the 今日 "now/next" line)
One entry per day. `t` is 24h "HH:MM" (parseable). `via` = how you reach this stop (transport + rough minutes); first stop usually `via:null`. `free:true` marks a free-activity day (no fixed schedule).
```js
const ROUTE = [
  { d:2, iso:"2026-06-20", free:false, label:"奈良世界遺產 · 遊覽車", stops:[
    { t:"08:00", name:"飯店出發", via:null, stay:null },
    { t:"09:30", name:"奈良公園（餵鹿）", via:"遊覽車 約 60 分", stay:"約 90 分" },
    // ...
  ]},
  { d:3, iso:"2026-06-21", free:true, label:"自由活動 · 環球影城（自費）", stops:[
    { t:"08:30", name:"建議：USJ 開園前抵達", via:"電車 約 25 分（自理）", stay:"整天" }
  ]}
];
```

## `DAY_INFO` — per-day 食衣住行購 + weather (drives 今日 dashboard)
Keyed by day number. Every field is one short line.
```js
const DAY_INFO = {
  2:{ w:"24–29°C · 降雨 50%", wtip:"奈良戶外多，防曬＋補水＋折傘",
      eat:"中谷堂搗麻糬…", wear:"好走鞋、帽子防曬", stay:"回難波同一飯店…",
      move:"全天遊覽車；餵鹿時收好塑膠袋", shop:"三井 OUTLET…滿 5000 日圓退稅" }
};
```
A generic fallback object inside `buildDash()` covers days not in `DAY_INFO` and the pre/post-trip state — update it too if the destination changes.

## `FAQS` — drives 須知 → 常見問題
`[category, question, answer]`. Group by category; ~15–20 entries covering 穿著／帶多少錢／刷卡退稅／網路電壓／機上餐／小費／垃圾／入境行李／景點。
```js
const FAQS = [ ["金錢 · 支付","帶多少日幣夠？","每天約 5,000–8,000…"], /* ... */ ];
```

## `PHRASES` — drives 須知 → 常用日文
`[category, target-language, romaji, native-meaning, isEmergency]`.
```js
const PHRASES = [ ["緊急","助けて！","tasukete!","救命！",true], /* ... */ ];
```

## `EMERGENCY` — drives 聯絡
`[label, phone, note]`. Include leader (both countries), agency, the destination's emergency-help office line, local police/ambulance numbers.
```js
const EMERGENCY = [ ["領隊（日本）","080-7141-8597","日本手機"], ["日本報警","110",""], /* ... */ ];
```

## `MEETS` — drives the 集合倒數 (今日 dashboard)
The times the group must gather. Skip free days. The countdown targets the next future entry.
```js
const MEETS = [
  {iso:"2026-06-19", t:"13:10", label:"桃園機場集合"},
  {iso:"2026-06-20", t:"08:00", label:"飯店出發（奈良）"}
];
```

## `STEP_DAYS` — drives 步數記錄 + GPS "加入今日"
The trip's ISO dates, in order.
```js
const STEP_DAYS = ["2026-06-19","2026-06-20","2026-06-21","2026-06-22","2026-06-23"];
```

## HTML spots to update (not in `<script>`)

1. **Header** — `<header class="appbar">`: the title (e.g. `大阪 ＋ 奈良 五日`) and `ab-date` (e.g. `06.19–23`).
2. **行程要點 `keygrid`** (today tab): the 6 `ki` cards — 集合 / 去程 / 回程 / 住宿 / 領隊（tel: link）/ 團號.
3. **Suitability radar** (`radar-card` in the 探索 tab): an inline SVG hexagon + 6 star rows (長輩 / 親子 / 購物 / 步行 / 自由 / 預算). To recompute the SVG polygon for ratings `v` (1–5), 6 axes from top clockwise, center `(120,116)`, max radius `66`:
   - axis i angle = `(-90 + i*60)` degrees; point = `(120 + (66*v/5)*cos, 116 + (66*v/5)*sin)`.
   - Easiest: keep the SVG grid/axes as-is and only move the value polygon points + update the star rows (`★`×rating + `☆`×(5−rating)). If unsure, you may drop the SVG and keep just the star list.
4. **map.html `SPOTS`** (only if shipping the real map): regenerate from the new spots — `{d,i,n,t,lat,lng,c}` per Kansai-equivalent spot (exclude home-country airport).

## Tip: generate the data with a script
For accuracy/escaping, it's often easiest to hold the tour data in a small Python dict and emit the JS constants (and the Supabase seed in `schema.sql`) programmatically, then paste into the template — this is how the reference build's `schema.sql` was produced.
