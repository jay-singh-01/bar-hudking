import { AREAS } from "../../src/lib/areas";
import { haversineKm } from "../../src/lib/geo";

/** Max distance from an area's center for a place to be tagged with it. */
const AREA_RADIUS_KM = 4;

export function nearestArea(lat: number, lng: number): string | null {
  let best: { name: string; d: number } | null = null;
  for (const a of AREAS) {
    const d = haversineKm({ lat, lng }, a);
    if (!best || d < best.d) best = { name: a.name, d };
  }
  return best && best.d <= AREA_RADIUS_KM ? best.name : null;
}

const STOP_WORDS = new Set([
  "the", "and", "restaurant", "restro", "bar", "pub", "cafe", "café", "kitchen",
  "bangalore", "bengaluru", "blr", "by", "of", "a", "lounge", "brewery", "brewing",
  "company", "co", "pvt", "ltd", "family", "veg", "hotel", "&",
]);

export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** 0..1 similarity between two venue names (token overlap, forgiving of suffixes like "Bar & Kitchen"). */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (!ta.size || !tb.size) {
    return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  }
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

export function titleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const CUISINE_ALIASES: Record<string, string> = {
  regional: "",
  indian: "Indian",
  north_indian: "North Indian",
  south_indian: "South Indian",
  coffee_shop: "Coffee",
  ice_cream: "Desserts",
  dessert: "Desserts",
  fast_food: "Fast Food",
  barbecue: "BBQ",
  bbq: "BBQ",
  burger: "Burgers",
  pizza: "Pizza",
  sandwich: "Sandwiches",
  andhra: "Andhra",
  chettinad: "Chettinad",
  kerala: "Kerala",
  mangalorean: "Mangalorean",
  udupi: "Udupi",
  vegetarian: "",
  vegan: "",
};

export function normalizeCuisine(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const out = new Set<string>();
  for (const part of raw.split(/[;,]/)) {
    const key = part.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key) continue;
    const mapped = key in CUISINE_ALIASES ? CUISINE_ALIASES[key] : titleCase(key);
    if (mapped) out.add(mapped);
  }
  return out.size ? [...out] : undefined;
}
