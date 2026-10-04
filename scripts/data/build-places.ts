/**
 * Builds public/data/places.json (the app's entire place catalogue) from:
 *   1. data/raw/osm.json            — OpenStreetMap base layer (npm run data:osm)
 *   2. data/raw/searchapi/*.json    — cached Google Maps enrichment (npm run data:enrich)
 *
 * Free and offline: no API calls. Safe to re-run any time.
 *
 * Usage: npm run data:build
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Place, PlaceType, PlacesFile, PlaceReview } from "../../src/lib/types";
import { parseGoogleWeek, parseOsmHours } from "../../src/lib/hours";
import { haversineKm } from "../../src/lib/geo";
import { BANGALORE_BBOX } from "../../src/lib/areas";
import { nameSimilarity, nearestArea, normalizeCuisine } from "../lib/normalize";
import { priceForTwoFromRange, priceForTwoFromText, priceLevelFromSymbols } from "../lib/price";
import { CACHE_DIRS, LOCAL_IMAGES_DIR, type CachedQuery } from "../lib/searchapi";

type Tags = Record<string, string>;
interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Tags;
}
type Raw = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const firstOf = (v: string | undefined) => v?.split(";")[0].trim() || undefined;

function inBangalore(lat: number, lng: number) {
  const [s, w, n, e] = BANGALORE_BBOX;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}

// ---------------------------------------------------------------------------
// OSM
// ---------------------------------------------------------------------------

function osmType(t: Tags): PlaceType {
  const name = t.name.toLowerCase();
  if (t.amenity === "nightclub") return "nightclub";
  if (t.craft === "brewery" || t.microbrewery === "yes" || t.amenity === "biergarten" || /brew/.test(name)) return "brewery";
  if (t.amenity === "pub") return "pub";
  if (t.amenity === "bar") return "bar";
  if (t.amenity === "cafe") return "cafe";
  return "restaurant";
}

function osmFeatures(t: Tags, type: PlaceType): string[] {
  const f = new Set<string>();
  const yes = (k: string) => t[k] === "yes";
  if (yes("outdoor_seating")) f.add("Outdoor seating");
  if (t["diet:vegetarian"] === "only") f.add("Pure veg");
  else if (t["diet:vegetarian"] === "yes") f.add("Veg friendly");
  if (t["diet:vegan"] === "yes" || t["diet:vegan"] === "only") f.add("Vegan options");
  if (t.internet_access && t.internet_access !== "no") f.add("Wi-Fi");
  if (yes("live_music")) f.add("Live music");
  if (yes("air_conditioning")) f.add("AC");
  if (yes("reservation") || t.reservation === "recommended") f.add("Reservations");
  if (yes("delivery")) f.add("Delivery");
  if (yes("wheelchair")) f.add("Wheelchair accessible");
  if (t.sport || /sports/i.test(t.name)) f.add("Sports screening");
  if (/roof|terrace|sky/i.test(t.name)) f.add("Rooftop");
  if (type === "brewery") f.add("Craft beer");
  return [...f];
}

function osmAddress(t: Tags): string | undefined {
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const parts = [t["addr:housename"], street, t["addr:suburb"] ?? t["addr:place"]].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function fromOsm(el: OsmElement): Place | null {
  const t = el.tags;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!t.name || lat === undefined || lng === undefined || !inBangalore(lat, lng)) return null;
  const type = osmType(t);
  const place: Place = {
    id: `osm:${el.type[0]}${el.id}`,
    name: t.name.trim(),
    type,
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    area: nearestArea(lat, lng),
    address: osmAddress(t),
    cuisine: normalizeCuisine(t.cuisine),
    features: osmFeatures(t, type),
    hours: parseOsmHours(t.opening_hours) ?? undefined,
    phone: firstOf(t.phone ?? t["contact:phone"]),
    website: firstOf(t.website ?? t["contact:website"]),
    description: t.description,
  };
  return place;
}

// ---------------------------------------------------------------------------
// SearchApi (Google Maps)
// ---------------------------------------------------------------------------

const NON_CUISINE = /^(family|fine dining|vegetarian|vegan|buffet|takeout|delivery|bar & grill|modern|traditional|casual|bistro|eatery|diner|lounge|pub|bar|cafe|restaurant)$/i;

function googleType(types: string[]): PlaceType {
  const s = types.join(" | ").toLowerCase();
  if (/night ?club|disco/.test(s)) return "nightclub";
  if (/brew/.test(s)) return "brewery";
  if (/\bpub\b|gastropub/.test(s)) return "pub";
  if (/juice|snack bar|coffee|\bcaf[eé]\b|tea house|bakery|dessert|ice cream/.test(s) && !/cocktail|wine bar|\bbar\b(?! &)/.test(types[0]?.toLowerCase() ?? "")) {
    return /restaurant/.test(types[0]?.toLowerCase() ?? "") ? "restaurant" : "cafe";
  }
  if (/\bbar\b|lounge|cocktail|wine|tavern/.test(s)) return "bar";
  return "restaurant";
}

function googleCuisine(types: string[]): string[] {
  const out: string[] = [];
  for (const t of types) {
    const m = t.match(/^(.+?) restaurant$/i);
    if (m && !NON_CUISINE.test(m[1])) out.push(m[1].replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  return out;
}

const FEATURE_KEYWORDS: [RegExp, string][] = [
  [/outdoor seating/i, "Outdoor seating"],
  [/rooftop/i, "Rooftop"],
  [/live music|live performances/i, "Live music"],
  [/cocktails/i, "Cocktails"],
  [/craft beer|brewpub/i, "Craft beer"],
  [/sports/i, "Sports screening"],
  [/wi-?fi/i, "Wi-Fi"],
  [/romantic|date/i, "Date night"],
  [/groups/i, "Good for groups"],
  [/reservations? (accepted|required)|accepts reservations/i, "Reservations"],
  [/vegetarian options|vegetarian restaurant/i, "Veg friendly"],
  [/buffet/i, "Buffet"],
  [/happy hour/i, "Happy hours"],
  [/late-night/i, "Late night"],
  [/dog|pet/i, "Pet friendly"],
  [/fine dining/i, "Fine dining"],
  [/work|laptop/i, "Work friendly"],
  [/wheelchair-accessible (entrance|seating)/i, "Wheelchair accessible"],
  [/lgbtq/i, "LGBTQ+ friendly"],
];

/** Google thumbnails are served at any size via the "=w..-h.." suffix; store a mid size, the app resizes. */
function normalizePhoto(url: string | undefined) {
  if (!url) return undefined;
  return /googleusercontent\.com/.test(url) ? url.replace(/=w\d+-h\d+(-[a-z-]+)?$/, "=w400-h300-k-no") : url;
}

