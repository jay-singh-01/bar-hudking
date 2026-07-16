import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Place, PlaceFilters } from "../lib/types";
import { EMPTY_FILTERS } from "../lib/types";
import { REFERENCE_POINTS, SUPER_SUGGEST_RADII_KM } from "../lib/constants";
import { haversineKm } from "../lib/geo";
import { useGeolocation } from "../lib/useGeolocation";
import FilterBar from "../components/FilterBar";
import SuperSuggestButton from "../components/SuperSuggestButton";
import PlaceCard from "../components/PlaceCard";
import EmptyState from "../components/EmptyState";

export default function Explore() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlaceFilters>(EMPTY_FILTERS);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [cuisineOptions, setCuisineOptions] = useState<string[]>([]);
  const [vibeOptions, setVibeOptions] = useState<string[]>([]);
  const geo = useGeolocation();

  // Derive available area/cuisine/vibe filter options from the full
  // dataset once, independent of the current filter selection.
  useEffect(() => {
    supabase
      .from("places")
      .select("area, cuisine, vibe")
      .then(({ data }) => {
        if (!data) return;
        const areas = new Set<string>();
        const cuisines = new Set<string>();
        const vibes = new Set<string>();
        for (const row of data) {
          if (row.area) areas.add(row.area);
          (row.cuisine ?? []).forEach((c: string) => cuisines.add(c));
          (row.vibe ?? []).forEach((v: string) => vibes.add(v));
        }
        setAreaOptions([...areas].sort());
        setCuisineOptions([...cuisines].sort());
        setVibeOptions([...vibes].sort());
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    let query = supabase
      .from("places")
      .select("*")
      .order("rating", { ascending: false, nullsFirst: false });

    if (filters.areas.length) query = query.in("area", filters.areas);
    if (filters.placeTypes.length) query = query.in("place_type", filters.placeTypes);
    if (filters.cuisines.length) query = query.overlaps("cuisine", filters.cuisines);
    if (filters.vibes.length) query = query.overlaps("vibe", filters.vibes);

    query.then(({ data, error: queryError }) => {
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
      } else {
        setPlaces(data ?? []);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [filters.areas, filters.placeTypes, filters.cuisines, filters.vibes]);

  const needsLocation = filters.maxDistanceKm !== null || filters.superSuggest;
  const locationPending = needsLocation && !geo.coords;

  const visiblePlaces = useMemo(() => {
    if (!geo.coords) return places;
    const userCoords = geo.coords;

    return places.filter((place) => {
      if (place.lat === null || place.lng === null) return false;
      const placeCoords = { lat: place.lat, lng: place.lng };

      if (
        filters.maxDistanceKm !== null &&
        haversineKm(userCoords, placeCoords) > filters.maxDistanceKm
      ) {
        return false;
      }

      if (
        filters.superSuggest &&
        (haversineKm(userCoords, placeCoords) > SUPER_SUGGEST_RADII_KM.fromUser ||
          haversineKm(REFERENCE_POINTS.rajarajeshwariNagar, placeCoords) >
            SUPER_SUGGEST_RADII_KM.fromRajarajeshwariNagar ||
          haversineKm(REFERENCE_POINTS.hsrLayout, placeCoords) >
            SUPER_SUGGEST_RADII_KM.fromHsrLayout)
      ) {
        return false;
      }

      return true;
    });
  }, [places, filters.maxDistanceKm, filters.superSuggest, geo.coords]);

  const hasActiveFilters =
    filters.areas.length > 0 ||
    filters.placeTypes.length > 0 ||
    filters.cuisines.length > 0 ||
    filters.vibes.length > 0 ||
    filters.maxDistanceKm !== null ||
    filters.superSuggest;

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <h1 className="px-4 pt-4 text-2xl font-bold">Explore</h1>
        <FilterBar
          filters={filters}
          onChange={setFilters}
          areaOptions={areaOptions}
          cuisineOptions={cuisineOptions}
          vibeOptions={vibeOptions}
          geo={geo}
        />
        <SuperSuggestButton
          active={filters.superSuggest}
          onToggle={(next) => setFilters({ ...filters, superSuggest: next })}
          geo={geo}
        />
      </div>

      <div className="p-4">
        {loading && <p className="py-8 text-center text-slate-400">Loading places...</p>}

        {!loading && error && (
          <p className="py-8 text-center text-red-400">Couldn't load places: {error}</p>
        )}

        {!loading && !error && locationPending && geo.status === "loading" && (
          <p className="py-8 text-center text-slate-400">Getting your location...</p>
        )}

        {!loading && !error && locationPending && geo.status === "denied" && (
          <EmptyState
            title="Location access needed"
            message={geo.error ?? "Enable location access in your browser to use distance filters."}
            action={{ label: "Try again", onClick: geo.request }}
          />
        )}

        {!loading && !error && locationPending && geo.status === "unsupported" && (
          <EmptyState
            title="Location not supported"
            message="Your browser doesn't support location services, so distance filters can't be used."
          />
        )}

        {!loading && !error && !locationPending && visiblePlaces.length === 0 && (
          <EmptyState
            title="No places match"
            message={
              hasActiveFilters
                ? "Try clearing a filter or two — nothing in the current selection."
                : "No places have been seeded yet."
            }
            action={
              hasActiveFilters
                ? { label: "Clear filters", onClick: () => setFilters(EMPTY_FILTERS) }
                : undefined
            }
          />
        )}

        {!loading && !error && !locationPending && visiblePlaces.length > 0 && (
          <div className="flex flex-col gap-3">
            {visiblePlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                distanceKm={
                  geo.coords && place.lat !== null && place.lng !== null
                    ? haversineKm(geo.coords, { lat: place.lat, lng: place.lng })
                    : null
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
