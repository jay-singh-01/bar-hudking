import { useSyncExternalStore } from "react";

// Per-device conveniences (not synced): recently opened places and recent
// searches. Stored in localStorage, fail-soft when storage is unavailable.

const PLACES_KEY = "barhudking:recentPlaces";
const SEARCHES_KEY = "barhudking:recentSearches";
const MAX_PLACES = 15;
const MAX_SEARCHES = 6;

function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

let places = read(PLACES_KEY);
let searches = read(SEARCHES_KEY);
const listeners = new Set<() => void>();

function write(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function rememberPlace(id: string) {
  if (places[0] === id) return;
  places = [id, ...places.filter((p) => p !== id)].slice(0, MAX_PLACES);
  write(PLACES_KEY, places);
}

export function rememberSearch(query: string) {
  const q = query.trim();
  if (q.length < 3) return;
  const lower = q.toLowerCase();
  searches = [q, ...searches.filter((s) => s.toLowerCase() !== lower)].slice(0, MAX_SEARCHES);
  write(SEARCHES_KEY, searches);
}

export function clearRecentSearches() {
  searches = [];
  write(SEARCHES_KEY, searches);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useRecentPlaces(): string[] {
  return useSyncExternalStore(subscribe, () => places);
}

export function useRecentSearches(): string[] {
  return useSyncExternalStore(subscribe, () => searches);
}

/** Quick ideas shown under an empty search box. */
export const SEARCH_IDEAS = ["Rooftop", "Biryani", "Breweries", "Live music", "Cocktails", "South Indian breakfast", "Pure veg", "Sushi", "Brunch", "Sports bar"];
