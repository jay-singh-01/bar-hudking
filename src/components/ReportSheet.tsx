import { useState } from "react";
import BottomSheet from "./BottomSheet";
import Icon from "./Icon";
import { hidePlace, type HideReason } from "../lib/store";
import { toast } from "../lib/toast";
import { googleMapsUrl } from "../lib/maps";
import type { Place } from "../lib/types";

const REASONS: { id: HideReason; label: string; sub: string }[] = [
  { id: "closed", label: "It's closed down", sub: "Shut permanently or not there any more" },
  { id: "wrong-location", label: "Wrong location", sub: "The pin or address is off" },
  { id: "wrong-info", label: "Something else is wrong", sub: "Hours, price, type or name" },
  { id: "not-for-me", label: "Just not for me", sub: "Stop showing it in suggestions" },
];

/**
 * "Something wrong?" — hides the place for this person everywhere except
 * their saved lists (undo from Me → Hidden places), and points to the right
 * place to fix the source data.
 */
export default function ReportSheet({ place, onClose, onHidden }: { place: Place; onClose: () => void; onHidden: () => void }) {
  const [reason, setReason] = useState<HideReason | null>(null);
  const [note, setNote] = useState("");

  return (
    <BottomSheet
      title="Something wrong?"
      onClose={onClose}
      footer={
        <button
          className="btn-primary w-full"
          disabled={!reason}
          onClick={() => {
            if (!reason) return;
            hidePlace(place.id, reason, note.trim());
            toast(`${place.name} hidden`);
            onHidden();
          }}
        >
          <Icon name="eyeOff" className="h-4 w-4" /> Hide this place
        </button>
      }
    >
      <p className="-mt-1 mb-4 text-sm text-muted">{place.name} will stop appearing in Discover, the map and suggestions for you.</p>
      <div className="flex flex-col">
        {REASONS.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-start gap-3 border-b border-line py-3 last:border-0">
            <input
              type="radio"
              name="reason"
              checked={reason === r.id}
              onChange={() => setReason(r.id)}
              className="mt-1 h-4 w-4 accent-[var(--brand)]"
            />
            <span>
              <span className="block text-[15px]">{r.label}</span>
              <span className="block text-xs text-muted">{r.sub}</span>
            </span>
          </label>
        ))}
      </div>
      {reason && reason !== "not-for-me" && (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything to add? (kept on your device)"
            className="input mt-3 resize-none text-sm"
          />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            To fix it for everyone, suggest an edit on{" "}
            <a className="underline" href={googleMapsUrl(place)} target="_blank" rel="noreferrer">
              Google Maps
            </a>{" "}
            or{" "}
            <a className="underline" href={`https://www.openstreetmap.org/note/new#map=19/${place.lat}/${place.lng}`} target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
            .
          </p>
        </>
      )}
    </BottomSheet>
  );
}
