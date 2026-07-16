# seed-places.ts

Standalone script, run manually by you from your own machine. It is **not**
called by the app, not deployed, and not part of the Vercel/Netlify build.

## Budget

This script makes **at most 10 API calls** to SearchApi.io — one per fixed
query in `QUERIES`. SearchApi's free tier is limited, so:

- Do not run this repeatedly "just to see". Each full run costs 10 calls.
- Use `npm run seed -- --test` first — it costs exactly **1** call, prints
  the raw SearchApi JSON and the parsed result for the first query, and
  writes nothing to Supabase. Use it to sanity-check that `parsePlace()` is
  reading the right fields before spending the rest of the budget.
- If a full run partially fails (e.g. network error mid-way), re-running is
  safe for already-fetched places (upsert on `google_place_id`), but still
  costs a fresh call for every query, including ones that already succeeded.

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
npm run seed              # 10 calls, upserts into `places`
```
