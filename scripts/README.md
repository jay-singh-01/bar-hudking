# seed-places.ts

Standalone script, run manually by you from your own machine. It is **not**
called by the app, not deployed, and not part of the Vercel/Netlify build.

## Budget

This script makes exactly `QUERIES.length` API calls to SearchApi.io — one
per query, currently capped at `MAX_QUERIES = 27` in `seed-places.ts`.
SearchApi's free tier is limited, so:

- **Check your actual remaining SearchApi quota before running** — this
  script has no way to know your balance. Lower `MAX_QUERIES` to fit it.
- Do not run this repeatedly "just to see". Each full run costs
  `QUERIES.length` calls.
- Use `npm run seed -- --test` first — it costs exactly **1** call, prints
  the raw SearchApi JSON and the parsed result for the first query, and
  writes nothing to Supabase. Use it to sanity-check that `parsePlace()` is
  reading the right fields before spending the rest of the budget.
- If a full run partially fails (e.g. network error mid-way), re-running is
  safe for already-fetched places (upsert on `google_place_id`), but still
  costs a fresh call for every query, including ones that already succeeded.

## Query strategy (why it's area-targeted, not city-wide)

The original 10 queries ("bars in Bangalore", "pubs in Bangalore", ...) all
searched around the same city-wide center (`ll=@12.9716,77.5946,12z`).
Google Maps ranks by popularity, so different category text kept surfacing
the same central, high-review places regardless of query wording — 24 of
the first 145 seeded places landed in one neighborhood (Ashok Nagar) while
several curated areas (e.g. Rajarajeshwari Nagar) got zero.

`QUERIES` is now generated from `TARGET_AREAS × CATEGORIES`, with each area
carrying its own tighter `ll` (zoom 14 instead of 12) to bias results toward
that specific neighborhood instead of the whole city. `TARGET_AREAS` is
ordered ascending by how many places are already seeded there, so if you
lower `MAX_QUERIES`, the highest-value (least-covered) queries still run
first.

Each run logs, per query, how many results were already in the database —
use that to judge whether an area is worth another pass, or has been
exhausted. The final summary reports "new places per API call" so you can
compare efficiency across runs.

To target different areas, edit `TARGET_AREAS` (coordinates should be the
average lat/lng of already-seeded places there if any exist — query
`places` grouped by `area` — otherwise a general locality-center estimate).

## Requirements

In `.env.local`:

- `SEARCHAPI_KEY` — from https://www.searchapi.io/
- `VITE_SUPABASE_URL` — same value the app uses
- `SUPABASE_SERVICE_ROLE_KEY` — **service role**, not the anon key. RLS only
  allows `places` writes via the service role (see
  `supabase/migrations/0001_init.sql`). Find it in Supabase dashboard ->
  Project Settings -> API -> service_role. Never commit this key or expose
  it to the frontend (it bypasses RLS entirely).

## Run

```bash
npm run seed -- --test   # 1 call, no writes — verify field mapping
npm run seed              # QUERIES.length calls, upserts into `places`
```
