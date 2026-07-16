import { useCallback, useState } from "react";
import type { Coords } from "./geo";

export type GeoStatus = "idle" | "loading" | "granted" | "denied" | "unsupported";

export interface GeoState {
  coords: Coords | null;
  status: GeoStatus;
  error: string | null;
  request: () => void;
}

export function useGeolocation(): GeoState {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("Geolocation isn't supported in this browser.");
      return;
    }
    setStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      (err) => {
        setStatus("denied");
        setError(err.message);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  return { coords, status, error, request };
}
