import { useEffect, useState } from "react";
import type { Place, PlacesFile } from "./types";

export interface PlacesIndex {
  places: Place[];
  byId: Map<string, Place>;
  areas: { name: string; count: number }[];
  cuisines: { name: string; count: number }[];
  features: { name: string; count: number }[];
  generatedAt: string;
  attribution: string[];
}

function countBy(values: Iterable<string>) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function buildIndex(file: PlacesFile): PlacesIndex {
  const places = file.places;
  return {
    places,
    byId: new Map(places.map((p) => [p.id, p])),
    areas: countBy(places.flatMap((p) => (p.area ? [p.area] : []))),
    cuisines: countBy(places.flatMap((p) => p.cuisine ?? [])).filter((c) => c.count >= 3),
    features: countBy(places.flatMap((p) => p.features ?? [])).filter((c) => c.count >= 3),
    generatedAt: file.generatedAt,
    attribution: file.attribution,
  };
}

let cached: PlacesIndex | null = null;
let inflight: Promise<PlacesIndex> | null = null;

export function loadPlaces(): Promise<PlacesIndex> {
  if (cached) return Promise.resolve(cached);
  inflight ??= fetch("/data/places.json")
    .then((res) => {
      if (!res.ok) throw new Error(`Couldn't load places (HTTP ${res.status})`);
      return res.json() as Promise<PlacesFile>;
    })
    .then((file) => (cached = buildIndex(file)))
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

export function usePlaces(): { index: PlacesIndex | null; error: string | null; retry: () => void } {
  const [index, setIndex] = useState<PlacesIndex | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // The startup prefetch may have finished between render and this effect.
    if (cached) {
      setIndex(cached);
      return;
    }
    let alive = true;
    loadPlaces().then(
      (i) => alive && setIndex(i),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  return {
    index,
    error,
    retry: () => {
      setError(null);
      setAttempt((a) => a + 1);
    },
  };
}
