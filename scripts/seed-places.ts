/**
 * Manual, budget-limited seed script — NOT part of the app build/deploy.
 *
 * Fetches Bangalore bars/restaurants/etc. from SearchApi.io's Google Maps
 * engine and upserts them into the Supabase `places` table.
 *
 * BUDGET: makes exactly QUERIES.length API calls (one per query below), a
 * hard ceiling controlled by MAX_QUERIES. Check your actual remaining
 * SearchApi quota before running — this file doesn't know your balance.
 * Do not run this repeatedly. See scripts/README.md before running.
 *
 * Usage:
 *   npm run seed -- --test   # 1 API call, prints raw + parsed JSON, no DB writes
 *   npm run seed             # full run: QUERIES.length API calls, upserts into `places`
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — fall back to whatever is already in process.env
}

import { createClient } from "@supabase/supabase-js";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { matchArea } from "./lib/matchArea";

const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SEARCHAPI_KEY) {
  throw new Error("Missing SEARCHAPI_KEY in .env.local");
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. " +
      "The service role key (not the anon key) is required because RLS " +
      "only allows writes to `places` via the service role. Find it in " +
      "Supabase dashboard -> Project Settings -> API -> service_role.",
  );
}

// Node's global fetch (unlike npm/curl/browsers) does not read HTTP_PROXY /
// HTTPS_PROXY on its own — without this, requests fail with DNS ENOTFOUND
// on networks that only route external traffic through a local proxy
// (common on corporate machines).
const proxyUrl =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.HTTP_PROXY ??
  process.env.http_proxy;
if (proxyUrl) {
  console.log(`Routing requests through proxy: ${proxyUrl}`);
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BANGALORE_LL = "@12.9716,77.5946,12z";

interface QueryConfig {
  q: string;
  place_type: string;
  ll?: string;
}

/**
 * Areas targeted for the next run, ordered ascending by how many places
 * we've already seeded there (least-covered first) — if you lower
 * MAX_QUERIES to fit a smaller budget, the highest-value queries still run
 * first. Coordinates are the average lat/lng of already-seeded places in
 * that area (grounded in real data), except Rajarajeshwari Nagar, which
 * has no seeded places yet and uses a general locality-center estimate.
 *
 * Why area-targeted at all: the original 10 queries ("bars in Bangalore",
 * etc.) all searched around the same city-wide center, and Google ranks by
 * popularity — so different category text kept surfacing the same central,
 * high-review places (24 of 145 seeded places landed in one neighborhood,
 * Ashok Nagar, versus zero in Rajarajeshwari Nagar). A tighter `ll` bias
 * per area, at zoom 14 instead of 12, should surface a different, more
 * local result set per call instead of re-fetching the same popular spots.
 */
const TARGET_AREAS: { area: string; ll: string }[] = [
  { area: "Rajarajeshwari Nagar", ll: "@12.9250,77.5121,14z" }, // 0 seeded — general estimate
  { area: "Electronic City", ll: "@12.8323,77.6479,14z" }, // 1 seeded
  { area: "Cunningham Road", ll: "@12.9861,77.5954,14z" }, // 1 seeded
  { area: "Kammanahalli", ll: "@13.0239,77.6362,14z" }, // 1 seeded
  { area: "Bellandur", ll: "@12.9299,77.6834,14z" }, // 1 seeded
  { area: "Halasuru", ll: "@12.9743,77.6213,14z" }, // 2 seeded
  { area: "Whitefield", ll: "@12.9859,77.7113,14z" }, // 3 seeded
  { area: "Malleshwaram", ll: "@13.0077,77.5594,14z" }, // 4 seeded
  { area: "HSR Layout", ll: "@12.9157,77.6481,14z" }, // 4 seeded
];

const CATEGORIES: { keyword: string; place_type: string }[] = [
  { keyword: "restaurants", place_type: "restaurant" },
  { keyword: "bars", place_type: "bar" },
  { keyword: "cafes", place_type: "cafe" },
];

// Hard ceiling on API calls for a full run: exactly MAX_QUERIES, taken from
// the front of the prioritized list below. Lower this to match your actual
// remaining SearchApi balance before running.
const MAX_QUERIES = 27;

const QUERIES: QueryConfig[] = TARGET_AREAS.flatMap(({ area, ll }) =>
  CATEGORIES.map(({ keyword, place_type }) => ({
    q: `${keyword} in ${area} Bangalore`,
    place_type,
    ll,
  })),
).slice(0, MAX_QUERIES);

type RawResult = Record<string, unknown>;

