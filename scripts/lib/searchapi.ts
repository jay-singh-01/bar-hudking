// Shared between fetch-searchapi.ts (writes the cache) and build-places.ts
// (reads it). Kept separate so importing it never triggers API calls.

export type Engine = "google_maps" | "google_local";

export const CACHE_DIRS: Record<Engine, string> = {
  google_maps: "data/raw/searchapi",
  google_local: "data/raw/searchapi-local",
};

/** Thumbnails google_local returns inline (base64); named <place_id>.jpg. */
export const LOCAL_IMAGES_DIR = "data/raw/searchapi-local-images";

export interface CachedQuery {
  q: string;
  ll?: string;
  page?: number;
  engine?: Engine;
  fetchedAt: string;
  results: Record<string, unknown>[];
}
