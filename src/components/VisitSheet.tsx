import { useState } from "react";
import BottomSheet from "./BottomSheet";
import { StarInput } from "./Rating";
import { deleteVisit, saveVisit, todayISO, type Visit } from "../lib/store";
import { toast } from "../lib/toast";
import type { Place } from "../lib/types";

const COST_PRESETS = [500, 1000, 1500, 2000, 3000, 5000];

interface VisitSheetProps {
  place: Place;
  visit?: Visit;
  onClose: () => void;
}

export default function VisitSheet({ place, visit, onClose }: VisitSheetProps) {
  const [date, setDate] = useState(visit?.date ?? todayISO());
  const [rating, setRating] = useState<number | null>(visit?.rating ?? null);
  const [cost, setCost] = useState(visit?.costForTwo ? String(visit.costForTwo) : "");
  const [note, setNote] = useState(visit?.note ?? "");

  function save() {
    const parsed = cost.trim() ? Math.round(Number(cost)) : null;
    saveVisit({
      id: visit?.id,
      placeId: place.id,
      date: date || todayISO(),
      rating,
      costForTwo: parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
      note: note.trim(),
    });
    if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
    toast(visit ? "Visit updated" : `Logged your visit to ${place.name} 🎉`);
    onClose();
  }

  return (
    <BottomSheet
      title={visit ? "Edit visit" : "Log a visit"}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          {visit && (
            <button
              className="btn-ghost text-rose-400"
              onClick={() => {
                deleteVisit(visit.id);
                toast("Visit deleted");
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <button className="btn-primary flex-1" onClick={save}>
            {visit ? "Save changes" : "Save visit"}
          </button>
        </div>
      }
    >
      <p className="-mt-1 mb-5 text-sm text-muted">{place.name}</p>

      <div className="flex flex-col gap-6">
        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="visit-date">
            When did you go?
          </label>
          <input
            id="visit-date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">How was it?</p>
          <StarInput value={rating} onChange={setRating} />
          <p className="mt-1.5 h-4 text-xs text-muted">
            {rating ? ["", "Not for me", "Meh", "Decent", "Really good", "Loved it!"][rating] : ""}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="visit-cost">
            What did it cost for two? <span className="font-normal text-muted">(₹, optional)</span>
          </label>
          <input
            id="visit-cost"
            type="number"
            inputMode="numeric"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="e.g. 1800"
            className="input"
          />
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {COST_PRESETS.map((c) => (
              <button key={c} type="button" onClick={() => setCost(String(c))} className={`chip ${cost === String(c) ? "chip-on" : ""}`}>
                ₹{c.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="visit-note">
            Notes <span className="font-normal text-muted">(what you ordered, who you went with…)</span>
          </label>
          <textarea
            id="visit-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="The pork ribs were unreal. Ask for the window table."
            className="input resize-none"
          />
        </div>
      </div>
    </BottomSheet>
  );
}
