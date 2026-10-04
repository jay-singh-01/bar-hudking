import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import PlaceList from "../components/PlaceList";
import EmptyState from "../components/EmptyState";
import BottomSheet from "../components/BottomSheet";
import SurpriseSheet from "../components/SurpriseSheet";
import { LIST_EMOJIS } from "../components/AddToListSheet";
import Icon from "../components/Icon";
import { usePlaces } from "../lib/places";
import { deleteList, toggleInList, updateList, useUserData } from "../lib/store";
import { useFilterContext } from "../lib/useFilterContext";
import { sharedListUrl, shareLink } from "../lib/share";
import { sortPlaces } from "../lib/discover";
import { toast } from "../lib/toast";

export default function ListDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const list = useUserData((d) => (d.lists[id] && !d.lists[id].deleted ? d.lists[id] : null));
  const myName = useUserData((d) => d.profile.name);
  const { index } = usePlaces();
  const ctx = useFilterContext();
  const [editing, setEditing] = useState(false);
  const [surprise, setSurprise] = useState(false);
  const [name, setName] = useState(list?.name ?? "");
  const [emoji, setEmoji] = useState(list?.emoji ?? "📍");

  const places = useMemo(
    () => (list && index ? list.placeIds.map((pid) => index.byId.get(pid)).filter((p) => !!p) : []),
    [list, index],
  );

  if (!list) {
    return <EmptyState emoji="🗂️" title="List not found" message="It may have been deleted." action={{ label: "Back", onClick: () => navigate("/saved?tab=lists") }} />;
  }

  return (
    <div className="pb-nav">
      <PageHeader
        title={`${list.emoji} ${list.name}`}
        subtitle={`${places.length} places`}
        back
        right={
          <div className="flex">
            <button
              className="rounded-full p-2.5 active:bg-surface-2"
              aria-label="Share list"
              onClick={() =>
                shareLink(
                  list.name,
                  `${list.emoji} ${list.name} — ${places.length} places on BarHudking`,
                  sharedListUrl({ name: list.name, emoji: list.emoji, placeIds: list.placeIds, from: myName || undefined }),
                )
              }
            >
              <Icon name="share" />
            </button>
            <button className="rounded-full p-2.5 active:bg-surface-2" aria-label="Edit list" onClick={() => setEditing(true)}>
              <Icon name="edit" />
            </button>
          </div>
        }
      />

      <div className="px-4">
        {places.length > 1 && (
          <div className="mb-3 flex gap-2">
            <button className="chip" onClick={() => setSurprise(true)}>
              <Icon name="dice" className="h-4 w-4 text-brand" /> Pick one from this list
            </button>
          </div>
        )}
        {places.length ? (
          <PlaceList
            places={places}
            coords={ctx.coords}
            memoryKey={`list:${id}`}
            renderAction={(p) => (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleInList(list.id, p.id);
                  toast(`Removed ${p.name}`, { label: "Undo", onClick: () => toggleInList(list.id, p.id) });
                }}
                className="-mt-1 -mr-1 rounded-full p-1.5 text-faint active:bg-surface-3"
                aria-label={`Remove ${p.name} from list`}
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            )}
          />
        ) : (
          <EmptyState
            emoji={list.emoji}
            title="Empty list"
            message="Open any place and tap “Add to list” to drop it in here."
            action={{ label: "Find places", onClick: () => navigate("/") }}
          />
        )}
      </div>

      {editing && (
        <BottomSheet
          title="Edit list"
          onClose={() => setEditing(false)}
          footer={
            <div className="flex gap-3">
              <button
                className="btn-ghost text-rose-400"
                onClick={() => {
                  if (!window.confirm(`Delete “${list.name}”?`)) return;
                  deleteList(list.id);
                  toast("List deleted");
                  navigate("/saved?tab=lists", { replace: true });
                }}
              >
                <Icon name="trash" className="h-4 w-4" /> Delete
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  updateList(list.id, { name: name.trim() || list.name, emoji });
                  setEditing(false);
                }}
              >
                Save
              </button>
            </div>
          }
        >
          <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
            {LIST_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl ${
                  emoji === e ? "bg-brand/20 ring-2 ring-brand" : "bg-surface-2"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" maxLength={60} />
        </BottomSheet>
      )}

      {surprise && (
        <SurpriseSheet
          title={`From ${list.name}…`}
          candidates={sortPlaces(places, "recommended", ctx, "")}
          coords={ctx.coords}
          onClose={() => setSurprise(false)}
        />
      )}
    </div>
  );
}
