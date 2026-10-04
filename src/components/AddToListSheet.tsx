import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import Icon from "./Icon";
import { createList, live, toggleInList, useUserData } from "../lib/store";
import { toast } from "../lib/toast";

export const LIST_EMOJIS = ["📍", "🍻", "🍸", "🍕", "☕", "🎉", "💘", "🌶️", "🍣", "🥂", "🎂", "🧳"];

export function NewListForm({ onCreate, initialPlaceIds = [] }: { onCreate: (id: string) => void; initialPlaceIds?: string[] }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(LIST_EMOJIS[1]);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const id = createList(name, emoji, initialPlaceIds);
        setName("");
        onCreate(id);
      }}
    >
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {LIST_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl transition ${
              emoji === e ? "bg-brand/20 ring-2 ring-brand" : "bg-surface-2"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Friday night plans"
          className="input"
          maxLength={60}
          autoFocus
        />
        <button type="submit" className="btn-primary px-4" disabled={!name.trim()}>
          Create
        </button>
      </div>
    </form>
  );
}

export default function AddToListSheet({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const listsRec = useUserData((d) => d.lists);
  const lists = useMemo(() => live(listsRec).sort((a, b) => b.updatedAt - a.updatedAt), [listsRec]);
  const [creating, setCreating] = useState(lists.length === 0);

  return (
    <BottomSheet title="Save to a list" onClose={onClose}>
      <div className="flex flex-col gap-2">
        {lists.map((l) => {
          const on = l.placeIds.includes(placeId);
          return (
            <button
              key={l.id}
              onClick={() => {
                toggleInList(l.id, placeId);
                toast(on ? `Removed from ${l.name}` : `Added to ${l.name}`);
              }}
              className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-xl">{l.emoji}</span>
              <span className="flex-1">
                <span className="block font-semibold">{l.name}</span>
                <span className="text-xs text-muted">{l.placeIds.length} places</span>
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                  on ? "border-brand bg-brand text-white" : "border-line"
                }`}
              >
                {on && <Icon name="check" className="h-4 w-4" strokeWidth={3} />}
              </span>
            </button>
          );
        })}

        {creating ? (
          <div className="mt-2 rounded-2xl border border-dashed border-line p-3">
            <NewListForm
              initialPlaceIds={[placeId]}
              onCreate={() => {
                toast("List created");
                setCreating(false);
              }}
            />
          </div>
        ) : (
          <button onClick={() => setCreating(true)} className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-3 text-brand">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
              <Icon name="plus" />
            </span>
            <span className="font-semibold">New list</span>
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
