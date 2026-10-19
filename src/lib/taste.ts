import type { Place } from "./types";
import type { UserData } from "./store";
import { live } from "./store";
import { isComplete, priceBand, qualityScore, type PriceBand } from "./discover";

// "Similar to what you like": a simple taste profile built from favourites
// and well-rated visits, used to rank places the person hasn't tried yet.

export interface TasteProfile {
  types: Map<string, number>;
  cuisines: Map<string, number>;
  areas: Map<string, number>;
  bands: Map<PriceBand, number>;
  features: Map<string, number>;
  /** Places the profile was built from, strongest first (for "because you liked …"). */
  seeds: Place[];
  /** Ids to leave out of suggestions (already saved or visited). */
  known: Set<string>;
}

function bump<K>(m: Map<K, number>, k: K | null | undefined, w: number) {
  if (k === null || k === undefined) return;
  m.set(k, (m.get(k) ?? 0) + w);
}

export function buildTaste(d: UserData, byId: Map<string, Place>): TasteProfile | null {
  const weights = new Map<string, number>();
  for (const f of live(d.favorites)) weights.set(f.placeId, (weights.get(f.placeId) ?? 0) + 1);
  for (const v of live(d.visits)) {
    const w = v.rating === null ? 0.5 : v.rating >= 4 ? 1.5 : v.rating <= 2 ? -1 : 0.25;
    weights.set(v.placeId, (weights.get(v.placeId) ?? 0) + w);
  }

  const profile: TasteProfile = {
    types: new Map(),
    cuisines: new Map(),
    areas: new Map(),
    bands: new Map(),
    features: new Map(),
    seeds: [],
    known: new Set(weights.keys()),
  };

  const positives: [Place, number][] = [];
  for (const [id, w] of weights) {
    const p = byId.get(id);
    if (!p) continue;
    bump(profile.types, p.type, w);
    for (const c of p.cuisine ?? []) bump(profile.cuisines, c, w);
    bump(profile.areas, p.area, w);
    bump(profile.bands, priceBand(p), w);
    for (const f of p.features ?? []) bump(profile.features, f, w * 0.5);
    if (w > 0) positives.push([p, w]);
  }
  if (positives.length < 2) return null;
  profile.seeds = positives.sort((a, b) => b[1] - a[1]).map(([p]) => p);
  return profile;
}

function share(m: Map<unknown, number>, key: unknown): number {
  let total = 0;
  for (const v of m.values()) if (v > 0) total += v;
  return total ? Math.max(0, m.get(key) ?? 0) / total : 0;
}

export function tasteScore(p: Place, t: TasteProfile): number {
  let s = share(t.types, p.type) * 1.2;
  s += Math.max(0, ...(p.cuisine ?? []).map((c) => share(t.cuisines, c))) * 0.9;
  s += share(t.areas, p.area) * 0.6;
  s += share(t.bands, priceBand(p)) * 0.6;
  s += Math.min(1, (p.features ?? []).reduce((acc, f) => acc + share(t.features, f), 0)) * 0.3;
  return s;
}

/** The seed place this suggestion most resembles, for the "Like X" caption. */
export function closestSeed(p: Place, t: TasteProfile): Place | null {
  let best: { seed: Place; score: number } | null = null;
  for (const seed of t.seeds.slice(0, 12)) {
    let score = 0;
    if (seed.type === p.type) score += 2;
    if (seed.cuisine?.some((c) => p.cuisine?.includes(c))) score += 1.5;
    if (seed.area && seed.area === p.area) score += 1;
    if (seed.id !== p.id && (!best || score > best.score)) best = { seed, score };
  }
  return best && best.score >= 2 ? best.seed : null;
}

export function suggestForYou(places: Place[], t: TasteProfile, isAllowed: (p: Place) => boolean, limit = 12): Place[] {
  return places
    .filter((p) => isComplete(p) && !p.status && !t.known.has(p.id) && isAllowed(p))
    .map((p) => ({ p, s: tasteScore(p, t) * 1.5 + (qualityScore(p) - 4) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.p);
}
