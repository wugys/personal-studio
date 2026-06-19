# Design system

The look is restrained, editorial, "醫美診所 × Ogilvy" — warm bone paper, ink text, a single muted gold accent, serif display over clean sans body. Keep it calm and premium; avoid bright UI colors, heavy shadows, or emoji clutter.

## Color tokens (`:root` in `index.html`)
```
--bone:#F3EEE6;   /* page background      */
--paper:#FBF8F3;  /* cards                */
--paper-2:#F7F2EA;/* insets / inputs      */
--ink:#2B2724;    /* primary text, dark buttons */
--ink-soft:#6E665C;
--ink-faint:#9B9389;
--line:#E3DBCD;   /* borders             */
--line-soft:#ECE5D9;
--gold:#A9854F;   /* the one accent: eyebrows, links, active */
--gold-soft:#C7AE83;
--shu:#BC4630;    /* alert / recording / day-2 */
/* day colors */
--d1:#6E665C; --d2:#BC4630; --d3:#A9854F; --d4:#5F7367; --d5:#8A5A6B;
```
Success/present states use a muted sage green (`#5F7367` / backgrounds `#EAF0EA`, borders `~#A9C0A9`). Map "you are here" / GPS blue dot is `#2A7DE1` (the only true blue, used sparingly).

## Type
```
--serif:"Noto Serif TC", serif;        /* headings, titles */
--lat:"Cormorant Garamond", Georgia, serif; /* numbers, Latin display, marker labels */
--sans:"Noto Sans TC", -apple-system, system-ui, sans-serif; /* body, UI */
```
- Headings use `--serif`, light/medium weight, slight letter-spacing.
- Big numbers (clock, totals, distances, marker numerals) use `--lat`.
- Body is `--sans`, weight 300–400. Body sizes ~13–15px on mobile.
- Section "eyebrows": tiny uppercase gold label (`text-transform:uppercase; letter-spacing:.12–.16em; font-size:9–11px; color:var(--gold)`), often with an English word + a Chinese `<h_>` under it.

## Layout
- Mobile-first, single column, max content width ~560px centered.
- 6-tab bottom nav (`#tabbar`) toggling `.view.active`; views fade in.
- Generous whitespace; 1px hairline borders (`--line`) instead of shadows.
- `viewport` locks scale; `viewport-fit=cover`; honor `env(safe-area-inset-*)`.

## Reusable component classes (already in the template)
- `.card` / `.vhead` (view header: eyebrow + `<h2>` + `.s` subline).
- `.acc` — `<details>` accordion with `.an` (number), `<h4>`, `.chev`, and `.ac-body`. Used throughout 須知.
- `.sub-h` — small gold sub-heading inside an accordion section.
- `.exp-card` — explore cards; `.radar-card` + `.rs-row` star rows.
- `.day-pill` / spot card markup in 行程; `.rp-stop` route-timeline rows; `.rmd` dashboard reminder rows.
- `.ki` keygrid tiles; `.fe-row` list rows (expense/step), `.fe-empty` empty state.
- `.rc-row` roll-call member rows (`.on` = present, sage), `.rc-chip` group counts.
- `.gps-stat` stat tiles; `.geo-row` nearest-spot rows; `.chip` filters.
- Dark buttons: `background:var(--ink); color:#F4EFE6`. Secondary/outline: `border:1px solid var(--line); background:var(--paper)`.

## Large-text mode
`body.bigtext` bumps core font sizes for non-tech-savvy travelers; toggled by the header "Aa" button (`#bigTog`), persisted in `localStorage`. When adding text UI, prefer rem/px that the `body.bigtext` overrides already cover, or add an override.

## Tone of copy
Concise, warm, guide-like. Headings in `--serif`; one idea per line. Reminders phrased as friendly nudges ("別忘了…", "建議…"). Match the traveler's language (Traditional Chinese in the reference build).
