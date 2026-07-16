import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const PAGE_SIZE = 30;

export default function Explore() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlaceFilters>(EMPTY_FILTERS);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [cuisineOptions, setCuisineOptions] = useState<string[]>([]);
  const [vibeOptions, setVibeOptions] = useState<string[]>([]);
  const geo = useGeolocation();
  const loadMoreRef = useRef<() => void>(() => {});
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null);

  // Derive available area/cuisine/vibe filter options from the full
  // dataset once, independent of the current filter selection. Loops
  // through in batches since Supabase caps a single response at 1000 rows.
  useEffect(() => {
    let cancelled = false;

    async function fetchAllForOptions() {
      const areas = new Set<string>();
      const cuisines = new Set<string>();
      const vibes = new Set<string>();
      const BATCH = 1000;
      let from = 0;

      while (!cancelled) {
        const { data, error: queryError } = await supabase
          .from("places")
          .select("area, cuisine, vibe")
          .range(from, from + BATCH - 1);
        if (queryError || !data) break;

        for (const row of data) {
          if (row.area) areas.add(row.area);
          (row.cuisine ?? []).forEach((c: string) => cuisines.add(c));
          (row.vibe ?? []).forEach((v: string) => vibes.add(v));
        }
        if (data.length < BATCH) break;
        from += BATCH;
      }

      if (!cancelled) {
        setAreaOptions([...areas].sort());
        setCuisineOptions([...cuisines].sort());
        setVibeOptions([...vibes].sort());
      }
    }

    fetchAllForOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const buildPageQuery = useCallback(
    (pageIndex: number) => {
      let query = supabase
        .from("places")
        .select("*")
        .order("rating", { ascending: false, nullsFirst: false })
        .order("id")
        .range(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE - 1);

      if (filters.areas.length) query = query.in("area", filters.areas);
      if (filters.placeTypes.length) query = query.in("place_type", filters.placeTypes);
      if (filters.cuisines.length) query = query.overlaps("cuisine", filters.cuisines);
      if (filters.vibes.length) query = query.overlaps("vibe", filters.vibes);

      return query;
    },
    [filters.areas, filters.placeTypes, filters.cuisines, filters.vibes],
  );

  // Reset to page 0 whenever the server-side filters change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    buildPageQuery(0).then(({ data, error: queryError }) => {
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
      } else {
        setPlaces(data ?? []);
        setPage(0);
        setHasMore((data?.length ?? 0) === PAGE_SIZE);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [buildPageQuery]);

  // Keep the load-more callback pointed at fresh state/closures without
  // re-subscribing the IntersectionObserver on every render.
  useEffect(() => {
    loadMoreRef.current = async () => {
      if (loadingMore || !hasMore || loading) return;
      setLoadingMore(true);
      const nextPage = page + 1;
      const { data, error: queryError } = await buildPageQuery(nextPage);
      if (queryError) {
        setError(queryError.message);
        setLoadingMore(false);
        return;
      }
      setPlaces((prev) => [...prev, ...(data ?? [])]);
      setPage(nextPage);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
      setLoadingMore(false);
    };
  });

  // Callback ref (not a plain ref + mount-once effect) so the observer
  // re-attaches correctly when the sentinel div appears — it only renders
  // once loading finishes and hasMore is true, i.e. after the first
  // render, which a `useEffect(..., [])` would miss entirely.
  const sentinelCallbackRef = useCallback((node: HTMLDivElement | null) => {
    sentinelObserverRef.current?.disconnect();
    sentinelObserverRef.current = null;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    sentinelObserverRef.current = observer;
  }, []);

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
            {hasMore && (
              <div ref={sentinelCallbackRef} className="py-4 text-center text-sm text-slate-500">
                {loadingMore ? "Loading more..." : ""}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
