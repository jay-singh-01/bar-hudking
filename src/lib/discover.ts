import type { Place, PlaceType } from "./types";
import type { Coords } from "./geo";
import { haversineKm } from "./geo";
import { openStatus } from "./hours";
import type { Spot, SuperSuggestAnchor } from "./store";
import { inSuperSuggest } from "./superSuggest";

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export type PriceBand = "budget" | "mid" | "premium" | "luxury";

export const PRICE_BANDS: { id: PriceBand; label: string; hint: string; max: number }[] = [
  { id: "budget", label: "₹", hint: "under ₹800", max: 800 },
  { id: "mid", label: "₹₹", hint: "₹800–1,600", max: 1600 },
  { id: "premium", label: "₹₹₹", hint: "₹1,600–3,000", max: 3000 },
  { id: "luxury", label: "₹₹₹₹", hint: "₹3,000+", max: Infinity },
];

/** Typical Bangalore cost-for-two per Google price level — used only when no INR range exists. */
const LEVEL_TO_TWO: Record<number, [number, number]> = {
  1: [300, 700],
  2: [700, 1400],
  3: [1400, 2800],
  4: [2800, 5000],
};

export function approxPriceForTwo(p: Place): [number, number] | null {
  if (p.priceForTwo) return p.priceForTwo;
  if (p.priceLevel) return LEVEL_TO_TWO[p.priceLevel] ?? null;
  return null;
}

export function priceBand(p: Place): PriceBand | null {
  const range = approxPriceForTwo(p);
  if (!range) return null;
  const mid = (range[0] + range[1]) / 2;
  return PRICE_BANDS.find((b) => mid < b.max)!.id;
}

const inr = new Intl.NumberFormat("en-IN");

export function formatPriceForTwo(p: Place): string | null {
  const range = approxPriceForTwo(p);
  if (!range) return null;
  const [min, max] = range;
  return min === max ? `₹${inr.format(min)} for two` : `₹${inr.format(min)}–${inr.format(max)} for two`;
}

