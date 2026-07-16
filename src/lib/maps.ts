import type { Place } from "./types";

// Google's documented "Search Action" URL (https://developers.google.com/maps/documentation/urls/get-started#search-action).
// query_place_id resolves to the exact place; query is a text fallback.
export function googleMapsUrl(place: Pick<Place, "name" | "google_place_id">): string {
  const params = new URLSearchParams({ api: "1", query: place.name });
  if (place.google_place_id) params.set("query_place_id", place.google_place_id);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
