import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import PlaceList from "../components/PlaceList";
import EmptyState from "../components/EmptyState";
import SurpriseSheet from "../components/SurpriseSheet";
import BottomSheet from "../components/BottomSheet";
import { NewListForm } from "../components/AddToListSheet";
import PlacePhoto from "../components/PlacePhoto";
import { MiniStars } from "../components/Rating";
import Icon from "../components/Icon";
import { usePlaces } from "../lib/places";
import { live, useUserData } from "../lib/store";
import { useFilterContext } from "../lib/useFilterContext";
import { formatINR, sortPlaces } from "../lib/discover";

type Tab = "favorites" | "lists" | "journal";

const TABS: { id: Tab; label: string }[] = [
  { id: "favorites", label: "Favorites" },
  { id: "lists", label: "Lists" },
  { id: "journal", label: "Journal" },
];

export default function Saved() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "favorites";
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  return (
    <div className="pb-nav">
      <PageHeader title="Saved" />
      <div className="glass sticky top-[60px] z-20 mb-1 px-4 pt-1 pb-3">
        <div className="flex rounded-full border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                tab === t.id ? "bg-gradient-to-r from-brand to-brand-2 text-white shadow" : "text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4">
        {tab === "favorites" && <Favorites />}
        {tab === "lists" && <Lists />}
        {tab === "journal" && <Journal />}
      </div>
    </div>
  );
}

function Favorites() {
  const { index } = usePlaces();
  const ctx = useFilterContext();
  const favRec = useUserData((d) => d.favorites);
  const navigate = useNavigate();
  const [surprise, setSurprise] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "nearest" | "rating">("recent");

  const places = useMemo(() => {
    if (!index) return [];
    const favs = live(favRec).sort((a, b) => b.updatedAt - a.updatedAt);
    const list = favs.map((f) => index.byId.get(f.placeId)).filter((p) => !!p);
    if (sortBy === "nearest" && ctx.coords) return sortPlaces(list, "distance", ctx, "");
    if (sortBy === "rating") return sortPlaces(list, "rating", ctx, "");
    return list;
  }, [index, favRec, sortBy, ctx]);

  if (index && !places.length) {
    return (
      <EmptyState
        emoji="💛"
        title="No favorites yet"
        message="Tap the heart on any place to keep it here. Your favorites stay on this device — sign in on the Me tab to sync them."
        action={{ label: "Find somewhere", onClick: () => navigate("/") }}
      />
    );
  }

  return (
    <>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        <button className="chip" onClick={() => setSurprise(true)}>
          <Icon name="dice" className="h-4 w-4 text-brand" /> Pick one
        </button>
        {(["recent", "nearest", "rating"] as const).map((s) => (
          <button key={s} className={`chip ${sortBy === s ? "chip-on" : ""}`} onClick={() => setSortBy(s)}>
            {s === "recent" ? "Recently saved" : s === "nearest" ? "Nearest" : "Top rated"}
          </button>
        ))}
      </div>
      <PlaceList places={places} coords={ctx.coords} memoryKey={`favorites:${sortBy}`} />
      {surprise && (
        <SurpriseSheet
          title="From your favorites…"
          candidates={sortPlaces(places, "recommended", ctx, "")}
          coords={ctx.coords}
          onClose={() => setSurprise(false)}
        />
      )}
    </>
  );
}

function Lists() {
  const listsRec = useUserData((d) => d.lists);
  const { index } = usePlaces();
  const lists = useMemo(() => live(listsRec).sort((a, b) => b.updatedAt - a.updatedAt), [listsRec]);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setCreating(true)}
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-line text-brand active:scale-[0.98]"
        >
          <Icon name="plus" className="h-8 w-8" />
          <span className="text-sm font-semibold">New list</span>
        </button>
        {lists.map((l) => {
          const covers = l.placeIds
            .map((id) => index?.byId.get(id))
            .filter((p) => !!p)
            .slice(0, 4);
          return (
            <Link
              key={l.id}
              to={`/lists/${l.id}`}
              className="relative flex aspect-square flex-col justify-end overflow-hidden rounded-3xl border border-line/70 bg-surface p-3 active:scale-[0.98]"
            >
              {covers.length > 0 && (
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-60">
                  {covers.map((p) => (
                    <PlacePhoto key={p.id} place={p} className="h-full w-full" emojiSize="text-2xl" />
                  ))}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <span className="relative text-3xl">{l.emoji}</span>
              <span className="relative mt-1 line-clamp-2 leading-tight font-bold">{l.name}</span>
              <span className="relative text-xs text-white/70">{l.placeIds.length} places</span>
            </Link>
          );
        })}
      </div>
      {lists.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          Make lists like “Birthday dinner ideas” or “Brewery crawl” — and share them with friends.
        </p>
      )}
      {creating && (
        <BottomSheet title="New list" onClose={() => setCreating(false)}>
          <NewListForm
            onCreate={(id) => {
              setCreating(false);
              navigate(`/lists/${id}`);
            }}
          />
        </BottomSheet>
      )}
    </>
  );
}

function Journal() {
  const visitsRec = useUserData((d) => d.visits);
  const { index } = usePlaces();
  const navigate = useNavigate();

  const months = useMemo(() => {
    const visits = live(visitsRec).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
    const groups = new Map<string, typeof visits>();
    for (const v of visits) {
      const key = v.date.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), v]);
    }
    return [...groups.entries()].map(([key, items]) => ({
      label: new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      items,
      spend: items.reduce((s, v) => s + (v.costForTwo ?? 0), 0),
    }));
  }, [visitsRec]);

  if (!months.length) {
    return (
      <EmptyState
        emoji="📔"
        title="Your food & drinks diary"
        message="Every time you go out, tap “I've been here” on a place. Rate it, note what you spent and what you ordered — it all shows up here."
        action={{ label: "Explore places", onClick: () => navigate("/") }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {months.map((m) => (
        <section key={m.label}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-bold">{m.label}</h2>
            <span className="text-xs text-muted">
              {m.items.length} outing{m.items.length > 1 ? "s" : ""}
              {m.spend ? ` · ${formatINR(m.spend)} spent` : ""}
            </span>
          </div>
          <ol className="relative flex flex-col gap-2 border-l-2 border-line/70 pl-4">
            {m.items.map((v) => {
              const place = index?.byId.get(v.placeId);
              return (
                <li key={v.id} className="relative">
                  <span className="absolute top-4 -left-[23px] h-3 w-3 rounded-full border-2 border-bg bg-brand" />
                  <Link
                    to={`/place/${encodeURIComponent(v.placeId)}`}
                    className="flex gap-3 rounded-2xl border border-line/70 bg-surface p-2.5 active:scale-[0.99]"
                  >
                    {place && <PlacePhoto place={place} className="h-14 w-14 shrink-0 rounded-xl" emojiSize="text-2xl" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{place?.name ?? "Unknown place"}</p>
                      <p className="text-xs text-muted">
                        {new Date(`${v.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                        {v.costForTwo ? ` · ${formatINR(v.costForTwo)}` : ""}
                      </p>
                      {v.rating !== null && <MiniStars value={v.rating} />}
                      {v.note && <p className="mt-0.5 line-clamp-2 text-xs text-ink/75 italic">“{v.note}”</p>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
