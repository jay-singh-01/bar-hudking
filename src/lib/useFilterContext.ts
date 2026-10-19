import { useEffect, useMemo, useState } from "react";
import type { FilterContext } from "./discover";
import { useLocation } from "./location";
import { live, useUserData } from "./store";
import { useAnchors } from "./superSuggest";

/** Re-renders every minute so "open now" stays honest while the app is left open. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useFilterContext(): FilterContext {
  const { coords } = useLocation();
  const spotsRec = useUserData((d) => d.spots);
  const visitsRec = useUserData((d) => d.visits);
  const hiddenRec = useUserData((d) => d.hidden);
  const now = useNow();
  const anchors = useAnchors();
  const spots = useMemo(() => live(spotsRec), [spotsRec]);
  const visitedIds = useMemo(() => new Set(live(visitsRec).map((v) => v.placeId)), [visitsRec]);
  const hiddenIds = useMemo(() => new Set(live(hiddenRec).map((h) => h.placeId)), [hiddenRec]);
  return useMemo(
    () => ({ coords, spots, anchors, visitedIds, hiddenIds, now }),
    [coords, spots, anchors, visitedIds, hiddenIds, now],
  );
}
