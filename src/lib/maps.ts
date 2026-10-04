import type { Place } from "./types";

// Google's documented Maps URLs (https://developers.google.com/maps/documentation/urls/get-started).
// query_place_id resolves to the exact listing when we have it; otherwise the
// name + coordinates still land on the right venue.

export function googleMapsUrl(place: Place): string {
  const params = new URLSearchParams({ api: "1", query: place.googleId ? place.name : `${place.name} ${place.lat},${place.lng}` });
  if (place.googleId) params.set("query_place_id", place.googleId);
  return `https://www.google.com/maps/search/?${params}`;
}

export function directionsUrl(place: Place): string {
  const params = new URLSearchParams({ api: "1", destination: `${place.lat},${place.lng}` });
  if (place.googleId) params.set("destination_place_id", place.googleId);
  return `https://www.google.com/maps/dir/?${params}`;
}

export function uberUrl(place: Place): string {
  const params = new URLSearchParams({
    action: "setPickup",
    pickup: "my_location",
    "dropoff[latitude]": String(place.lat),
    "dropoff[longitude]": String(place.lng),
    "dropoff[nickname]": place.name,
  });
  return `https://m.uber.com/ul/?${params}`;
}

/** Google's public reviews page for a place — free, no API key. */
export function googleReviewsUrl(place: Place): string {
  return place.googleId
    ? `https://search.google.com/local/reviews?placeid=${encodeURIComponent(place.googleId)}`
    : googleMapsUrl(place);
}
