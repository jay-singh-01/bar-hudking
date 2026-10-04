import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import SuperSuggestChip from "../components/SuperSuggestChip";
import CountUp from "../components/CountUp";
import PlaceList from "../components/PlaceList";
import { PlaceCardSkeleton, PlaceTile } from "../components/PlaceCard";
import FilterSheet from "../components/FilterSheet";
import SurpriseSheet from "../components/SurpriseSheet";
import BottomSheet from "../components/BottomSheet";
import EmptyState from "../components/EmptyState";
import {
  activeFilterCount,
  COLLECTIONS,
  isComplete,
  EMPTY_FILTERS,
  matchesFilters,
  searchScore,
  sortPlaces,
  SORT_OPTIONS,
  TYPE_META,
  type Filters,
  type SortKey,
} from "../lib/discover";
import { usePlaces } from "../lib/places";
import { requestLocation, useLocation } from "../lib/location";
import { useUserData } from "../lib/store";
import { usePersisted } from "../lib/usePersisted";
import { useFilterContext } from "../lib/useFilterContext";
import { haversineKm } from "../lib/geo";
import { PLACE_TYPES } from "../lib/types";
import { describeAnchors } from "../lib/superSuggest";

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 5) return "Up late? 🌙";
  if (h < 12) return "Good morning ☀️";
  if (h < 17) return "Good afternoon 🌤️";
  if (h < 21) return "Good evening 🌆";
  return "Night's young 🌃";
}