interface ParsedPlace {
  google_place_id: string;
  name: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  place_type: string;
  cuisine: null;
  vibe: string[] | null;
  rating: number | null;
  review_count: number | null;
  price_min: number | null;
  price_max: number | null;
  address: string | null;
  image_url: string | null;
  source: "seed_api";
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

/**
 * SearchApi's google_maps engine doesn't document a fixed price shape —
 * results may carry a numeric range ("₹300-600") or a symbolic level
 * ("₹₹₹"). Numeric ranges are used as-is (INR, since all queries are
 * Bangalore-scoped); symbolic levels are mapped to an approximate INR
 * cost-for-two bucket. Verify against real output with --test before
 * trusting these numbers.
 */
function parsePriceRange(raw: string | undefined): {
  price_min: number | null;
  price_max: number | null;
} {
  if (!raw) return { price_min: null, price_max: null };

  const rangeMatch = raw.match(/(\d[\d,]*)\s*[-–—]\s*(\d[\d,]*)/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1].replace(/,/g, ""));
    const max = Number(rangeMatch[2].replace(/,/g, ""));
    if (!Number.isNaN(min) && !Number.isNaN(max)) {
      return { price_min: min, price_max: max };
    }
  }

  if (/^[₹$]+$/.test(raw)) {
    const buckets: Record<number, [number, number]> = {
      1: [200, 500],
      2: [500, 1000],
      3: [1000, 2000],
      4: [2000, 5000],
    };
    const level = Math.min(raw.length, 4);
    const [price_min, price_max] = buckets[level];
    return { price_min, price_max };
  }

  return { price_min: null, price_max: null };
}

/**
 * SearchApi's google_maps engine has no structured price field at all for
 * Bangalore bars/restaurants (confirmed by inspecting raw responses,
 * including the dedicated google_maps_place details engine — neither
 * includes price/price_range/price_level for these venues). Real numbers
 * do sometimes turn up in free text though: the single review snippet
 * SearchApi includes (`review_text`) occasionally states an actual price,
 * e.g. "around ₹1,500–₹1,800 for two people". Only match explicit "for
 * two"/"for 2" mentions — per-person prices are deliberately not doubled,
 * since that would be a guess, not real data. Coverage will be partial:
 * most snippets don't mention price at all.
 */
function extractPriceForTwoFromText(text: string | undefined): {
  price_min: number | null;
  price_max: number | null;
} {
  if (!text) return { price_min: null, price_max: null };

  const forTwo = /for\s*(?:two|2)(?:\s*people)?/i;
  const WINDOW = 40;
  const nearby = (index: number, matchLength: number) =>
    forTwo.test(text.slice(Math.max(0, index - WINDOW), index + matchLength + WINDOW));

  const rangeMatch = text.match(/₹\s?([\d,]+)\s*[-–—]\s*₹?\s?([\d,]+)/);
  if (rangeMatch && nearby(rangeMatch.index!, rangeMatch[0].length)) {
    const min = Number(rangeMatch[1].replace(/,/g, ""));
    const max = Number(rangeMatch[2].replace(/,/g, ""));
    if (!Number.isNaN(min) && !Number.isNaN(max)) return { price_min: min, price_max: max };
  }

  const singleMatch = text.match(/₹\s?([\d,]+)/);
  if (singleMatch && nearby(singleMatch.index!, singleMatch[0].length)) {
    const value = Number(singleMatch[1].replace(/,/g, ""));
    if (!Number.isNaN(value)) return { price_min: value, price_max: value };
  }

  return { price_min: null, price_max: null };
}

function parsePlace(r: RawResult, place_type: string): ParsedPlace | null {
  const google_place_id = str(r.place_id) ?? str(r.data_id);
  if (!google_place_id) {
    console.warn(`  Skipping result with no place_id: ${str(r.title) ?? "(untitled)"}`);
    return null;
  }

  const gps = r.gps_coordinates as Record<string, unknown> | undefined;
  const rawPrice = str(r.price) ?? str(r.price_range) ?? str(r.price_level);
  const types = r.types;
  const rawType = str(r.type) ?? (Array.isArray(types) ? str(types[0]) : undefined);
  const structuredPrice = parsePriceRange(rawPrice);
  const { price_min, price_max } =
    structuredPrice.price_min !== null
      ? structuredPrice
      : extractPriceForTwoFromText(str(r.review_text));
  const address = str(r.address) ?? null;

  return {
    google_place_id,
    name: str(r.title) ?? str(r.name) ?? "Unknown",
    area: matchArea(address),
    lat: num(gps?.latitude) ?? num(r.latitude),
    lng: num(gps?.longitude) ?? num(r.longitude),
    place_type,
    cuisine: null,
    vibe: rawType ? [rawType.toLowerCase()] : null,
    rating: num(r.rating),
    review_count: num(r.reviews) ?? num(r.reviews_count),
    price_min,
    price_max,
    address,
    image_url: str(r.thumbnail) ?? null,
    source: "seed_api",
  };
}