/**
 * Some Google listings pad names for SEO: "Attarinti Vantakaalu | Authentic
 * Andhra Restaurant", "No.10 Fort Cochin - Seafood Restaurant in Marathahalli,
 * Bangalore". Keep the venue's actual name.
 */
export function cleanName(name: string): string {
  let n = name.split(/\s+\|\s+/)[0];
  n = n.replace(/\s*[-–,]?\s+(?:in|at)\s+[^,]+,?\s*(?:bangalore|bengaluru)\s*$/i, "");
  n = n.replace(/\s*[-–,]\s*(?:bangalore|bengaluru)\s*$/i, "");
  return n.trim() || name;
}

/** Collects every string inside `extensions` / `service_options` etc. — the shape varies by listing. */
function collectStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => {
    if (x === true) out.push(k.replace(/_/g, " "));
    else collectStrings(x, out);
  });
  return out;
}

function googleReview(r: Raw): PlaceReview | undefined {
  const text = str(r.review_text) ?? str(r.user_review) ?? str(r.snippet);
  if (text) return { text: text.replace(/^"|"$/g, "") };
  const reviews = r.reviews_results ?? r.top_reviews;
  if (Array.isArray(reviews) && reviews[0]) {
    const first = reviews[0] as Raw;
    const t = str(first.text) ?? str(first.snippet);
    if (t) return { text: t, author: str((first.user as Raw)?.name) ?? str(first.author), rating: num(first.rating) };
  }
  return undefined;
}

