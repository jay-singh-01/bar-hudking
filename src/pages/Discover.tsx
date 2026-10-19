import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import SuperSuggestChip from "../components/SuperSuggestChip";
import CountUp from "../components/CountUp";
import PlaceList from "../components/PlaceList";
import PlacePhoto from "../components/PlacePhoto";
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
  openForAtLeast,
  searchScore,
  sortPlaces,
  SORT_OPTIONS,
  TONIGHT_MIN_MINUTES,
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
import { formatMinutes, minutesUntilClose } from "../lib/hours";
import { PLACE_TYPES } from "../lib/types";
import { describeAnchors } from "../lib/superSuggest";
import { buildTaste, closestSeed, suggestForYou } from "../lib/taste";
import { clearRecentSearches, rememberSearch, SEARCH_IDEAS, useRecentPlaces, useRecentSearches } from "../lib/recent";

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 5) return "Still out?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function isEvening(now: Date) {
  const h = now.getHours();
  return h >= 17 || h < 3;
}

function Section({ title, link, children }: { title: string; link?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-[21px] font-semibold">{title}</h2>
        {link}
      </div>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">{children}</div>;
}

export default function Discover() {
  const { index, error, retry } = usePlaces();
  const geo = useLocation();
  const ctx = useFilterContext();
  const userData = useUserData((d) => d);
  const name = userData.profile.name;
  const [filters, setFilters] = usePersisted<Filters>("discover:filters", EMPTY_FILTERS);
  const [sort, setSort] = usePersisted<SortKey>("discover:sort", "recommended", "local");
  const [sheet, setSheet] = useState<"filters" | "sort" | "surprise" | null>(null);
  const [showLimited, setShowLimited] = usePersisted("discover:showLimited", false);
  const [searchFocused, setSearchFocused] = useState(false);
  const recentIds = useRecentPlaces();
  const recentSearches = useRecentSearches();
  const [params, setParams] = useSearchParams();
  const query = useDeferredValue(filters.query);

  // Deep link from a place page: /?area=Indiranagar opens Discover filtered to that area.
  useEffect(() => {
    const area = params.get("area");
    if (!area) return;
    setFilters({ ...EMPTY_FILTERS, areas: [area] });
    setParams({}, { replace: true });
    window.scrollTo(0, 0);
    // Runs once per incoming link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const effectiveSort: SortKey = sort === "distance" && !ctx.coords ? "recommended" : sort;
  const filterCount = activeFilterCount(filters);
  const sheetFilterCount = filterCount - (filters.superSuggest ? 1 : 0) - (filters.tonight ? 1 : 0);
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

  const usable = useMemo(() => (index ? index.places.filter((p) => isComplete(p) && !ctx.hiddenIds.has(p.id)) : []), [index, ctx.hiddenIds]);

  const tonight = useMemo(() => {
    if (!browsing) return [];
    const open = usable.filter((p) => openForAtLeast(p, ctx.now, TONIGHT_MIN_MINUTES));
    return sortPlaces(open, ctx.coords ? "recommended" : "rating", ctx, "").slice(0, 12);
  }, [usable, ctx, browsing]);

  const taste = useMemo(() => (index ? buildTaste(userData, index.byId) : null), [index, userData]);
  const forYou = useMemo(
    () => (taste && browsing ? suggestForYou(usable, taste, (p) => !ctx.hiddenIds.has(p.id)) : []),
    [taste, usable, ctx.hiddenIds, browsing],
  );

  const recent = useMemo(
    () => (index && browsing ? recentIds.map((id) => index.byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p && !ctx.hiddenIds.has(p.id)) : []),
    [index, recentIds, ctx.hiddenIds, browsing],
  );

  const nearby = useMemo(() => {
    if (!ctx.coords || !browsing) return [];
    return sortPlaces(usable.filter((p) => haversineKm(ctx.coords!, p) <= 3), "recommended", ctx, "").slice(0, 12);
  }, [usable, ctx, browsing]);

  const collections = useMemo(() => {
    if (!index) return [];
    return COLLECTIONS.map((c) => {
      const members = sortPlaces(index.places.filter(c.test), c.sort, ctx, "");
      return { ...c, count: members.length, cover: members[0] };
    }).filter((c) => c.count >= 3);
    // Covers only need to be picked once per catalogue load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const nearMeOn = filters.maxDistanceKm !== null;
  const listKey = JSON.stringify([filters, effectiveSort, showLimited]);
  const evening = isEvening(ctx.now);
  const dateLine = ctx.now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="pb-nav">
      <header className="glass sticky top-0 z-30 border-b border-line" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
          <Link to="/" className="flex items-center gap-2" aria-label="BarHudking">
            <Logo className="h-7 w-7" />
            <span className="font-display text-[22px] font-semibold">BarHudking</span>
          </Link>
          <button
            onClick={() => setSheet("surprise")}
            className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-medium active:bg-surface-2"
          >
            <Icon name="dice" className="h-4 w-4" /> Surprise me
          </button>
        </div>

        <div className="px-4">
          <label className="relative block">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => set({ query: e.target.value })}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                if (results.length) rememberSearch(filters.query);
                // Let a tap on a suggestion land before the panel closes.
                setTimeout(() => setSearchFocused(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Search a place, dish, area or vibe"
              className="input !pl-10"
              enterKeyHint="search"
            />
            {filters.query && (
              <button
                onClick={() => set({ query: "" })}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-1.5 text-muted"
                aria-label="Clear search"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            )}
          </label>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
          <SuperSuggestChip active={filters.superSuggest} onToggle={(v) => set({ superSuggest: v })} />
          <button className={`chip ${filters.tonight ? "chip-on" : ""}`} onClick={() => set({ tonight: !filters.tonight, openNow: false })}>
            <Icon name="moon" className="h-3.5 w-3.5" /> Tonight
          </button>
          <button className={`chip ${sheetFilterCount ? "chip-on" : ""}`} onClick={() => setSheet("filters")}>
            <Icon name="sliders" className="h-3.5 w-3.5" />
            Filters{sheetFilterCount ? ` · ${sheetFilterCount}` : ""}
          </button>
          <button className="chip" onClick={() => setSheet("sort")}>
            <Icon name="sort" className="h-3.5 w-3.5" />
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
            <Icon name="locate" className="h-3.5 w-3.5" />
            {nearMeOn ? `Within ${filters.maxDistanceKm} km` : "Near me"}
          </button>
          {PLACE_TYPES.map((t) => {
            const on = filters.types.includes(t);
            return (
              <button
                key={t}
                className={`chip ${on ? "chip-on" : ""}`}
                onClick={() => set({ types: on ? filters.types.filter((x) => x !== t) : [...filters.types, t] })}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPE_META[t].color }} />
                {TYPE_META[t].plural}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-4 pt-5">
        {error && <EmptyState icon="refresh" title="Couldn't load places" message={error} action={{ label: "Try again", onClick: retry }} />}

        {!index && !error && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <PlaceCardSkeleton key={i} />
            ))}
          </div>
        )}

        {index && searchFocused && !filters.query && (
          <div className="mb-6 animate-fade-up">
            {recentSearches.length > 0 && (
              <>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="eyebrow">Recent searches</p>
                  <button className="text-xs text-muted underline-offset-4 hover:underline" onMouseDown={(e) => e.preventDefault()} onClick={clearRecentSearches}>
                    Clear
                  </button>
                </div>
                <div className="mb-5 flex flex-wrap gap-2">
                  {recentSearches.map((s) => (
                    <button key={s} className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => set({ query: s })}>
                      <Icon name="clock" className="h-3.5 w-3.5 text-faint" /> {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className="eyebrow mb-2">Try</p>
            <div className="flex flex-wrap gap-2">
              {SEARCH_IDEAS.map((s) => (
                <button key={s} className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => set({ query: s })}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {index && browsing && (
          <>
            <div className="mb-7 animate-fade-up">
              <p className="eyebrow">{dateLine}</p>
              <h1 className="font-display mt-1 text-[32px] leading-[1.1] font-semibold">
                {greeting(ctx.now)}
                {name ? `, ${name}` : ""}.
                <br />
                <span className="text-muted">{evening ? "Where to tonight?" : "Where to next?"}</span>
              </h1>
            </div>

            {geo.status !== "granted" && (
              <button onClick={requestLocation} className="mb-7 flex w-full items-center gap-3 border-y border-line py-3.5 text-left">
                <Icon name="locate" className="h-5 w-5 text-brand" />
                <span className="flex-1 text-sm">
                  {geo.status === "loading"
                    ? "Finding you…"
                    : geo.status === "denied"
                      ? "Location is blocked — allow it in your browser to see distances"
                      : "Use your location for distances and nearby picks"}
                </span>
                <Icon name="chevronRight" className="h-4 w-4 text-faint" />
              </button>
            )}

            {tonight.length > 0 && (
              <Section
                title={evening ? "Open tonight" : "Open for a while"}
                link={
                  <button className="text-[13px] text-muted underline-offset-4 hover:underline" onClick={() => set({ tonight: true })}>
                    See all
                  </button>
                }
              >
                <Row>
                  {tonight.map((p) => {
                    const left = minutesUntilClose(p.hours, ctx.now);
                    const until = left !== null && left < 24 * 60 ? `Till ${formatMinutes(ctx.now.getHours() * 60 + ctx.now.getMinutes() + left)}` : "Open 24 hours";
                    return <PlaceTile key={p.id} place={p} coords={ctx.coords} caption={[until, p.area].filter(Boolean).join(" · ")} />;
                  })}
                </Row>
              </Section>
            )}

            {recent.length >= 2 && (
              <Section title="Recently viewed">
                <Row>
                  {recent.map((p) => (
                    <PlaceTile key={p.id} place={p} coords={ctx.coords} />
                  ))}
                </Row>
              </Section>
            )}

            {forYou.length > 0 && taste && (
              <Section title="For you">
                <Row>
                  {forYou.map((p) => {
                    const seed = closestSeed(p, taste);
                    return <PlaceTile key={p.id} place={p} coords={ctx.coords} caption={seed ? `Like ${seed.name}` : p.area ?? undefined} />;
                  })}
                </Row>
              </Section>
            )}

            {nearby.length > 0 && (
              <Section title="Close by">
                <Row>
                  {nearby.map((p) => (
                    <PlaceTile key={p.id} place={p} coords={ctx.coords} />
                  ))}
                </Row>
              </Section>
            )}

            <Section title="Collections">
              <Row>
                {collections.map((c) => (
                  <Link key={c.id} to={`/collection/${c.id}`} className="group relative block h-44 w-36 shrink-0 overflow-hidden rounded-xl">
                    {c.cover && <PlacePhoto place={c.cover} className="absolute inset-0 h-full w-full transition-transform duration-700 group-hover:scale-105" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="font-display text-[17px] leading-tight font-semibold text-white">{c.title}</p>
                      <p className="tabular mt-0.5 text-[11px] text-white/70">{c.count} places</p>
                    </div>
                  </Link>
                ))}
              </Row>
            </Section>

            <button
              onClick={() => setSheet("surprise")}
              className="mb-8 flex w-full items-center justify-between rounded-xl border border-line px-4 py-4 text-left active:bg-surface"
            >
              <span>
                <span className="font-display block text-lg font-semibold">Can't decide?</span>
                <span className="block text-sm text-muted">Let the dice pick from the best of Bangalore.</span>
              </span>
              <Icon name="dice" className="h-6 w-6 text-brand" />
            </button>

            <div className="mb-3 flex items-baseline justify-between border-t border-line pt-6">
              <h2 className="font-display text-[21px] font-semibold">Top picks</h2>
              <span className="tabular text-[13px] text-muted">{results.length.toLocaleString("en-IN")} places</span>
            </div>
          </>
        )}

        {index && filters.superSuggest && (
          <div className="ss-banner mb-4 flex items-start gap-3 rounded-xl border border-brand/40 bg-brand/[0.07] p-3.5">
            <Icon name="sparkles" className="mt-0.5 h-4 w-4 shrink-0 text-brand" filled />
            <p className="min-w-0 flex-1 text-[13px] leading-relaxed">
              <span className="font-semibold">Super Suggest</span>
              <span className="text-muted"> — {describeAnchors(ctx.anchors)}.</span>
            </p>
            <Link to="/me#super-suggest" className="shrink-0 text-[13px] font-medium underline underline-offset-4">
              Edit
            </Link>
          </div>
        )}

        {index && filters.tonight && (
          <p className="mb-3 text-[13px] text-muted">Open now and for at least the next two hours.</p>
        )}

        {index && !browsing && (
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted">
              <span className="tabular font-semibold text-ink">
                <CountUp value={results.length} duration={650} />
              </span>{" "}
              {results.length === 1 ? "place" : "places"}
            </p>
            {filterCount > 0 && (
              <button className="text-[13px] font-medium underline underline-offset-4" onClick={() => setFilters({ ...EMPTY_FILTERS, query: filters.query })}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {index && nearMeOn && !ctx.coords && (
          <EmptyState
            icon="locate"
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
            icon="search"
            title="Nothing matches"
            message={query ? `No places match “${query}” with these filters.` : "Try loosening a filter or two."}
            action={{ label: "Clear everything", onClick: () => setFilters(EMPTY_FILTERS) }}
          />
        )}

        {index && !(nearMeOn && !ctx.coords) && results.length > 0 && <PlaceList places={results} coords={ctx.coords} memoryKey={listKey} />}

        {index && !(nearMeOn && !ctx.coords) && limitedCount > 0 && (
          <button onClick={() => setShowLimited(!showLimited)} className="mt-4 w-full rounded-xl border border-dashed border-line py-3.5 text-[13px] text-muted active:bg-surface">
            {showLimited
              ? "Hide places with limited info"
              : `Show ${limitedCount.toLocaleString("en-IN")} more with limited info (no rating or photo)`}
          </button>
        )}
      </main>

      {sheet === "filters" && index && (
        <FilterSheet filters={filters} onChange={setFilters} onClose={() => setSheet(null)} index={index} resultCount={results.length} spotCount={ctx.spots.length} />
      )}

      {sheet === "sort" && (
        <BottomSheet title="Sort by" onClose={() => setSheet(null)}>
          <div className="flex flex-col">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  if (o.needsLocation && !ctx.coords) requestLocation();
                  setSort(o.id);
                  setSheet(null);
                }}
                className="flex items-center justify-between border-b border-line py-3.5 text-left text-[15px] last:border-0"
              >
                <span className={sort === o.id ? "font-semibold" : ""}>{o.label}</span>
                {sort === o.id && <Icon name="check" className="h-5 w-5 text-brand" />}
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
                  usable.filter((p) => !p.hours || matchesFilters(p, { ...EMPTY_FILTERS, openNow: true }, ctx)),
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
