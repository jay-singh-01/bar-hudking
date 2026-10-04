// Map tiles. Defaults to the free, keyless OpenStreetMap tiles, darkened with
// a CSS filter to match the app. Set VITE_MAP_TILE_URL to use a dedicated
// dark style instead (e.g. Stadia "alidade_smooth_dark" — free tier, register
// your domain). CARTO's basemaps now require an API key, so they're not the default.

// `|| undefined` so an empty value copied from .env.example falls back to the default.
const custom = (import.meta.env.VITE_MAP_TILE_URL as string | undefined) || undefined;

export const TILE_URL = custom ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION =
  (import.meta.env.VITE_MAP_TILE_ATTRIBUTION as string | undefined) ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** CSS class that inverts light tiles into a dark map. Not needed for custom (already dark) styles. */
export const TILE_CLASS = custom ? "" : "osm-dark";

export function tileUrl(z: number, x: number, y: number) {
  return TILE_URL.replace("{s}", "a").replace("{r}", "").replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}