function fromSearchApi(r: Raw): Place | null {
  const gid = str(r.place_id) ?? str(r.data_id);
  const gps = (r.gps_coordinates ?? {}) as Raw;
  const lat = num(gps.latitude) ?? num(r.latitude);
  const lng = num(gps.longitude) ?? num(r.longitude);
  const rawName = str(r.title) ?? str(r.name);
  const name = rawName && cleanName(rawName);
  if (!gid || !name || lat === undefined || lng === undefined || !inBangalore(lat, lng)) return null;

  const types = [str(r.type), ...(Array.isArray(r.types) ? r.types.map(str) : [])].filter(
    (t): t is string => !!t,
  );
  if (types.length && types.every((t) => /hotel|lodging|resort|supermarket|grocery|store|bakery shop/i.test(t))) {
    return null;
  }
  const type = googleType(types.length ? types : ["restaurant"]);
  const rawPrice = str(r.price) ?? str(r.price_range) ?? str(r.price_level);
  const review = googleReview(r);
  const priceForTwo = priceForTwoFromRange(rawPrice) ?? priceForTwoFromText(review?.text) ?? undefined;
  const priceLevel = priceForTwo ? undefined : priceLevelFromSymbols(rawPrice) ?? undefined;

  const extText = collectStrings([r.extensions, r.service_options, r.highlights, r.description]).join(" | ");
  const temporarilyClosed = /temporarily closed/i.test(extText) || /temporarily closed/i.test(str(r.open_state) ?? "");
  const features = new Set<string>();
  for (const [re, label] of FEATURE_KEYWORDS) if (re.test(extText)) features.add(label);
  if (type === "brewery") features.add("Craft beer");
  if (types.some((t) => /vegetarian restaurant/i.test(t))) features.add("Pure veg");
  const reservation = r.reservation as Raw | undefined;
  const bookingUrl = str(reservation?.link);
  if (bookingUrl) features.add("Reservations");

  return {
    id: `g:${gid}`,
    name,
    type,
    lat: +lat.toFixed(6),
    lng: +lng.toFixed(6),
    area: nearestArea(lat, lng),
    address: str(r.address),
    cuisine: googleCuisine(types),
    features: [...features],
    hours: parseGoogleWeek((r.operating_hours ?? r.open_hours ?? r.hours) as Raw | undefined) ?? undefined,
    phone: str(r.phone),
    website: str(r.website),
    rating: num(r.rating),
    ratingCount: num(r.reviews) ?? num(r.reviews_count) ?? num(r.user_ratings_total),
    priceForTwo,
    priceLevel,
    photo: normalizePhoto(str(r.thumbnail)),
    googleId: str(r.place_id),
    bookingUrl,
    // google_local's "comment" is a one-line Google summary ("Stylish bar with global fare & cocktails").
    description: str(r.description) ?? str(r.comment),
    status: temporarilyClosed ? "temporarily_closed" : undefined,
    review,
  };
}

/**
 * The same Google place can arrive from several queries and from both
 * engines (google_maps has hours/photos, google_local has prices). Keep the
 * first record's values and fill its gaps from the other.
 */
