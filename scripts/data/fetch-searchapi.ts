/**
 * Paid enrichment via SearchApi.io (1 credit per query, ~20 places each).
 * Each search runs on two engines, which return different fields for the
 * same Google places (matched by place_id at build time):
 *
 *   google_maps   rating, review count, hours, photo, description, phone,
 *                 website, booking link        -> data/raw/searchapi/
 *   google_local  rating, review count and the per-person PRICE RANGE
 *                 (google_maps never returns price) -> data/raw/searchapi-local/
 *
 * Every response is cached and committed to the repo, so a credit is never
 * spent twice — re-runs only fetch what isn't cached. Run `npm run data:build`
 * afterwards.
 *
 * Usage:
 *   npm run data:enrich -- --dry-run        # list planned calls + credit cost, no calls
 *   npm run data:enrich -- --test           # 1 call, prints raw JSON for the first result
 *   npm run data:enrich -- --budget 40      # spend at most 40 credits (default 20)
 *   npm run data:enrich -- --refresh        # ignore cache (re-spends credits!)
 */
import "../lib/env";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { AREAS } from "../../src/lib/areas";
import { CACHE_DIRS, LOCAL_IMAGES_DIR, type CachedQuery, type Engine } from "../lib/searchapi";

interface PlannedCall {
  q: string;
  ll: string;
  page?: number;
  tier: string;
  engine: Engine;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const CITY_LL = "@12.9716,77.5946,12z";
const areaLl = (lat: number, lng: number) => `@${lat},${lng},14z`;

interface PlannedQuery {
  q: string;
  ll: string;
  page?: number;
  /** Which phase of the plan this belongs to, shown in --dry-run. */
  tier: string;
}

/**
 * Focus areas (chosen Oct 2026). Coordinates bias Google Maps toward the
 * neighbourhood; the name goes into the query text.
 */
const FOCUS = {
  indiranagar: { name: "Indiranagar", lat: 12.9716, lng: 77.6412 },
  koramangala: { name: "Koramangala", lat: 12.9352, lng: 77.6146 },
  church: { name: "Church Street/Lavelle Road", lat: 12.9718, lng: 77.5985 },
  mgRoad: { name: "MG Road/Brigade Road", lat: 12.9752, lng: 77.6065 },
  ubCity: { name: "UB City", lat: 12.9716, lng: 77.596 },
  malleshwaram: { name: "Malleshwaram", lat: 13.0077, lng: 77.5694 },
  basavanagudi: { name: "Basavanagudi", lat: 12.9422, lng: 77.576 },
  gandhiBazaar: { name: "Gandhi Bazaar", lat: 12.9445, lng: 77.5712 },
  vvPuram: { name: "VV Puram", lat: 12.9496, lng: 77.574 },
  jayanagar: { name: "Jayanagar", lat: 12.9293, lng: 77.5852 },
  jpNagar: { name: "J. P. Nagar", lat: 12.906, lng: 77.5836 },
  hsr: { name: "HSR Layout", lat: 12.9121, lng: 77.6446 },
  whitefield: { name: "Whitefield", lat: 12.9698, lng: 77.75 },
  bellandur: { name: "Bellandur", lat: 12.9299, lng: 77.6834 },
  sarjapur: { name: "Sarjapur Road", lat: 12.901, lng: 77.687 },
  // Inside the Super Suggest zone (Bosch Adugodi / RR Nagar / HSR overlap).
  btm: { name: "BTM Layout", lat: 12.9166, lng: 77.6101 },
  banashankari: { name: "Banashankari", lat: 12.925, lng: 77.5567 },
  bannerghatta: { name: "Bannerghatta Road", lat: 12.8894, lng: 77.5972 },
};

/** The 12 main focus neighbourhoods that get deeper (page 2/3) searches. */
const MAIN = [
  FOCUS.indiranagar, FOCUS.koramangala, FOCUS.church, FOCUS.mgRoad, FOCUS.malleshwaram, FOCUS.basavanagudi,
  FOCUS.jayanagar, FOCUS.jpNagar, FOCUS.hsr, FOCUS.whitefield, FOCUS.bellandur, FOCUS.sarjapur,
];

const CITY_SPECIALS = [
  "best biryani in Bangalore",
  "best south indian breakfast in Bangalore",
  "best north indian restaurants in Bangalore",
  "best pan asian restaurants in Bangalore",
  "best italian restaurants in Bangalore",
  "best seafood restaurants in Bangalore",
  "best buffet restaurants in Bangalore",
  "best kebab restaurants in Bangalore",
  "best andhra restaurants in Bangalore",
  "best kerala restaurants in Bangalore",
  "best mangalorean restaurants in Bangalore",
  "best sushi and japanese restaurants in Bangalore",
  "best dessert places in Bangalore",
  "best brunch places in Bangalore",
  "best cocktail bars in Bangalore",
  "pubs with live music in Bangalore",
  "best sports bars in Bangalore",
  "best romantic restaurants in Bangalore",
];

/**
 * Ordered by value so any budget cut-off keeps the most useful results, and
 * each query is immediately followed by its other-engine twin so every place
 * fetched gets both halves (rating/photo/hours + price).
 *
 *   done  the original 100-credit run (cached)
 *   A     fill page-1 gaps: every focus area gets restaurants, bars, cafés
 *   B     page 2 of restaurants and bars in the 12 main areas
 *   C     Super Suggest zone extras + city-wide "best of" by cuisine/occasion
 *   D     page 3 of restaurants, page 2 of cafés in the main areas
 *   E     deeper nightlife, Super Suggest zone extras, specials page 2
 */
function plan(): PlannedCall[] {
  const core = AREAS.filter((a) => a.tier === "core");
  const firstCafes = ["Indiranagar", "Koramangala", "HSR Layout", "Church Street/Lavelle Road"];
  const doneAreas = core.map((a) => a.name);
  const at = (a: { lat: number; lng: number }) => areaLl(a.lat, a.lng);
  const q = (text: string, a: { lat: number; lng: number }, tier: string, page?: number): PlannedQuery => ({ q: text, ll: at(a), tier, page });

  const queries: PlannedQuery[] = [
    ...core.map((a) => q(`bars and pubs in ${a.name} Bangalore`, a, "done")),
    ...core.map((a) => q(`best restaurants in ${a.name} Bangalore`, a, "done")),
    { q: "microbreweries in Bangalore", ll: CITY_LL, tier: "done" },
    { q: "rooftop bars in Bangalore", ll: CITY_LL, tier: "done" },
    { q: "nightclubs in Bangalore", ll: CITY_LL, tier: "done" },
    { q: "fine dining restaurants in Bangalore", ll: CITY_LL, tier: "done" },
    ...core.filter((a) => firstCafes.includes(a.name)).map((a) => q(`cafes in ${a.name} Bangalore`, a, "done")),

    ...MAIN.filter((a) => !doneAreas.includes(a.name)).flatMap((a) => [
      q(`best restaurants in ${a.name} Bangalore`, a, "A"),
      q(`bars and pubs in ${a.name} Bangalore`, a, "A"),
    ]),
    ...MAIN.filter((a) => !firstCafes.includes(a.name)).map((a) => q(`cafes in ${a.name} Bangalore`, a, "A")),
    q("best restaurants in UB City Bangalore", FOCUS.ubCity, "A"),
    q("bars and lounges in UB City Bangalore", FOCUS.ubCity, "A"),
    q("best restaurants in Gandhi Bazaar Basavanagudi Bangalore", FOCUS.gandhiBazaar, "A"),
    q("VV Puram food street Bangalore", FOCUS.vvPuram, "A"),

    ...MAIN.flatMap((a) => [
      q(`best restaurants in ${a.name} Bangalore`, a, "B", 2),
      q(`bars and pubs in ${a.name} Bangalore`, a, "B", 2),
    ]),

    q("best restaurants in Banashankari Bangalore", FOCUS.banashankari, "C"),
    q("bars and pubs in Banashankari Bangalore", FOCUS.banashankari, "C"),
    q("best restaurants in Bannerghatta Road Bangalore", FOCUS.bannerghatta, "C"),
    q("best restaurants in BTM Layout Bangalore", FOCUS.btm, "C", 2),
    ...CITY_SPECIALS.map((text) => ({ q: text, ll: CITY_LL, tier: "C" })),

    ...MAIN.map((a) => q(`best restaurants in ${a.name} Bangalore`, a, "D", 3)),
    ...MAIN.map((a) => q(`cafes in ${a.name} Bangalore`, a, "D", 2)),

    // E — spare credits: deeper nightlife in the busiest areas, the Super
    // Suggest zone, and second pages of the city-wide specials.
    q("bars and pubs in Indiranagar Bangalore", FOCUS.indiranagar, "E", 3),
    q("bars and pubs in Koramangala Bangalore", FOCUS.koramangala, "E", 3),
    q("bars and pubs in Church Street/Lavelle Road Bangalore", FOCUS.church, "E", 3),
    q("bars and pubs in J. P. Nagar Bangalore", FOCUS.jpNagar, "E", 3),
    q("bars and pubs in Whitefield Bangalore", FOCUS.whitefield, "E", 3),
    q("bars and pubs in BTM Layout Bangalore", FOCUS.btm, "E", 2),
    q("cafes in BTM Layout Bangalore", FOCUS.btm, "E"),
    q("best restaurants in Banashankari Bangalore", FOCUS.banashankari, "E", 2),
    q("cafes in Banashankari Bangalore", FOCUS.banashankari, "E"),
    q("best restaurants in Bannerghatta Road Bangalore", FOCUS.bannerghatta, "E", 2),
    { q: "microbreweries in Bangalore", ll: CITY_LL, tier: "E", page: 2 },
    { q: "rooftop bars in Bangalore", ll: CITY_LL, tier: "E", page: 2 },
    { q: "fine dining restaurants in Bangalore", ll: CITY_LL, tier: "E", page: 2 },
    { q: "best rooftop restaurants in Bangalore", ll: CITY_LL, tier: "E" },
    { q: "best pure veg restaurants in Bangalore", ll: CITY_LL, tier: "E" },
    { q: "late night restaurants in Bangalore", ll: CITY_LL, tier: "E" },
  ];
  return queries.flatMap((x) => [
    { ...x, engine: "google_maps" as const },
    { ...x, engine: "google_local" as const },
  ]);
}

const cachePath = (p: PlannedCall) => `${CACHE_DIRS[p.engine]}/${slugify(p.q)}${p.page && p.page > 1 ? `-p${p.page}` : ""}.json`;

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

// Fields that are huge (inline base64 images) or useless after the fact.
const DROP_FIELDS = ["image", "link", "reservation_links", "reviews_link", "kgmid", "ludocid"];

async function callSearchApi(key: string, { q, ll, engine, page }: PlannedCall) {
  const url = new URL("https://www.searchapi.io/api/v1/search");
  url.searchParams.set("engine", engine);
  url.searchParams.set("q", q);
  if (engine === "google_maps") url.searchParams.set("ll", ll);
  else url.searchParams.set("location", "Bengaluru,Karnataka,India");
  if (page && page > 1) url.searchParams.set("page", String(page));
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "in");
  url.searchParams.set("api_key", key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SearchApi ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { local_results?: Record<string, unknown>[] };
  return (json.local_results ?? []).map((r) => {
    const out = { ...r };
    // google_local has no photo URL, only a small inline JPEG. Save it as a
    // file so places found only by this engine still get a real picture.
    const image = typeof r.image === "string" ? r.image : "";
    const pid = typeof r.place_id === "string" ? r.place_id : "";
    const m = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (engine === "google_local" && m && pid) {
      mkdirSync(LOCAL_IMAGES_DIR, { recursive: true });
      writeFileSync(`${LOCAL_IMAGES_DIR}/${pid}.${m[1] === "png" ? "png" : m[1] === "webp" ? "webp" : "jpg"}`, Buffer.from(m[2], "base64"));
    }
    for (const f of DROP_FIELDS) delete out[f];
    return out;
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const test = process.argv.includes("--test");
  const refresh = process.argv.includes("--refresh");
  const budget = Number(argValue("--budget") ?? 20);

  const all = plan();
  const todo = all.filter((p) => refresh || !existsSync(cachePath(p)));
  const batch = test ? todo.slice(0, 1) : todo.slice(0, budget);

  console.log(`${all.length} planned calls, ${all.length - todo.length} already cached.`);
  console.log(`This run: ${batch.length} API call(s) = ${batch.length} SearchApi credit(s).\n`);

  if (dryRun) {
    batch.forEach((p, i) =>
      console.log(`${String(i + 1).padStart(3)}. ${p.tier} [${p.engine === "google_maps" ? "maps " : "local"}] ${p.q}${p.page && p.page > 1 ? ` (page ${p.page})` : ""}`),
    );
    const byTier = new Map<string, number>();
    for (const p of todo) byTier.set(p.tier, (byTier.get(p.tier) ?? 0) + 1);
    console.log("\nCredits still needed per tier:", Object.fromEntries(byTier));
    if (todo.length > batch.length) console.log(`\n${todo.length - batch.length} more queued beyond --budget.`);
    return;
  }

  const key = process.env.SEARCHAPI_KEY;
  if (!key) throw new Error("Missing SEARCHAPI_KEY in .env.local (get one at https://www.searchapi.io/)");

  Object.values(CACHE_DIRS).forEach((d) => mkdirSync(d, { recursive: true }));
  let spent = 0;
  let places = 0;

  for (const call of batch) {
    process.stdout.write(`[${spent + 1}/${batch.length}] ${call.engine === "google_maps" ? "maps " : "local"} ${call.q}${call.page && call.page > 1 ? ` p${call.page}` : ""} ... `);
    try {
      const results = await callSearchApi(key, call);
      spent++;
      places += results.length;
      const cached: CachedQuery = { q: call.q, ll: call.ll, page: call.page, engine: call.engine, fetchedAt: new Date().toISOString(), results };
      writeFileSync(cachePath(call), JSON.stringify(cached, null, 1));
      console.log(`${results.length} results`);
      if (test) {
        console.log("\nRaw first result:\n");
        console.log(JSON.stringify(results[0], null, 2));
      }
    } catch (err) {
      console.log(`FAILED — ${(err as Error).message}`);
      if (/401|402|403|429/.test((err as Error).message)) {
        console.log("Stopping: looks like an auth or quota problem.");
        break;
      }
    }
  }

  console.log(`\nDone. Spent ${spent} credit(s), got ${places} results. Now run: npm run data:build`);
}

main();
