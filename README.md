# BarHudking

Bangalore bar & restaurant discovery PWA: ~4,800 bars, pubs, breweries, cafés,
clubs and restaurants with ratings, approximate cost for two, opening hours,
a map, personal lists and a visit journal.

**v2 works with no backend at all.** The place catalogue ships with the app
(`public/data/places.json`) and each person's favorites, visits, notes and
lists live on their own device. Supabase is now *optional* — it only adds
email sign-in, cross-device sync and community stats. If it disappears again,
nothing breaks.

## What changed in v2 (and why)

v1 kept *everything* in one Supabase project — the places table and every
user's data — and refused to start without it (`supabase.ts` threw at import
time, and the app was gated on an anonymous sign-in). Losing the project
meant a blank screen and losing all seeded places.

v2:

- Places are a static, versioned JSON file built by `scripts/data/*`, from
  free OpenStreetMap data plus optional cached Google enrichment.
- User data is local-first (`src/lib/store.ts`), with record-level
  last-write-wins merging so devices can sync in any order.
- Sync is a single optional table (`supabase/schema.sql`). The app never
  needs it to start.

## Features

- **Discover**: search that tolerates typos and everyday words ("koramangla",
  "beer", "coffee"), Super Suggest, Tonight (open now and for at least two more
  hours), a filter sheet with a ₹ budget slider, and seven sort orders.
- **For you**: suggestions based on what you save and rate highly, each with
  the place it resembles ("Like Toit").
- **Collections** with photo covers, **Surprise me**, and a clustered **map**.
- **Place page**: rating, cost for two, hours, book a table, directions,
  call, ride, a link to the full Google reviews, and a **share card** image.
- **Your data**: favourites (swipe a card left to save), lists, visit
  journal with ratings and spend, private notes, stats and badges.
- **Plans**: shortlist 2–5 places, send the link, friends vote and send a
  reply link back — the tally updates on your phone, no backend needed.
- **Something wrong?** hides a place for you (closed, wrong info, not for
  me); undo from Me → Hidden places.
- **Search suggestions** (recent searches and quick ideas), a **Recently
  viewed** row, and tap a place's area to explore that neighbourhood.
- **Light and dark** themes (follows the phone by default), and an offline
  notice when the connection drops.
- Installable, works offline.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
```

That's it — no env vars are required. Optional features are switched on in
`.env.local` (see `.env.example`).

## Place data

The catalogue is built in two independent layers, both cached so you never
pay twice:

```bash
npm run data:osm       # free: all named venues in Bangalore from OpenStreetMap
npm run data:enrich    # paid: Google ratings/prices/photos via SearchApi (cached per query)
npm run data:build     # free, offline: merges both into public/data/places.json
```

Then commit `public/data/places.json` (and `data/raw/searchapi/`, so the
credits you spent are never lost).

See `scripts/README.md` for the SearchApi budget plan (it's tuned for 100
credits) and other free/cheap data options.

## Optional: accounts & sync (new Supabase project)

1. Create a free project at supabase.com.
2. SQL editor → run `supabase/schema.sql`.
3. Authentication → Sign In / Providers → make sure **Email** is enabled.
   Optional: in Authentication → Emails → *Magic Link* template, add
   `{{ .Token }}` so emails include a 6-digit code (handy when the app is
   installed to the home screen and the link would open in a browser instead).
4. Authentication → URL Configuration → set the Site URL to your deployed URL
   and add it to the redirect allow list.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings →
   API) in `.env.local` and your hosting provider.

Each user signs in with their email on the Me tab. Data already on the device
is merged into their account. The `community_stats()` function exposes only
aggregates (visit counts, average rating and spend per place). It never
exposes who went where.

## Optional: map style

The default map uses keyless OpenStreetMap tiles, darkened in CSS. For a
purpose-built dark style set `VITE_MAP_TILE_URL` (and
`VITE_MAP_TILE_ATTRIBUTION`), e.g. Stadia Maps `alidade_smooth_dark` (free
tier; register your domain). CARTO basemaps now require an API key.

## Deploying

Static build, no server: `npm run build`, then deploy `dist/`.
`vercel.json` / `netlify.toml` already handle SPA routing. Add any optional
env vars in the host's settings.
