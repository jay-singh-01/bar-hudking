// Shared between the app and the data pipeline (scripts/data/*).

export const PLACE_TYPES = [
  "restaurant",
  "bar",
  "pub",
  "brewery",
  "cafe",
  "nightclub",
] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

/** Minutes since midnight. `close` may exceed 1440 for past-midnight closes. */
export type TimeRange = [open: number, close: number];
/** Index 0 = Monday ... 6 = Sunday. Empty array = closed that day. */
export type WeeklyHours = TimeRange[][];

export interface PlaceReview {
  text: string;
  author?: string;
  rating?: number;
}

export interface Place {
  /** Stable id: "osm:n123" / "osm:w123" for OSM-sourced, "g:<google id>" otherwise. */
  id: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  area: string | null;
  address?: string;
  cuisine?: string[];
  /** Human-readable features, e.g. "Outdoor seating", "Live music". */
  features?: string[];
  hours?: WeeklyHours;
  phone?: string;
  website?: string;
  /** Google rating (1-5) and number of ratings, when enriched. */
  rating?: number;
  ratingCount?: number;
  /** Approximate cost for two in INR, [min, max]. */
  priceForTwo?: [number, number];
  /** 1-4, Google-style price level when no INR range is known. */
  priceLevel?: number;
  photo?: string;
  googleId?: string;
  /** Table booking / reservation page, when Google lists one. */
  bookingUrl?: string;
  description?: string;
  review?: PlaceReview;
  /** Set when Google marks the listing "Temporarily closed". */
  status?: "temporarily_closed";
}

export interface PlacesFile {
  generatedAt: string;
  attribution: string[];
  places: Place[];
}
