import { useState } from "react";
import BottomSheet from "./BottomSheet";
import { useUserPlaces } from "../lib/UserPlacesProvider";

interface VisitedPromptProps {
  placeId: string;
  onClose: () => void;
}

export default function VisitedPrompt({ placeId, onClose }: VisitedPromptProps) {
  const { saveVisitDetails } = useUserPlaces();
  const [rating, setRating] = useState<number | null>(null);
  const [cost, setCost] = useState("");

  function handleSave() {
    const parsedCost = cost.trim() ? Number(cost) : null;
    saveVisitDetails(placeId, {
      rating,
      costForTwo: parsedCost !== null && Number.isFinite(parsedCost) ? parsedCost : null,
    });
    onClose();
  }

  return (
    <BottomSheet title="Marked as visited" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm text-slate-400">Rate this place (optional)</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(rating === star ? null : star)}
                className="text-2xl leading-none"
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
              >
                <span className={star <= (rating ?? 0) ? "text-amber-400" : "text-slate-700"}>
                  ★
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-400" htmlFor="visit-cost">
            Approx cost for two, in ₹ (optional)
          </label>
          <input
            id="visit-cost"
            type="number"
            inputMode="numeric"
            min={0}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="e.g. 1500"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-slate-700 py-2 text-sm text-slate-300"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-full bg-brand py-2 text-sm font-medium text-slate-950"
          >
            Save
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
