import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthProvider";

interface VisitedEntry {
  rating: number | null;
  costForTwo: number | null;
}

interface UserPlacesContextValue {
  loading: boolean;
  favoriteIds: Set<string>;
  visited: Map<string, VisitedEntry>;
  toggleFavorite: (placeId: string) => void;
  markVisited: (placeId: string) => Promise<void>;
  unmarkVisited: (placeId: string) => void;
  saveVisitDetails: (placeId: string, details: VisitedEntry) => void;
}

const UserPlacesContext = createContext<UserPlacesContextValue | null>(null);

export function UserPlacesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loading, setLoading] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Map<string, VisitedEntry>>(new Map());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.from("user_favorites").select("place_id"),
      supabase.from("user_visited").select("place_id, user_rating, cost_for_two"),
    ]).then(([favRes, visRes]) => {
      if (cancelled) return;
      setFavoriteIds(new Set((favRes.data ?? []).map((r) => r.place_id)));
      setVisited(
        new Map(
          (visRes.data ?? []).map((r) => [
            r.place_id,
            { rating: r.user_rating, costForTwo: r.cost_for_two },
          ]),
        ),
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  function toggleFavorite(placeId: string) {
    if (!userId) return;
    const wasFavorite = favoriteIds.has(placeId);

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(placeId);
      else next.add(placeId);
      return next;
    });

    const revert = () =>
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(placeId);
        else next.delete(placeId);
        return next;
      });

    const request = wasFavorite
      ? supabase.from("user_favorites").delete().eq("user_id", userId).eq("place_id", placeId)
      : supabase.from("user_favorites").insert({ user_id: userId, place_id: placeId });

    request.then(({ error }) => {
      if (error) revert();
    });
  }

  async function markVisited(placeId: string) {
    if (!userId) return;
    setVisited((prev) => new Map(prev).set(placeId, { rating: null, costForTwo: null }));

    const { error } = await supabase
      .from("user_visited")
      .insert({ user_id: userId, place_id: placeId });

    if (error) {
      setVisited((prev) => {
        const next = new Map(prev);
        next.delete(placeId);
        return next;
      });
    }
  }

  function unmarkVisited(placeId: string) {
    if (!userId) return;
    const prevEntry = visited.get(placeId);

    setVisited((prev) => {
      const next = new Map(prev);
      next.delete(placeId);
      return next;
    });

    supabase
      .from("user_visited")
      .delete()
      .eq("user_id", userId)
      .eq("place_id", placeId)
      .then(({ error }) => {
        if (error && prevEntry) {
          setVisited((prev) => new Map(prev).set(placeId, prevEntry));
        }
      });
  }

  function saveVisitDetails(placeId: string, details: VisitedEntry) {
    if (!userId) return;
    setVisited((prev) => new Map(prev).set(placeId, details));

    supabase
      .from("user_visited")
      .update({ user_rating: details.rating, cost_for_two: details.costForTwo })
      .eq("user_id", userId)
      .eq("place_id", placeId)
      .then(() => {});
  }

  return (
    <UserPlacesContext.Provider
      value={{
        loading,
        favoriteIds,
        visited,
        toggleFavorite,
        markVisited,
        unmarkVisited,
        saveVisitDetails,
      }}
    >
      {children}
    </UserPlacesContext.Provider>
  );
}

export function useUserPlaces() {
  const ctx = useContext(UserPlacesContext);
  if (!ctx) throw new Error("useUserPlaces must be used within UserPlacesProvider");
  return ctx;
}