function fillGaps(primary: Place, other: Place): Place {
  const out = { ...primary } as Record<string, unknown>;
  for (const [k, v] of Object.entries(other)) {
    if (out[k] === undefined || (Array.isArray(out[k]) && !(out[k] as unknown[]).length)) out[k] = v;
  }
  out.features = union(primary.features, other.features);
  out.cuisine = union(primary.cuisine, other.cuisine);
  return out as unknown as Place;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

function union(a?: string[], b?: string[]) {
  const s = new Set([...(a ?? []), ...(b ?? [])]);
  return s.size ? [...s] : undefined;
}

/** Fold Google data into an OSM place. Google wins for live-ish facts (rating, hours, price); OSM keeps its id. */
function enrich(base: Place, g: Place): Place {
  const upgradeType = base.type === "restaurant" && g.type !== "restaurant" && g.type !== "cafe";
  return {
    ...base,
    type: upgradeType ? g.type : base.type,
    address: g.address ?? base.address,
    cuisine: union(base.cuisine, g.cuisine),
    features: union(base.features, g.features),
    hours: g.hours ?? base.hours,
    phone: base.phone ?? g.phone,
    website: base.website ?? g.website,
    rating: g.rating,
    ratingCount: g.ratingCount,
    priceForTwo: g.priceForTwo ?? base.priceForTwo,
    priceLevel: g.priceLevel ?? base.priceLevel,
    photo: g.photo ?? base.photo,
    googleId: g.googleId,
    bookingUrl: g.bookingUrl,
    status: g.status,
    description: g.description ?? base.description,
    review: g.review,
  };
}

/** Spatial grid (~550m cells) so matching 5k x 2k places stays fast. */
class Grid {
  private cells = new Map<string, Place[]>();
  private key(lat: number, lng: number) {
    return `${Math.floor(lat * 200)}:${Math.floor(lng * 200)}`;
  }
  add(p: Place) {
    const k = this.key(p.lat, p.lng);
    (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(p);
  }
  near(lat: number, lng: number): Place[] {
    const cy = Math.floor(lat * 200);
    const cx = Math.floor(lng * 200);
    const out: Place[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(...(this.cells.get(`${cy + dy}:${cx + dx}`) ?? []));
    return out;
  }
}

function findMatch(grid: Grid, p: Place, maxKm: number): Place | null {
  let best: { place: Place; score: number } | null = null;
  for (const c of grid.near(p.lat, p.lng)) {
    const d = haversineKm(p, c);
    if (d > maxKm) continue;
    const sim = nameSimilarity(p.name, c.name);
    const needed = d < 0.06 ? 0.5 : 0.67;
    if (sim < needed) continue;
    const score = sim - d;
    if (!best || score > best.score) best = { place: c, score };
  }
  return best?.place ?? null;
}

function stripEmpty(p: Place): Place {
  const out = { ...p } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) {
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) delete out[k];
  }
  return out as unknown as Place;
}

function main() {
  const places = new Map<string, Place>();
  const grid = new Grid();

  // 1. OSM base, de-duplicating node/way pairs for the same venue.
  let osmCount = 0;
  if (existsSync("data/raw/osm.json")) {
    const { elements } = JSON.parse(readFileSync("data/raw/osm.json", "utf8")) as { elements: OsmElement[] };
    for (const el of elements) {
      const p = fromOsm(el);
      if (!p) continue;
      if (findMatch(grid, p, 0.05)) continue;
      places.set(p.id, p);
      grid.add(p);
      osmCount++;
    }
  } else {
    console.warn("data/raw/osm.json missing — run `npm run data:osm` for the free base layer.");
  }

  // 2. SearchApi enrichment, de-duplicated by Google id across queries.
  // google_maps first so its exact review counts, hours and photos win;
  // google_local then fills in prices.
  const google = new Map<string, Place>();
  let files = 0;
  for (const dir of [CACHE_DIRS.google_maps, CACHE_DIRS.google_local]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      files++;
      const cached = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as CachedQuery;
      for (const r of cached.results) {
        const g = fromSearchApi(r);
        if (!g) continue;
        const prev = google.get(g.id);
        google.set(g.id, prev ? fillGaps(prev, g) : g);
      }
    }
  }

  // Places only google_local found have no photo URL — use the thumbnail it
  // returned inline (saved by fetch-searchapi), served from /photos/.
  rmSync("public/photos", { recursive: true, force: true });
  let localPhotos = 0;
  if (existsSync(LOCAL_IMAGES_DIR)) {
    const files = new Map(readdirSync(LOCAL_IMAGES_DIR).map((f) => [f.replace(/\.\w+$/, ""), f]));
    for (const g of google.values()) {
      if (g.photo) continue;
      const file = (g.googleId && files.get(g.googleId)) || files.get(g.id.slice(2));
      if (!file) continue;
      mkdirSync("public/photos", { recursive: true });
      copyFileSync(`${LOCAL_IMAGES_DIR}/${file}`, `public/photos/${file}`);
      g.photo = `/photos/${file}`;
      localPhotos++;
    }
  }

  let matched = 0;
  let added = 0;
  for (const g of google.values()) {
    const match = findMatch(grid, g, 0.25);
    if (match) {
      places.set(match.id, enrich(match, g));
      matched++;
    } else {
      places.set(g.id, g);
      grid.add(g);
      added++;
    }
  }

  const list = [...places.values()].map(stripEmpty).sort((a, b) => a.id.localeCompare(b.id));
  const out: PlacesFile = {
    generatedAt: new Date().toISOString(),
    attribution: [
      "Place data © OpenStreetMap contributors (ODbL)",
      ...(google.size ? ["Ratings, prices and photos from Google Maps via SearchApi"] : []),
    ],
    places: list,
  };
  mkdirSync("public/data", { recursive: true });
  writeFileSync("public/data/places.json", JSON.stringify(out));

  const rated = list.filter((p) => p.rating !== undefined).length;
  const priced = list.filter((p) => p.priceForTwo || p.priceLevel).length;
  const kb = Math.round(Buffer.byteLength(JSON.stringify(out)) / 1024);
  console.log(`OSM places:            ${osmCount}`);
  console.log(`Google results:        ${google.size} from ${files} cached queries (${matched} matched to OSM, ${added} new)`);
  console.log(`Photos from google_local thumbnails: ${localPhotos}`);
  console.log(`Total places:          ${list.length}`);
  console.log(`  with Google rating:  ${rated}`);
  console.log(`  with price for two:  ${priced}`);
  console.log(`  with hours:          ${list.filter((p) => p.hours).length}`);
  console.log(`Wrote public/data/places.json (${kb} KB)`);
}

main();
