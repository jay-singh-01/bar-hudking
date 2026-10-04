import { useSyncExternalStore } from "react";
import type { Coords } from "./geo";

export type GeoStatus = "idle" | "loading" | "granted" | "denied" | "unsupported";

export interface GeoState {
  coords: Coords | null;
  status: GeoStatus;
  error: string | null;
}

// App-wide so every page shares one location fix instead of each prompting.
const LAST_KEY = "barhudking:lastLocation";
const MAX_AGE_MS = 30 * 60 * 1000;

function loadLast(): Coords | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const { lat, lng, at } = JSON.parse(raw);
    return Date.now() - at < MAX_AGE_MS ? { lat, lng } : null;
  } catch {
    return null;
  }
}

const last = loadLast();
let state: GeoState = { coords: last, status: last ? "granted" : "idle", error: null };
const listeners = new Set<() => void>();

function set(patch: Partial<GeoState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function requestLocation() {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    set({ status: "unsupported", error: "Location isn't supported in this browser." });
    return;
  }
  set({ status: state.coords ? "granted" : "loading", error: null });
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify({ ...coords, at: Date.now() }));
      } catch {
        // ignore
      }
      set({ coords, status: "granted" });
    },
    (err) => set({ status: state.coords ? "granted" : "denied", error: err.message }),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
  );
}

export function useLocation(): GeoState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
