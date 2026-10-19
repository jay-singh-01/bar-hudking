import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomSheet from "./BottomSheet";
import PlacePhoto from "./PlacePhoto";
import Icon from "./Icon";
import { createPlan, live, setProfileName, useUserData } from "../lib/store";
import { usePlaces } from "../lib/places";
import type { Place } from "../lib/types";

const MAX = 5;

/** Pick 2–5 places (from favourites and lists) to put to a vote. */
export default function NewPlanSheet({ onClose, preselect = [] }: { onClose: () => void; preselect?: string[] }) {
  const navigate = useNavigate();
  const { index } = usePlaces();
  const favs = useUserData((d) => d.favorites);
  const lists = useUserData((d) => d.lists);
  const myName = useUserData((d) => d.profile.name);
  const [title, setTitle] = useState("");
  const [name, setName] = useState(myName);
  const [picked, setPicked] = useState<string[]>(preselect.slice(0, MAX));

  // Candidates: anything preselected, then favourites, then list members.
  const candidates = useMemo(() => {
    if (!index) return [];
    const ids = new Set<string>(preselect);
    for (const f of live(favs).sort((a, b) => b.updatedAt - a.updatedAt)) ids.add(f.placeId);
    for (const l of live(lists)) for (const id of l.placeIds) ids.add(id);
    return [...ids].map((id) => index.byId.get(id)).filter((p): p is Place => !!p);
  }, [index, favs, lists, preselect]);

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX ? cur : [...cur, id]));

  return (
    <BottomSheet
      title="Plan with friends"
      tall
      onClose={onClose}
      footer={
        <button
          className="btn-primary w-full"
          disabled={picked.length < 2 || !name.trim()}
          onClick={() => {
            if (name.trim() !== myName) setProfileName(name.trim());
            const id = createPlan(title, picked);
            onClose();
            navigate(`/plans/${id}`);
          }}
        >
          {picked.length < 2 ? "Pick at least 2 places" : `Create plan with ${picked.length} places`}
        </button>
      }
    >
      <p className="-mt-1 mb-4 text-sm text-muted">Shortlist a few places, share the link, and friends vote for their pick.</p>
      <div className="flex flex-col gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday dinner?" className="input" maxLength={50} />
        {!myName && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (friends will see it)" className="input" maxLength={30} />
        )}
      </div>

      <div className="mt-5 mb-2 flex items-baseline justify-between">
        <p className="eyebrow">Choose places</p>
        <span className="tabular text-xs text-muted">
          {picked.length}/{MAX}
        </span>
      </div>
      {candidates.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Save a few favourites first, then come back to make a plan.</p>
      ) : (
        <ul className="divide-y divide-line">
          {candidates.map((p) => {
            const on = picked.includes(p.id);
            return (
              <li key={p.id}>
                <button onClick={() => toggle(p.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <PlacePhoto place={p} className="h-12 w-12 shrink-0 rounded-lg" emojiSize="text-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted">{p.area}</span>
                  </span>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      on ? "border-ink bg-ink text-bg" : "border-line"
                    }`}
                  >
                    {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
