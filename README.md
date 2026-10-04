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

- **Discover**: search (name, area, cuisine, feature), quick chips (near me,
  open now, type), a full filter sheet (type, distance, cost for two, rating,
  features, cuisine, neighbourhood, near my spots, hide visited) and 7 sort
  orders. "Recommended" balances rating confidence, distance and open-now.
- **Surprise me**: a weighted random pick from whatever you're filtering, a
  collection, your favorites or a list.
- **Collections**: Bangalore's best, hidden gems, brewery hopping, rooftops,
  date night, open late, live music, cafés to work from, alfresco, budget,
  pure veg.
- **Map**: clustered map of everything, filterable (saved / been there /
  open now / type), with locate-me.
- **Place page**: rating and rating count, approx cost for two, open/closed
  with today's hours, directions / call / Uber / website / share, a mini map,
  "also around here", a link to the place's full Google reviews, and "Book a
  table" when the venue takes bookings.
- **Your experience**: log visits (date, stars, actual cost for two, notes),
  private notes per place, favorites and custom lists (shareable as a link).
  Recipients can save shared lists with one tap.
- **Me**: stats (places tried, neighbourhoods explored, average spend),
  badges, "my spots" (home/work, used by the *Near my spots* filter), backup
  export/import, and optional account sync.
- Installable, works offline (catalogue, tiles and photos are cached).

## Setup

```bash
npm install
npm run dev
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
