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
import NewPlanSheet from "../components/NewPlanSheet";
import { usePlaces } from "../lib/places";
import { live, useUserData } from "../lib/store";
import { useFilterContext } from "../lib/useFilterContext";
import { formatINR, sortPlaces } from "../lib/discover";

type Tab = "favorites" | "lists" | "plans" | "journal";

const TABS: { id: Tab; label: string }[] = [
  { id: "favorites", label: "Favorites" },
  { id: "lists", label: "Lists" },
  { id: "plans", label: "Plans" },
  { id: "journal", label: "Journal" },
];

export default function Saved() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "favorites";
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  return (
    <div className="pb-nav">
      <PageHeader title="Saved" />
      <div className="glass sticky top-[61px] z-20 mb-4 border-b border-line px-4">
        <div className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 py-3 text-sm font-medium transition-colors ${
                tab === t.id ? "border-ink text-ink" : "border-transparent text-muted"
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
        {tab === "plans" && <Plans />}
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
      <EmptyState icon="heart"
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
          <Icon name="dice" className="h-3.5 w-3.5" /> Pick one
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

function Plans() {
  const plansRec = useUserData((d) => d.plans);
  const { index } = usePlaces();
  const plans = useMemo(() => live(plansRec).sort((a, b) => b.updatedAt - a.updatedAt), [plansRec]);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <button onClick={() => setCreating(true)} className="btn-primary mb-5 w-full">
        <Icon name="vote" className="h-4 w-4" /> New plan with friends
      </button>
      {plans.length === 0 ? (
        <EmptyState
          icon="users"
          title="Decide together"
          message="Shortlist a few places, send the link to your group, and see which one wins — no sign-ups needed."
        />
      ) : (
        <ul className="card divide-y divide-line">
          {plans.map((p) => {
            const votes = Object.values(p.votes);
            const tally = new Map<string, number>();
            for (const v of votes) tally.set(v, (tally.get(v) ?? 0) + 1);
            const leader = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
            const leaderName = leader ? index?.byId.get(leader[0])?.name : null;
            return (
              <li key={p.id}>
                <Link to={`/plans/${p.id}`} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-[17px] font-semibold">{p.title}</p>
                    <p className="truncate text-xs text-muted">
                      {p.placeIds.length} places · {votes.length} vote{votes.length === 1 ? "" : "s"}
                      {leaderName ? ` · ${leaderName} leads` : ""}
                    </p>
                  </div>
                  <Icon name="chevronRight" className="h-4 w-4 text-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {creating && <NewPlanSheet onClose={() => setCreating(false)} />}
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
          className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line text-muted active:bg-surface"
        >
          <Icon name="plus" className="h-6 w-6" />
          <span className="text-sm font-medium">New list</span>
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
              className="relative flex aspect-square flex-col justify-end overflow-hidden rounded-xl border border-line bg-surface p-3"
            >
              {covers.length > 0 && (
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px opacity-70">
                  {covers.map((p) => (
                    <PlacePhoto key={p.id} place={p} className="h-full w-full" emojiSize="text-2xl" />
                  ))}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <span className="font-display relative line-clamp-2 text-lg leading-tight font-semibold text-white">
                {l.emoji} {l.name}
              </span>
              <span className="tabular relative mt-0.5 text-xs text-white/70">{l.placeIds.length} places</span>
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
      <EmptyState icon="book"
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
            <h2 className="font-semibold">{m.label}</h2>
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
                    className="flex gap-3 rounded-xl border border-line/70 bg-surface p-2.5 active:scale-[0.99]"
                  >
                    {place && <PlacePhoto place={place} className="h-14 w-14 shrink-0 rounded-xl" emojiSize="text-2xl" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{place?.name ?? "Unknown place"}</p>
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
