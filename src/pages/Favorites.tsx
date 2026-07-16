import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useUserPlaces } from "../lib/UserPlacesProvider";
import type { Place } from "../lib/types";
import PlaceCard from "../components/PlaceCard";
import EmptyState from "../components/EmptyState";

export default function Favorites() {
  const { favoriteIds, loading: contextLoading } = useUserPlaces();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const idsKey = [...favoriteIds].sort().join(",");

  useEffect(() => {
    if (contextLoading) return;
    if (favoriteIds.size === 0) {
      setPlaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("places")
      .select("*")
      .in("id", [...favoriteIds])
      .then(({ data }) => {
        setPlaces(data ?? []);
        setLoading(false);
      });
    // favoriteIds is intentionally represented by idsKey so this only
    // re-fetches when membership actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextLoading, idsKey]);

  const visiblePlaces = places.filter((p) => favoriteIds.has(p.id));
  const isLoading = loading || contextLoading;

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Favorites</h1>

      {isLoading && <p className="py-8 text-center text-slate-400">Loading...</p>}

      {!isLoading && visiblePlaces.length === 0 && (
        <EmptyState
          title="No favorites yet"
          message="Tap the heart on a place in Explore to save it here."
        />
      )}

      {!isLoading && visiblePlaces.length > 0 && (
        <div className="flex flex-col gap-3">
          {visiblePlaces.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </div>
  );
}