async function callSearchApi(query: string, ll: string): Promise<RawResult[]> {
  const url = new URL("https://www.searchapi.io/api/v1/search");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("ll", ll);
  url.searchParams.set("api_key", SEARCHAPI_KEY!);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SearchApi request failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { local_results?: RawResult[] };
  return json.local_results ?? [];
}

async function main() {
  const testMode = process.argv.includes("--test");
  const queries = testMode ? QUERIES.slice(0, 1) : QUERIES;

  console.log(
    testMode
      ? "Running in --test mode: 1 API call, no DB writes.\n"
      : `Running full seed: ${queries.length} API calls against SearchApi.io. ` +
        `Confirm this fits your remaining quota before continuing.\n`,
  );

  // Existing place IDs, fetched once via Supabase (no API cost) — lets us
  // report how many results per query are actually new, so future targeting
  // can be tuned without guessing at per-call efficiency.
  let alreadySeeded = new Set<string>();
  if (!testMode) {
    const { data } = await supabase.from("places").select("google_place_id");
    alreadySeeded = new Set(
      (data ?? [])
        .map((r) => r.google_place_id)
        .filter((id): id is string => id !== null),
    );
  }

  let totalFetched = 0;
  const dedupMap = new Map<string, ParsedPlace>();

  for (const { q, place_type, ll } of queries) {
    console.log(`Fetching: "${q}"...`);
    let results: RawResult[];
    try {
      results = await callSearchApi(q, ll ?? BANGALORE_LL);
    } catch (err) {
      const cause = (err as Error & { cause?: unknown }).cause;
      console.error(`  Failed: ${(err as Error).message}`);
      if (cause) console.error(`  Cause: ${String(cause)}`);
      if (testMode) {
        console.log("\n--test mode: request failed, stopping (nothing written to Supabase).");
        return;
      }
      continue;
    }
    console.log(`  Got ${results.length} raw results`);
    totalFetched += results.length;

    if (testMode) {
      console.log("\nFirst 3 raw results:");
      console.log(JSON.stringify(results.slice(0, 3), null, 2));
      console.log("\nParsed:");
      console.log(
        JSON.stringify(
          results.slice(0, 3).map((r) => parsePlace(r, place_type)),
          null,
          2,
        ),
      );
      console.log("\n--test mode: stopping after 1 query, nothing written to Supabase.");
      return;
    }

    let newInThisQuery = 0;
    for (const r of results) {
      const parsed = parsePlace(r, place_type);
      if (!parsed) continue;
      dedupMap.set(parsed.google_place_id, parsed);
      if (!alreadySeeded.has(parsed.google_place_id)) newInThisQuery++;
    }
    console.log(`  ${newInThisQuery} of ${results.length} not already in the database`);

    // Gentle pacing between calls — not required by SearchApi, just polite.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const uniquePlaces = [...dedupMap.values()];
  const withPriceRange = uniquePlaces.filter((p) => p.price_min !== null).length;
  const withImage = uniquePlaces.filter((p) => p.image_url !== null).length;
  const netNew = uniquePlaces.filter((p) => !alreadySeeded.has(p.google_place_id)).length;

  console.log(`\nUpserting ${uniquePlaces.length} unique places into Supabase...`);
  const { data, error } = await supabase
    .from("places")
    .upsert(uniquePlaces, { onConflict: "google_place_id" })
    .select("id");

  if (error) {
    console.error("Upsert failed:", error.message);
    process.exit(1);
  }

  console.log("\n=== Summary ===");
  console.log(`Queries run:        ${queries.length}`);
  console.log(`Total fetched:      ${totalFetched}`);
  console.log(`Unique after dedup: ${uniquePlaces.length}`);
  console.log(`Net new places:     ${netNew}`);
  console.log(`Had a price range:  ${withPriceRange} (mined from review text — no structured price field exists for these venues)`);
  console.log(`Had an image:       ${withImage}`);
  console.log(`Upserted rows:      ${data?.length ?? 0}`);
  console.log(`\nNew places per API call this run: ${(netNew / queries.length).toFixed(1)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