export default function Discover() {
  const { index, error, retry } = usePlaces();
  const geo = useLocation();
  const ctx = useFilterContext();
  const name = useUserData((d) => d.profile.name);
  const [filters, setFilters] = usePersisted<Filters>("discover:filters", EMPTY_FILTERS);
  const [sort, setSort] = usePersisted<SortKey>("discover:sort", "recommended", "local");
  const [sheet, setSheet] = useState<"filters" | "sort" | "surprise" | null>(null);
  const [showLimited, setShowLimited] = usePersisted("discover:showLimited", false);
  const query = useDeferredValue(filters.query);

  const effectiveSort: SortKey = sort === "distance" && !ctx.coords ? "recommended" : sort;
  const filterCount = activeFilterCount(filters);
  const browsing = !query.trim() && filterCount === 0;

  // Everything matching, split into complete places (rating + photo) and the
  // rest, which only appear on request.
  const { results, limitedCount } = useMemo(() => {
    if (!index) return { results: [], limitedCount: 0 };
    const q = query.trim();
    const all = index.places.filter((p) => (!q || searchScore(p, q) > 0) && matchesFilters(p, filters, ctx));
    const complete = all.filter(isComplete);
    return {
      results: sortPlaces(showLimited ? all : complete, effectiveSort, ctx, q),
      limitedCount: all.length - complete.length,
    };
  }, [index, query, filters, ctx, effectiveSort, showLimited]);

  const nearby = useMemo(() => {
    if (!index || !ctx.coords || !browsing) return [];
    const close = index.places.filter((p) => isComplete(p) && haversineKm(ctx.coords!, p) <= 3);
    return sortPlaces(close, "recommended", ctx, "").slice(0, 12);
  }, [index, ctx, browsing]);

  const collections = useMemo(
    () => (index ? COLLECTIONS.map((c) => ({ ...c, count: index.places.filter(c.test).length })).filter((c) => c.count >= 3) : []),
    [index],
  );

  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const nearMeOn = filters.maxDistanceKm !== null;
  const listKey = JSON.stringify([filters, effectiveSort, showLimited]);

  return (
    <div className="pb-nav">
      <header className="glass sticky top-0 z-30 border-b border-line/50" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="px-4 pt-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-sm text-muted">
                {greeting(ctx.now)}
                {name ? `, ${name}` : ""}
              </p>
              <h1 className="flex items-center gap-2">
                <Logo className="h-8 w-8" />
                <span className="bg-gradient-to-r from-[#f7d58b] via-brand to-brand-2 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
                  BarHudking
                </span>
              </h1>
            </div>
            <button
              onClick={() => setSheet("surprise")}
              className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3.5 py-2 text-sm font-semibold active:scale-95"
            >
              <Icon name="dice" className="h-4 w-4 text-brand" /> Surprise me
            </button>
          </div>

          <label className="relative block">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Search bars, cuisines, areas…"
              className="input rounded-full !pl-12"
              enterKeyHint="search"
            />
            {filters.query && (
              <button
                onClick={() => set({ query: "" })}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-muted"
                aria-label="Clear search"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          <SuperSuggestChip active={filters.superSuggest} onToggle={(v) => set({ superSuggest: v })} />
          <button className={`chip ${filterCount - (filters.superSuggest ? 1 : 0) ? "chip-on" : ""}`} onClick={() => setSheet("filters")}>
            <Icon name="sliders" className="h-4 w-4" />
            Filters{filterCount - (filters.superSuggest ? 1 : 0) ? ` · ${filterCount - (filters.superSuggest ? 1 : 0)}` : ""}
          </button>
          <button className="chip" onClick={() => setSheet("sort")}>
            <Icon name="sort" className="h-4 w-4" />
            {SORT_OPTIONS.find((o) => o.id === effectiveSort)?.label}
          </button>
          <button
            className={`chip ${nearMeOn ? "chip-on" : ""}`}
            onClick={() => {
              if (nearMeOn) return set({ maxDistanceKm: null });
              requestLocation();
              set({ maxDistanceKm: 3 });
            }}
          >
            <Icon name="locate" className="h-4 w-4" />
            {nearMeOn ? `Within ${filters.maxDistanceKm} km` : "Near me"}
          </button>
          <button className={`chip ${filters.openNow ? "chip-on" : ""}`} onClick={() => set({ openNow: !filters.openNow })}>
            <Icon name="clock" className="h-4 w-4" /> Open now
          </button>
          {PLACE_TYPES.map((t) => {
            const on = filters.types.includes(t);
            return (
              <button
                key={t}
                className={`chip ${on ? "chip-on" : ""}`}
                onClick={() => set({ types: on ? filters.types.filter((x) => x !== t) : [...filters.types, t] })}
              >
                {TYPE_META[t].emoji} {TYPE_META[t].plural}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-4 pt-4">
        {error && (
          <EmptyState emoji="📡" title="Couldn't load places" message={error} action={{ label: "Try again", onClick: retry }} />
        )}

        {!index && !error && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <PlaceCardSkeleton key={i} />
            ))}
          </div>
        )}

        {index && browsing && (
          <>
            <button
              onClick={() => setSheet("surprise")}
              className="relative mb-6 flex w-full animate-gradient items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-[#ff5a4d] to-brand-2 bg-[length:200%_200%] p-5 text-left shadow-xl shadow-brand/20 active:scale-[0.99]"
            >
              <div className="absolute -top-6 -right-4 text-[110px] leading-none opacity-20">🎲</div>
              <div className="relative">
                <p className="text-xs font-bold tracking-widest text-white/80 uppercase">Can't decide?</p>
                <p className="text-xl leading-tight font-extrabold text-white">Let us pick your next spot</p>
                <p className="mt-1 text-sm text-white/85">One tap, one great place. Spin as many times as you like.</p>
              </div>
            </button>

            {geo.status !== "granted" && (
              <button
                onClick={requestLocation}
                className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                  <Icon name="locate" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">
                    {geo.status === "loading" ? "Finding you…" : "See what's around you"}
                  </span>
                  <span className="block text-xs text-muted">
                    {geo.status === "denied"
                      ? "Location is blocked. Allow it in your browser settings."
                      : "Distances, nearby picks and 'near me' filters"}
                  </span>
                </span>
                <Icon name="chevronRight" className="h-5 w-5 text-faint" />
              </button>
            )}

            {nearby.length > 0 && (
              <section className="mb-7">
                <h2 className="mb-3 text-lg font-bold">Close to you</h2>
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                  {nearby.map((p) => (
                    <PlaceTile key={p.id} place={p} coords={ctx.coords} />
                  ))}
                </div>
              </section>
            )}

            <section className="mb-7">
              <h2 className="mb-3 text-lg font-bold">Collections</h2>
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                {collections.map((c) => (
                  <Link
                    key={c.id}
                    to={`/collection/${c.id}`}
                    className={`lift relative flex h-36 w-36 shrink-0 flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br p-3.5 active:scale-[0.97] ${c.gradient}`}
                  >
                    <span className="absolute top-2.5 right-3 text-4xl drop-shadow">{c.emoji}</span>
                    <span className="text-[15px] leading-tight font-extrabold text-white">{c.title}</span>
                    <span className="text-xs text-white/80">{c.count} places</span>
                  </Link>
                ))}
              </div>
            </section>

            <h2 className="mb-3 text-lg font-bold">Top picks in Bangalore</h2>
          </>
        )}

        {index && filters.superSuggest && (
          <div className="ss-banner mb-4 flex items-start gap-3 rounded-2xl bg-gradient-to-br from-brand/15 to-brand-2/10 p-3.5">
            <span className="mt-0.5 animate-pop text-xl">✨</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Super Suggest</p>
              <p className="text-xs leading-relaxed text-muted">{describeAnchors(ctx.anchors)}.</p>
            </div>
            <Link to="/me#super-suggest" className="shrink-0 text-xs font-semibold text-brand">
              Edit
            </Link>
          </div>
        )}

        {index && !browsing && (
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">
                <CountUp value={results.length} duration={650} />
              </span>{" "}
              {results.length === 1 ? "place" : "places"}
            </p>
            {filterCount > 0 && (
              <button className="text-sm font-semibold text-brand" onClick={() => setFilters({ ...EMPTY_FILTERS, query: filters.query })}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {index && nearMeOn && !ctx.coords && (
          <EmptyState
            emoji="📍"
            title={geo.status === "loading" ? "Finding you…" : "Need your location"}
            message={
              geo.status === "denied"
                ? "Location is blocked for this site. Allow it in your browser settings, or turn off the distance filter."
                : "Allow location access to see places near you."
            }
            action={geo.status === "loading" ? undefined : { label: "Use my location", onClick: requestLocation }}
          />
        )}

        {index && !(nearMeOn && !ctx.coords) && results.length === 0 && (
          <EmptyState
            emoji="🔍"
            title="Nothing matches"
            message={query ? `No places match “${query}” with these filters.` : "Try loosening a filter or two."}
            action={{ label: "Clear everything", onClick: () => setFilters(EMPTY_FILTERS) }}
          />
        )}

        {index && !(nearMeOn && !ctx.coords) && results.length > 0 && (
          <PlaceList places={results} coords={ctx.coords} memoryKey={listKey} />
        )}

        {index && !(nearMeOn && !ctx.coords) && limitedCount > 0 && (
          <button
            onClick={() => setShowLimited(!showLimited)}
            className="mt-4 w-full rounded-2xl border border-dashed border-line py-3.5 text-sm text-muted active:bg-surface"
          >
            {showLimited
              ? "Hide places with limited info"
              : `Show ${limitedCount.toLocaleString("en-IN")} more ${limitedCount === 1 ? "place" : "places"} with limited info (no rating or photo)`}
          </button>
        )}
      </main>

      {sheet === "filters" && index && (
        <FilterSheet
          filters={filters}
          onChange={setFilters}
          onClose={() => setSheet(null)}
          index={index}
          resultCount={results.length}
          spotCount={ctx.spots.length}
        />
      )}

      {sheet === "sort" && (
        <BottomSheet title="Sort by" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-1">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  if (o.needsLocation && !ctx.coords) requestLocation();
                  setSort(o.id);
                  setSheet(null);
                }}
                className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[15px] ${
                  sort === o.id ? "bg-brand/15 font-semibold text-brand" : "active:bg-surface-2"
                }`}
              >
                {o.label}
                {sort === o.id && <Icon name="check" className="h-5 w-5" />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {sheet === "surprise" && index && (
        <SurpriseSheet
          candidates={
            browsing
              ? sortPlaces(
                  index.places.filter((p) => isComplete(p) && (!p.hours || matchesFilters(p, { ...EMPTY_FILTERS, openNow: true }, ctx))),
                  "recommended",
                  ctx,
                  "",
                )
              : results.filter(isComplete)
          }
          coords={ctx.coords}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
