/**
 * Manual, budget-limited seed script — NOT part of the app build/deploy.
 *
 * Fetches Bangalore bars/restaurants/etc. from SearchApi.io's Google Maps
 * engine and upserts them into the Supabase `places` table.
 *
 * HARD BUDGET: this makes at most 10 API calls (one per query below). Do not
 * run this repeatedly — SearchApi's free tier is limited. See
 * scripts/README.md before running.
 *
 * Usage:
 *   npm run seed -- --test   # 1 API call, prints raw + parsed JSON, no DB writes
 *   npm run seed             # full run: 10 API calls, upserts into `places`
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — fall back to whatever is already in process.env
}

import { createClient } from "@supabase/supabase-js";
import { setGlobalDispatcher, ProxyAgent } from "undici";

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

const QUERIES: { q: string; place_type: string }[] = [
  { q: "bars in Bangalore", place_type: "bar" },
  { q: "pubs in Bangalore", place_type: "pub" },
  { q: "restaurants in Bangalore", place_type: "restaurant" },
  { q: "cafes in Bangalore", place_type: "cafe" },
  { q: "breweries in Bangalore", place_type: "brewery" },
  { q: "rooftop restaurants in Bangalore", place_type: "restaurant" },
  { q: "fine dining restaurants in Bangalore", place_type: "restaurant" },
  { q: "nightclubs in Bangalore", place_type: "nightclub" },
  { q: "wine bars in Bangalore", place_type: "bar" },
  { q: "gastropubs in Bangalore", place_type: "pub" },
];

type RawResult = Record<string, unknown>;

interface ParsedPlace {
  google_place_id: string;
  name: string;
  area: null;
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
  const { price_min, price_max } = parsePriceRange(rawPrice);

  return {
    google_place_id,
    name: str(r.title) ?? str(r.name) ?? "Unknown",
    area: null,
    lat: num(gps?.latitude) ?? num(r.latitude),
    lng: num(gps?.longitude) ?? num(r.longitude),
    place_type,
    cuisine: null,
    vibe: rawType ? [rawType.toLowerCase()] : null,
    rating: num(r.rating),
    review_count: num(r.reviews) ?? num(r.reviews_count),
    price_min,
    price_max,
    address: str(r.address) ?? null,
    source: "seed_api",
  };
}

async function callSearchApi(query: string): Promise<RawResult[]> {
  const url = new URL("https://www.searchapi.io/api/v1/search");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", query);
  url.searchParams.set("ll", BANGALORE_LL);
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
      : `Running full seed: ${queries.length} API calls against SearchApi.io.\n`,
  );

  let totalFetched = 0;
  const dedupMap = new Map<string, ParsedPlace>();

  for (const { q, place_type } of queries) {
    console.log(`Fetching: "${q}"...`);
    let results: RawResult[];
    try {
      results = await callSearchApi(q);
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

    for (const r of results) {
      const parsed = parsePlace(r, place_type);
      if (parsed) dedupMap.set(parsed.google_place_id, parsed);
    }

    // Gentle pacing between calls — not required by SearchApi, just polite.
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  const uniquePlaces = [...dedupMap.values()];
  const withPriceRange = uniquePlaces.filter((p) => p.price_min !== null).length;

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
  console.log(`Had a price range:  ${withPriceRange}`);
  console.log(`Upserted rows:      ${data?.length ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
