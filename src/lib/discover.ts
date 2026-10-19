import type { Place, PlaceType } from "./types";
import type { Coords } from "./geo";
import { haversineKm } from "./geo";
import { minutesUntilClose, openStatus } from "./hours";
import type { Spot, SuperSuggestAnchor } from "./store";
import { inSuperSuggest } from "./superSuggest";

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export type PriceBand = "budget" | "mid" | "premium" | "luxury";

const BAND_MAX: Record<PriceBand, number> = { budget: 800, mid: 1600, premium: 3000, luxury: Infinity };

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

/** Middle of the cost-for-two range — what the budget filter compares against. */
export function typicalPriceForTwo(p: Place): number | null {
  const r = approxPriceForTwo(p);
  return r ? (r[0] + r[1]) / 2 : null;
}

export function priceBand(p: Place): PriceBand | null {
  const mid = typicalPriceForTwo(p);
  if (mid === null) return null;
  return (Object.keys(BAND_MAX) as PriceBand[]).find((b) => mid < BAND_MAX[b])!;
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

/** Muted, warm palette for map dots and type accents. */
export const TYPE_META: Record<PlaceType, { label: string; plural: string; color: string }> = {
  restaurant: { label: "Restaurant", plural: "Restaurants", color: "#d79b4f" },
  bar: { label: "Bar", plural: "Bars", color: "#9a8fd0" },
  pub: { label: "Pub", plural: "Pubs", color: "#c9b35c" },
  brewery: { label: "Brewery", plural: "Breweries", color: "#c9773f" },
  cafe: { label: "Café", plural: "Cafés", color: "#7fae8c" },
  nightclub: { label: "Club", plural: "Clubs", color: "#c7708e" },
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

/** Open now and still open for at least `minutes` more. */
export function openForAtLeast(p: Place, now: Date, minutes: number): boolean {
  if (p.status) return false;
  const left = minutesUntilClose(p.hours, now);
  return left !== null && left >= minutes;
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
  /** Max typical cost for two, ₹. */
  maxBudget: number | null;
  minRating: number | null;
  openNow: boolean;
  /** Open now and for at least the next two hours. */
  tonight: boolean;
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
  maxBudget: null,
  minRating: null,
  openNow: false,
  tonight: false,
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
    (f.maxBudget !== null ? 1 : 0) +
    (f.minRating !== null ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.tonight ? 1 : 0) +
    (f.maxDistanceKm !== null ? 1 : 0) +
    (f.nearMySpots ? 1 : 0) +
    (f.hideVisited ? 1 : 0) +
    (f.superSuggest ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Search — every query word must match somewhere (name, area, cuisine,
// features, Google's description). Tolerates typos ("koramangla", "toitt")
// and understands everyday words ("beer", "coffee", "veg").
// ---------------------------------------------------------------------------

export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9₹ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SYNONYMS: Record<string, string[]> = {
  beer: ["brewery", "brewpub", "pub", "craft", "beer"],
  beers: ["brewery", "brewpub", "pub", "craft", "beer"],
  drinks: ["bar", "pub", "cocktails", "lounge", "brewery"],
  drink: ["bar", "pub", "cocktails", "lounge", "brewery"],
  booze: ["bar", "pub", "cocktails", "lounge", "brewery"],
  cocktail: ["cocktails", "bar", "lounge"],
  coffee: ["cafe", "coffee"],
  chai: ["cafe", "tea"],
  veg: ["veg", "vegetarian"],
  vegetarian: ["veg", "vegetarian"],
  club: ["club", "nightclub"],
  clubbing: ["club", "nightclub"],
  dance: ["club", "nightclub"],
  dinner: ["restaurant", "dining"],
  lunch: ["restaurant"],
  terrace: ["rooftop", "terrace"],
  music: ["music", "live"],
  gig: ["music", "live"],
  romantic: ["date", "romantic", "fine"],
  date: ["date", "romantic"],
  sports: ["sports"],
  match: ["sports"],
  ipl: ["sports"],
  wifi: ["wi", "fi", "work"],
  work: ["work", "wi"],
  dosa: ["south", "dosa", "udupi"],
  idli: ["south", "idli", "udupi"],
  biriyani: ["biryani"],
};

interface Indexed {
  text: string;
  tokens: Set<string>;
  name: string;
}

const searchCache = new WeakMap<Place, Indexed>();

function indexed(p: Place): Indexed {
  let x = searchCache.get(p);
  if (!x) {
    const text = normalizeText(
      [p.name, p.area, p.address, TYPE_META[p.type].label, TYPE_META[p.type].plural, p.description, ...(p.cuisine ?? []), ...(p.features ?? [])]
        .filter(Boolean)
        .join(" "),
    );
    x = { text, tokens: new Set(text.split(" ")), name: normalizeText(p.name) };
    searchCache.set(p, x);
  }
  return x;
}

/** Every distinct word across the catalogue, for typo correction. */
let vocabulary: string[] = [];

export function setSearchCorpus(places: Place[]) {
  const words = new Set<string>();
  for (const p of places) for (const t of indexed(p).tokens) if (t.length >= 3) words.add(t);
  vocabulary = [...words];
}

/** Levenshtein distance, giving up early once it exceeds `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

interface QueryWord {
  word: string;
  /** Exact forms to look for (the word plus synonyms). */
  exact: string[];
  /** Catalogue words within a typo or two, used only if nothing exact matches. */
  fuzzy: Set<string>;
}

let compiledFor = "";
let compiled: QueryWord[] = [];

function compile(query: string): QueryWord[] {
  if (query === compiledFor) return compiled;
  const words = normalizeText(query).split(" ").filter(Boolean);
  compiled = words.map((word) => {
    const exact = [word, ...(SYNONYMS[word] ?? [])];
    const fuzzy = new Set<string>();
    if (word.length >= 4) {
      const max = word.length >= 7 ? 2 : 1;
      for (const v of vocabulary) {
        if (v[0] !== word[0] && word.length < 7) continue;
        if (editDistance(word, v, max) <= max) fuzzy.add(v);
      }
    }
    return { word, exact, fuzzy };
  });
  compiledFor = query;
  return compiled;
}

/** 0 = no match. Higher = better; name matches rank above description matches. */
export function searchScore(p: Place, query: string): number {
  const words = compile(query);
  if (!words.length) return 1;
  const x = indexed(p);
  let score = 0;
  for (const { word, exact, fuzzy } of words) {
    if (exact.some((e) => x.text.includes(e))) {
      if (x.name.startsWith(word)) score += 3;
      else if (x.name.includes(` ${word}`)) score += 2;
      else if (x.name.includes(word)) score += 1.5;
      else score += 1;
      continue;
    }
    let hit = false;
    for (const t of x.tokens) {
      if (fuzzy.has(t)) {
        hit = true;
        break;
      }
    }
    if (!hit) return 0;
    score += 0.6;
  }
  return score;
}

export interface FilterContext {
  coords: Coords | null;
  spots: Spot[];
  anchors: SuperSuggestAnchor[];
  visitedIds: Set<string>;
  hiddenIds: Set<string>;
  now: Date;
}

export const TONIGHT_MIN_MINUTES = 120;

export function matchesFilters(p: Place, f: Filters, ctx: FilterContext): boolean {
  if (ctx.hiddenIds.has(p.id)) return false;
  if (f.types.length && !f.types.includes(p.type)) return false;
  if (f.areas.length && (!p.area || !f.areas.includes(p.area))) return false;
  if (f.cuisines.length && !p.cuisine?.some((c) => f.cuisines.includes(c))) return false;
  if (f.features.length && !f.features.every((x) => p.features?.includes(x))) return false;
  if (f.maxBudget !== null) {
    const typical = typicalPriceForTwo(p);
    if (typical === null || typical > f.maxBudget) return false;
  }
  if (f.minRating !== null && (p.rating ?? 0) < f.minRating) return false;
  if (f.openNow && (p.status || !openStatus(p.hours, ctx.now)?.open)) return false;
  if (f.tonight && !openForAtLeast(p, ctx.now, TONIGHT_MIN_MINUTES)) return false;
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
// Curated collections. Each one is shown with a photo from its best place.
// ---------------------------------------------------------------------------

export interface Collection {
  id: string;
  title: string;
  blurb: string;
  test: (p: Place) => boolean;
  sort: SortKey;
}

const closesLate = (p: Place) => p.hours?.some((day) => day.some(([, close]) => close >= 24 * 60 + 30)) ?? false;
const has = (p: Place, feature: string) => p.features?.includes(feature) ?? false;

const CURATED: Collection[] = [
  {
    id: "top-rated",
    title: "Bangalore's best",
    blurb: "4.5★ and up, with thousands of reviews behind it",
    test: (p) => (p.rating ?? 0) >= 4.5 && (p.ratingCount ?? 0) >= 1000,
    sort: "rating",
  },
  {
    id: "hidden-gems",
    title: "Hidden gems",
    blurb: "Loved by the few who know about them",
    test: isHiddenGem,
    sort: "rating",
  },
  {
    id: "breweries",
    title: "Brewery hopping",
    blurb: "Fresh craft beer in the microbrewery capital",
    test: (p) => p.type === "brewery" || has(p, "Craft beer"),
    sort: "recommended",
  },
  {
    id: "rooftops",
    title: "Rooftops",
    blurb: "Drinks with a view",
    test: (p) => has(p, "Rooftop"),
    sort: "recommended",
  },
  {
    id: "date-night",
    title: "Date night",
    blurb: "A little fancy, worth dressing up for",
    test: (p) =>
      has(p, "Date night") ||
      has(p, "Fine dining") ||
      ((p.rating ?? 0) >= 4.4 && (priceBand(p) === "premium" || priceBand(p) === "luxury") && p.type !== "cafe"),
    sort: "rating",
  },
  {
    id: "late-night",
    title: "Open late",
    blurb: "Still serving past 12:30 am",
    test: closesLate,
    sort: "recommended",
  },
  {
    id: "live-music",
    title: "Live music",
    blurb: "Gigs, bands and DJ nights",
    test: (p) => has(p, "Live music") || p.type === "nightclub",
    sort: "recommended",
  },
  {
    id: "work-cafes",
    title: "Cafés to work from",
    blurb: "Wi-Fi, coffee and somewhere to plug in",
    test: (p) => p.type === "cafe" && (has(p, "Wi-Fi") || has(p, "Work friendly")),
    sort: "recommended",
  },
  {
    id: "outdoor",
    title: "Alfresco",
    blurb: "Outdoor seating for Bangalore weather",
    test: (p) => has(p, "Outdoor seating"),
    sort: "recommended",
  },
  {
    id: "budget",
    title: "Under ₹800 for two",
    blurb: "Big taste, small bill",
    test: (p) => priceBand(p) === "budget" && (p.rating ?? 4.2) >= 4.2,
    sort: "rating",
  },
  {
    id: "pure-veg",
    title: "Vegetarian",
    blurb: "Pure veg kitchens and veg-friendly menus",
    test: (p) => has(p, "Pure veg") || has(p, "Veg friendly"),
    sort: "recommended",
  },
];

/** Temporarily closed or incomplete places never appear in collections. */
export const COLLECTIONS: Collection[] = CURATED.map((c) => ({ ...c, test: (p: Place) => !p.status && isComplete(p) && c.test(p) }));

export function collectionById(id: string) {
  return COLLECTIONS.find((c) => c.id === id);
}
