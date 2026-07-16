export interface Place {
  id: string;
  google_place_id: string | null;
  name: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  place_type: string | null;
  cuisine: string[] | null;
  vibe: string[] | null;
  rating: number | null;
  review_count: number | null;
  price_min: number | null;
  price_max: number | null;
  address: string | null;
  image_url: string | null;
  source: string | null;
}

export interface PlaceFilters {
  areas: string[];
  placeTypes: string[];
  cuisines: string[];
  vibes: string[];
  maxDistanceKm: number | null;
  superSuggest: boolean;
}

export const EMPTY_FILTERS: PlaceFilters = {
  areas: [],
  placeTypes: [],
  cuisines: [],
  vibes: [],
  maxDistanceKm: null,
  superSuggest: false,
};
