import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import Supercluster from "supercluster";
import "leaflet/dist/leaflet.css";
import Icon from "../components/Icon";
import SuperSuggestChip from "../components/SuperSuggestChip";
import PlaceCard from "../components/PlaceCard";
import { usePlaces } from "../lib/places";
import { isComplete, matchesFilters, searchScore, EMPTY_FILTERS, TYPE_META } from "../lib/discover";
import { requestLocation, useLocation } from "../lib/location";
import { useUserData } from "../lib/store";
import { useFilterContext } from "../lib/useFilterContext";
import { usePersisted } from "../lib/usePersisted";
import { BANGALORE_CENTER } from "../lib/areas";
import { TILE_ATTRIBUTION, TILE_CLASS, TILE_URL } from "../lib/tiles";
import { PLACE_TYPES, type Place, type PlaceType } from "../lib/types";

type Mode = "all" | "saved" | "been";

interface MapFilters {
  query: string;
  types: PlaceType[];
  openNow: boolean;
  mode: Mode;
  superSuggest: boolean;
}

const DEFAULT: MapFilters = { query: "", types: [], openNow: false, mode: "all", superSuggest: false };

function pinIcon(place: Place, active: boolean, saved: boolean) {
  const meta = TYPE_META[place.type];
  const size = active ? 36 : 30;
  return L.divIcon({
    className: "",
    html: `<div class="place-pin${active ? " is-active" : ""}" style="width:${size}px;height:${size}px;background:${meta.color}">${
      saved ? "❤️" : meta.emoji
    }</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function clusterIcon(count: number) {
  const size = count < 10 ? 34 : count < 100 ? 42 : 52;
  return L.divIcon({
    className: "",
    html: `<div class="marker-cluster-custom" style="width:${size}px;height:${size}px">${count >= 1000 ? `${Math.round(count / 100) / 10}k` : count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function MapPage() {
  const { index } = usePlaces();
  const geo = useLocation();
  const ctx = useFilterContext();
  const favorites = useUserData((d) => d.favorites);
  const [filters, setFilters] = usePersisted<MapFilters>("map:filters", DEFAULT);
  const [view, setView] = usePersisted("map:view", {
    lat: BANGALORE_CENTER.lat,
    lng: BANGALORE_CENTER.lng,
    zoom: 12,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const meMarker = useRef<L.CircleMarker | null>(null);
  const zone = useRef<L.LayerGroup | null>(null);
  const visibleRef = useRef<Place[]>([]);
  const [bounds, setBounds] = useState<{ bbox: [number, number, number, number]; zoom: number } | null>(null);

  const visible = useMemo(() => {
    if (!index) return [];
    const f = { ...EMPTY_FILTERS, types: filters.types, openNow: filters.openNow, superSuggest: filters.superSuggest };
    return index.places.filter((p) => {
      // Saved/visited places always show; otherwise only complete listings.
      if (filters.mode === "all" && !isComplete(p)) return false;
      if (filters.mode === "saved" && (!favorites[p.id] || favorites[p.id].deleted)) return false;
      if (filters.mode === "been" && !ctx.visitedIds.has(p.id)) return false;
      if (filters.query.trim() && searchScore(p, filters.query) === 0) return false;
      return matchesFilters(p, f, ctx);
    });
  }, [index, filters, favorites, ctx]);

  visibleRef.current = visible;

  const cluster = useMemo(() => {
    const sc = new Supercluster<{ id: string }>({ radius: 64, extent: 256, maxZoom: 17 });
    sc.load(
      visible.map((p) => ({
        type: "Feature" as const,
        properties: { id: p.id },
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      })),
    );
    return sc;
  }, [visible]);

  // Create the map once.
  useEffect(() => {
    if (!container.current || map.current) return;
    const m = L.map(container.current, {
      center: [view.lat, view.lng],
      zoom: view.zoom,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, className: TILE_CLASS, maxZoom: 19 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);

    const update = () => {
      const b = m.getBounds();
      setBounds({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: Math.round(m.getZoom()) });
      const c = m.getCenter();
      setView({ lat: c.lat, lng: c.lng, zoom: m.getZoom() });
    };
    m.on("moveend", update);
    m.on("click", () => setSelectedId(null));
    update();
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // The map is created once; view is only its initial state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render clusters / pins for the current viewport.
  useEffect(() => {
    const lg = layer.current;
    if (!lg || !bounds || !index) return;
    lg.clearLayers();
    for (const f of cluster.getClusters(bounds.bbox, bounds.zoom)) {
      const [lng, lat] = f.geometry.coordinates;
      const props = f.properties as { id?: string; cluster?: boolean; cluster_id?: number; point_count?: number };
      if (props.cluster) {
        L.marker([lat, lng], { icon: clusterIcon(props.point_count!) })
          .on("click", () => {
            const zoom = Math.min(cluster.getClusterExpansionZoom(props.cluster_id!), 18);
            map.current?.flyTo([lat, lng], zoom, { duration: 0.5 });
          })
          .addTo(lg);
      } else {
        const place = index.byId.get(props.id!);
        if (!place) continue;
        L.marker([lat, lng], {
          icon: pinIcon(place, place.id === selectedId, !!favorites[place.id] && !favorites[place.id].deleted),
          zIndexOffset: place.id === selectedId ? 1000 : 0,
        })
          .on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            setSelectedId(place.id);
          })
          .addTo(lg);
      }
    }
  }, [cluster, bounds, index, selectedId, favorites]);

  // Super Suggest zone: one soft circle per point; places sit where all overlap.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    zone.current?.remove();
    zone.current = null;
    if (!filters.superSuggest) return;
    const g = L.layerGroup();
    const circles: { c: L.Circle; r: number }[] = [];
    for (const a of ctx.anchors) {
      const c = L.circle([a.lat, a.lng], {
        radius: a.radiusKm * 1000,
        color: "#ff7a1a",
        weight: 1.5,
        opacity: 0.7,
        dashArray: "6 6",
        fillColor: "#ff7a1a",
        fillOpacity: 0.05,
        interactive: false,
      }).addTo(g);
      circles.push({ c, r: a.radiusKm * 1000 });
      c.setRadius(1);
      L.marker([a.lat, a.lng], {
        icon: L.divIcon({ className: "", html: `<div class="anchor-pin">${a.label.split(",")[0]}</div>`, iconSize: [0, 0] }),
        interactive: false,
      }).addTo(g);
    }
    g.addTo(m);
    zone.current = g;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const grow = (t: number) => {
      const k = reduce ? 1 : Math.min(1, (t - start - 250) / 900);
      const e = k <= 0 ? 0 : 1 - Math.pow(1 - k, 3);
      for (const { c, r } of circles) c.setRadius(Math.max(1, r * e));
      if (k < 1) raf = requestAnimationFrame(grow);
    };
    raf = requestAnimationFrame(grow);
    // Frame the overlap — where the matching places actually are.
    const pts = visibleRef.current.map((p) => [p.lat, p.lng] as [number, number]);
    const target = pts.length ? L.latLngBounds(pts) : L.latLngBounds(ctx.anchors.map((a) => [a.lat, a.lng] as [number, number]));
    m.flyToBounds(target, { duration: 0.7, padding: [40, 120] });
    return () => cancelAnimationFrame(raf);
  }, [filters.superSuggest, ctx.anchors]);

  // "You are here" dot.
  useEffect(() => {
    if (!map.current || !geo.coords) return;
    const ll: L.LatLngExpression = [geo.coords.lat, geo.coords.lng];
    if (meMarker.current) meMarker.current.setLatLng(ll);
    else
      meMarker.current = L.circleMarker(ll, {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#3b82f6",
        fillOpacity: 1,
      }).addTo(map.current);
  }, [geo.coords]);

  const selected = selectedId ? index?.byId.get(selectedId) : undefined;
  const set = (patch: Partial<MapFilters>) => setFilters({ ...filters, ...patch });

  function locate() {
    if (geo.coords) map.current?.flyTo([geo.coords.lat, geo.coords.lng], 15, { duration: 0.6 });
    else requestLocation();
  }

  // Fly to the user once their location arrives after tapping locate.
  const pendingLocate = useRef(false);
  useEffect(() => {
    if (pendingLocate.current && geo.coords) {
      pendingLocate.current = false;
      map.current?.flyTo([geo.coords.lat, geo.coords.lng], 15, { duration: 0.6 });
    }
  }, [geo.coords]);

  return (
    <div className="fixed inset-0">
      <div ref={container} className="absolute inset-0 z-0" />

      {/* Top controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="pointer-events-auto mx-auto max-w-lg px-3 pt-3">
          <label className="relative block">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder={`Search ${visible.length.toLocaleString("en-IN")} places on the map`}
              className="input rounded-full border-line/80 bg-surface/95 !pl-12 shadow-xl backdrop-blur"
            />
          </label>
        </div>
        <div className="no-scrollbar pointer-events-auto flex gap-2 overflow-x-auto px-3 py-2.5">
          <SuperSuggestChip className="shadow-lg" active={filters.superSuggest} onToggle={(v) => set({ superSuggest: v })} />
          {(["all", "saved", "been"] as Mode[]).map((m) => (
            <button
              key={m}
              className={`chip shadow-lg ${filters.mode === m ? "chip-on !bg-[#2a1a10]" : "!bg-surface/95"}`}
              onClick={() => set({ mode: m })}
            >
              {m === "all" ? "Everything" : m === "saved" ? "❤️ Saved" : "✓ Been there"}
            </button>
          ))}
          <button
            className={`chip shadow-lg ${filters.openNow ? "chip-on !bg-[#2a1a10]" : "!bg-surface/95"}`}
            onClick={() => set({ openNow: !filters.openNow })}
          >
            Open now
          </button>
          {PLACE_TYPES.map((t) => {
            const on = filters.types.includes(t);
            return (
              <button
                key={t}
                className={`chip shadow-lg ${on ? "chip-on !bg-[#2a1a10]" : "!bg-surface/95"}`}
                onClick={() => set({ types: on ? filters.types.filter((x) => x !== t) : [...filters.types, t] })}
              >
                {TYPE_META[t].emoji} {TYPE_META[t].plural}
              </button>
            );
          })}
        </div>
      </div>

      {/* Locate */}
      <button
        onClick={() => {
          pendingLocate.current = !geo.coords;
          locate();
        }}
        className="absolute right-4 z-[500] flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface/95 shadow-xl backdrop-blur active:scale-95"
        style={{ bottom: `calc(${selected ? "13.5rem" : "6.5rem"} + env(safe-area-inset-bottom))` }}
        aria-label="Show my location"
      >
        <Icon name="locate" className={`h-5 w-5 ${geo.status === "loading" ? "animate-pulse text-brand" : geo.coords ? "text-sky-400" : ""}`} />
      </button>

      {/* Selected place */}
      {selected && (
        <div
          className="absolute inset-x-0 z-[500] mx-auto max-w-lg px-3"
          style={{ bottom: "calc(5.25rem + env(safe-area-inset-bottom))" }}
        >
          <div className="relative rounded-[28px] shadow-2xl">
            <PlaceCard place={selected} coords={ctx.coords} />
            <button
              onClick={() => setSelectedId(null)}
              className="absolute -top-2 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-3"
              aria-label="Close preview"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
