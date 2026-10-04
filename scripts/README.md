# Data pipeline

Builds `public/data/places.json`, the app's entire place catalogue. Nothing
here runs in the app or the deploy. You run it by hand when you want fresher
data.

```
data:osm  ──► data/raw/osm.json ──────────┐
                                           ├──► data:build ──► public/data/places.json
data:enrich ─► data/raw/searchapi/*.json ──┘
```

## 1. OpenStreetMap base layer — free

```bash
npm run data:osm
```

Pulls every named bar, pub, restaurant, café, brewery, biergarten and
nightclub inside Greater Bangalore from the Overpass API. That's ~4,800
venues with location, cuisine, and often opening hours, phone, website and
features like outdoor seating, veg options, Wi-Fi and wheelchair access. No
key needed; re-run whenever you like. The raw dump is git-ignored.

OSM has **no ratings, review counts or prices**. That's what step 2 adds.

## 2. Google enrichment via SearchApi — 1 credit per call

```bash
npm run data:enrich -- --dry-run      # show the plan + credit cost, spends nothing
npm run data:enrich -- --test         # spends 1 credit; prints the raw result so you can check fields
npm run data:enrich -- --budget 40    # spend at most 40 credits (default 20)
```

Every search runs on **two SearchApi engines**, because neither has
everything:

| Engine | Gives | Cache folder |
| --- | --- | --- |
| `google_maps` | rating, exact review count, hours, photo, description, phone, website, booking link | `data/raw/searchapi/` |
| `google_local` | rating, review count, **per-person price range** (≈55% of places) | `data/raw/searchapi-local/` |

Both return the same Google `place_id`, so `data:build` merges them exactly.

Every response is cached. **Commit both folders.** Re-runs skip anything
already cached, so a credit is never spent twice, and you can rebuild the
catalogue from the cache forever. To check your balance, SearchApi's
`/api/v1/me` endpoint is free.

### What's been spent (Oct 2026, 300 credits over 3 keys)

Every search runs on both engines, so one search = 2 credits. The plan in
`plan()` is tiered and fully cached; `--dry-run` shows anything left.

| Tier | Searches | Credits |
| --- | --- | --- |
| done | Bars & best restaurants in 20 core areas, 4 city-wide specials, cafés in 4 areas | 96 |
| A | Cafés in the focus areas; Basavanagudi, UB City, Gandhi Bazaar, VV Puram | 28 |
| B | Page 2 of restaurants and bars in the 12 main focus areas | 48 |
| C | Banashankari, Bannerghatta Rd, BTM (Super Suggest zone) + 18 city-wide "best of" | 44 |
| D | Page 3 of restaurants, page 2 of cafés in the main areas | 48 |
| E | Page 3 of bars in the busiest areas, more Super Suggest zone, specials page 2 | 32 |

Focus areas: Indiranagar, Koramangala, Church Street/Lavelle Road, MG
Road/Brigade Road, UB City, Malleshwaram, Basavanagudi (Gandhi Bazaar, VV
Puram), Jayanagar, J. P. Nagar, HSR Layout, Whitefield, Bellandur, Sarjapur
Road.

Check a key's balance for free with `npm run data:credits`. To spend more
later, add queries (or a new tier) to `plan()` — cached ones never re-run.

### Photos for places only `google_local` found

`google_local` returns no photo URL, only a small inline JPEG (90×90). The
fetch script saves those to `data/raw/searchapi-local-images/`, and
`data:build` copies the ones it needs into `public/photos/`, so these
places still get a real (small) picture. Commit both folders.

### How merging works (`data:build`)

- A Google result within 250 m of an OSM venue with a similar name (token
  overlap, ignoring words like "bar", "restaurant", "Bangalore") enriches that
  venue. The OSM id is kept, so user favorites survive rebuilds.
- Unmatched Google results become new places with a `g:<place_id>` id.
- **Cost for two** is approximate. It uses, in order: Google's per-person
  price range × 2 (from `google_local`), an explicit "₹X for two" in the review snippet, or the
  Google price level (₹–₹₹₹₹). The app labels it as approximate.

## Other free / cheap ways to get ratings and reviews

| Option | Cost | What you get | Notes |
| --- | --- | --- | --- |
| **OpenStreetMap** (used) | Free | Names, location, cuisine, hours, features | No ratings or prices |
| **SearchApi** (used, cached) | ~1 credit per 20 places | Ratings, counts, price, photo, snippet | Best value per credit for bulk ratings |
| **SearchApi `google_maps_reviews` engine** | 1 credit per place per page | Full reviews for one place | Too expensive for bulk; fine for a handful of favourites |
| **Community stats** (built in, needs Supabase) | Free | Real ratings and actual spend for two from your own users | Grows as people log visits |

Zomato/Swiggy have no public API and their terms prohibit scraping, so
they're not used.