export function formatINR(n: number) {
  return `₹${inr.format(Math.round(n))}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const TYPE_META: Record<PlaceType, { label: string; plural: string; emoji: string; color: string }> = {
  restaurant: { label: "Restaurant", plural: "Restaurants", emoji: "🍽️", color: "#f59e0b" },
  bar: { label: "Bar", plural: "Bars", emoji: "🍸", color: "#a78bfa" },
  pub: { label: "Pub", plural: "Pubs", emoji: "🍺", color: "#facc15" },
  brewery: { label: "Brewery", plural: "Breweries", emoji: "🍻", color: "#fb923c" },
  cafe: { label: "Café", plural: "Cafés", emoji: "☕", color: "#34d399" },
  nightclub: { label: "Club", plural: "Clubs", emoji: "🪩", color: "#f472b6" },
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const PRIOR_MEAN = 4.0;
const PRIOR_WEIGHT = 150;

/**
 * Bayesian average: a 4.8 from 12 ratings shouldn't outrank a 4.6 from 8,000.
 * Places with no Google rating sit just below the prior so rated places
 * surface first without unrated ones disappearing.
 */
export function qualityScore(p: Place): number {
  if (p.rating === undefined) return PRIOR_MEAN - 0.35 + (p.hours ? 0.05 : 0) + (p.features?.length ? 0.03 : 0);
  const n = p.ratingCount ?? 0;
  return (PRIOR_MEAN * PRIOR_WEIGHT + p.rating * n) / (PRIOR_WEIGHT + n);
}

export function isHiddenGem(p: Place) {
  return p.rating !== undefined && p.rating >= 4.4 && (p.ratingCount ?? 0) >= 40 && (p.ratingCount ?? 0) <= 700;
}

/** "Recommended" ordering: quality, nudged toward places that are close and open. */
export function recommendScore(p: Place, coords: Coords | null, now: Date): number {
  let s = qualityScore(p);
  if (p.status === "temporarily_closed") s -= 2;
  if (coords) s -= Math.min(haversineKm(coords, p), 25) * 0.025;
  const open = openStatus(p.hours, now);
  if (open?.open) s += 0.05;
  if (p.photo) s += 0.02;
  return s;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface Filters {
  query: string;
  types: PlaceType[];
  areas: string[];
  cuisines: string[];
  features: string[];
  prices: PriceBand[];
  minRating: number | null;
  openNow: boolean;
  maxDistanceKm: number | null;
  nearMySpots: boolean;
  hideVisited: boolean;
  superSuggest: boolean;
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  types: [],
  areas: [],
  cuisines: [],
  features: [],
  prices: [],
  minRating: null,
  openNow: false,
  maxDistanceKm: null,
  nearMySpots: false,
  hideVisited: false,
  superSuggest: false,
};

/**
 * "Complete" places — a Google rating and a real photo. These are what the
 * app shows by default; the rest (mostly OpenStreetMap-only listings) appear
 * only when someone asks to see places with limited info.
 */
export function isComplete(p: Place): boolean {
  return p.rating !== undefined && !!p.photo;
}

/** Number of active filters other than the search text (for badge counts). */
export function activeFilterCount(f: Filters): number {
  return (
    f.types.length +
    f.areas.length +
    f.cuisines.length +
    f.features.length +
    f.prices.length +
    (f.minRating !== null ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.maxDistanceKm !== null ? 1 : 0) +
    (f.nearMySpots ? 1 : 0) +
    (f.hideVisited ? 1 : 0) +
    (f.superSuggest ? 1 : 0)
  );
}

export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9₹ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const searchCache = new WeakMap<Place, string>();
function haystack(p: Place) {
  let h = searchCache.get(p);
  if (!h) {
    h = normalizeText(
      [p.name, p.area, p.address, TYPE_META[p.type].label, TYPE_META[p.type].plural, ...(p.cuisine ?? []), ...(p.features ?? [])]
        .filter(Boolean)
        .join(" "),
    );
    searchCache.set(p, h);
  }
  return h;
}

/** Every query word must appear somewhere (name, area, cuisine, features...). Name matches rank higher. */
export function searchScore(p: Place, query: string): number {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (!words.length) return 1;
  const h = haystack(p);
  const name = normalizeText(p.name);
  let score = 0;
  for (const w of words) {
    if (!h.includes(w)) return 0;
    if (name.startsWith(w)) score += 3;
    else if (name.includes(` ${w}`)) score += 2;
    else if (name.includes(w)) score += 1.5;
    else score += 1;
  }
  return score;
}

export interface FilterContext {
  coords: Coords | null;
  spots: Spot[];
  anchors: SuperSuggestAnchor[];
  visitedIds: Set<string>;
  now: Date;
}

export function matchesFilters(p: Place, f: Filters, ctx: FilterContext): boolean {
  if (f.types.length && !f.types.includes(p.type)) return false;
  if (f.areas.length && (!p.area || !f.areas.includes(p.area))) return false;
  if (f.cuisines.length && !p.cuisine?.some((c) => f.cuisines.includes(c))) return false;
  if (f.features.length && !f.features.every((x) => p.features?.includes(x))) return false;
  if (f.prices.length) {
    const band = priceBand(p);
    if (!band || !f.prices.includes(band)) return false;
  }
  if (f.minRating !== null && (p.rating ?? 0) < f.minRating) return false;
  if (f.openNow && (p.status || !openStatus(p.hours, ctx.now)?.open)) return false;
  if (f.maxDistanceKm !== null && ctx.coords && haversineKm(ctx.coords, p) > f.maxDistanceKm) return false;
  if (f.nearMySpots && ctx.spots.length && !ctx.spots.some((s) => haversineKm(s, p) <= s.radiusKm)) return false;
  if (f.hideVisited && ctx.visitedIds.has(p.id)) return false;
  if (f.superSuggest && !inSuperSuggest(p, ctx.anchors)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type SortKey = "recommended" | "rating" | "popular" | "distance" | "price-low" | "price-high" | "name";

export const SORT_OPTIONS: { id: SortKey; label: string; needsLocation?: boolean }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "rating", label: "Top rated" },
  { id: "popular", label: "Most reviewed" },
  { id: "distance", label: "Nearest", needsLocation: true },
  { id: "price-low", label: "Price: low to high" },
  { id: "price-high", label: "Price: high to low" },
  { id: "name", label: "A–Z" },
];

export function sortPlaces(places: Place[], sort: SortKey, ctx: FilterContext, query: string): Place[] {
  const withKey = places.map((p) => {
    let key: number;
    switch (sort) {
      case "rating":
        key = qualityScore(p);
        break;
      case "popular":
        key = p.ratingCount ?? -1;
        break;
      case "distance":
        key = ctx.coords ? -haversineKm(ctx.coords, p) : 0;
        break;
      case "price-low": {
        const r = approxPriceForTwo(p);
        key = r ? -(r[0] + r[1]) : -1e9;
        break;
      }
      case "price-high": {
        const r = approxPriceForTwo(p);
        key = r ? r[0] + r[1] : -1e9;
        break;
      }
      case "name":
        key = 0;
        break;
      default:
        key = recommendScore(p, ctx.coords, ctx.now);
    }
    // A strong name match beats sort order when searching.
    if (query && sort === "recommended") key += searchScore(p, query) * 0.3;
    return { p, key };
  });
  if (sort === "name") return withKey.map((x) => x.p).sort((a, b) => a.name.localeCompare(b.name));
  return withKey.sort((a, b) => b.key - a.key).map((x) => x.p);
}

// ---------------------------------------------------------------------------
// Curated collections
// ---------------------------------------------------------------------------

export interface Collection {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  gradient: string;
  test: (p: Place) => boolean;
  sort: SortKey;
}

const closesLate = (p: Place) => p.hours?.some((day) => day.some(([, close]) => close >= 24 * 60 + 30)) ?? false;
const has = (p: Place, feature: string) => p.features?.includes(feature) ?? false;

const CURATED: Collection[] = [
  {
    id: "top-rated",
    title: "Bangalore's best",
    emoji: "🏆",
    blurb: "4.5★ and up, with thousands of reviews to back it",
    gradient: "from-amber-500 to-orange-600",
    test: (p) => (p.rating ?? 0) >= 4.5 && (p.ratingCount ?? 0) >= 1000,
    sort: "rating",
  },
  {
    id: "hidden-gems",
    title: "Hidden gems",
    emoji: "💎",
    blurb: "Loved by the few who know about them",
    gradient: "from-cyan-500 to-blue-600",
    test: isHiddenGem,
    sort: "rating",
  },
  {
    id: "breweries",
    title: "Brewery hopping",
    emoji: "🍻",
    blurb: "Fresh craft beer in the microbrewery capital",
    gradient: "from-orange-500 to-red-600",
    test: (p) => p.type === "brewery" || has(p, "Craft beer"),
    sort: "recommended",
  },
  {
    id: "rooftops",
    title: "Rooftops & skylines",
    emoji: "🌆",
    blurb: "Drinks with a view",
    gradient: "from-fuchsia-500 to-purple-700",
    test: (p) => has(p, "Rooftop"),
    sort: "recommended",
  },
  {
    id: "date-night",
    title: "Date night",
    emoji: "🕯️",
    blurb: "Romantic, a little fancy, worth dressing up for",
    gradient: "from-rose-500 to-pink-700",
    test: (p) =>
      has(p, "Date night") ||
      has(p, "Fine dining") ||
      ((p.rating ?? 0) >= 4.4 && (priceBand(p) === "premium" || priceBand(p) === "luxury") && p.type !== "cafe"),
    sort: "rating",
  },
  {
    id: "late-night",
    title: "Open late",
    emoji: "🌙",
    blurb: "Still serving past 12:30 am",
    gradient: "from-indigo-500 to-slate-800",
    test: closesLate,
    sort: "recommended",
  },
  {
    id: "live-music",
    title: "Live music",
    emoji: "🎸",
    blurb: "Gigs, bands and DJ nights",
    gradient: "from-violet-500 to-indigo-700",
    test: (p) => has(p, "Live music") || p.type === "nightclub",
    sort: "recommended",
  },
  {
    id: "work-cafes",
    title: "Cafés to work from",
    emoji: "💻",
    blurb: "Wi-Fi, coffee and somewhere to plug in",
    gradient: "from-emerald-500 to-teal-700",
    test: (p) => p.type === "cafe" && (has(p, "Wi-Fi") || has(p, "Work friendly")),
    sort: "recommended",
  },
  {
    id: "outdoor",
    title: "Alfresco",
    emoji: "🌿",
    blurb: "Outdoor seating for Bangalore weather",
    gradient: "from-lime-500 to-green-700",
    test: (p) => has(p, "Outdoor seating"),
    sort: "recommended",
  },
  {
    id: "budget",
    title: "Big taste, small bill",
    emoji: "🪙",
    blurb: "Great food under ₹800 for two",
    gradient: "from-yellow-500 to-amber-700",
    test: (p) => priceBand(p) === "budget" && (p.rating ?? 4.2) >= 4.2,
    sort: "rating",
  },
  {
    id: "pure-veg",
    title: "Pure veg",
    emoji: "🥗",
    blurb: "Vegetarian kitchens and veg-friendly menus",
    gradient: "from-green-500 to-emerald-700",
    test: (p) => has(p, "Pure veg") || has(p, "Veg friendly"),
    sort: "recommended",
  },
];

/** Temporarily closed places never appear in collections. */
export const COLLECTIONS: Collection[] = CURATED.map((c) => ({ ...c, test: (p: Place) => !p.status && isComplete(p) && c.test(p) }));

export function collectionById(id: string) {
  return COLLECTIONS.find((c) => c.id === id);
}
