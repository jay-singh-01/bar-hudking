import type { GeoState } from "../lib/useGeolocation";

interface SuperSuggestButtonProps {
  active: boolean;
  onToggle: (next: boolean) => void;
  geo: GeoState;
}

export default function SuperSuggestButton({ active, onToggle, geo }: SuperSuggestButtonProps) {
  function handleClick() {
    if (active) {
      onToggle(false);
      return;
    }
    if (geo.status === "idle" || geo.status === "denied") geo.request();
    onToggle(true);
  }

  return (
    <div className="px-4 pb-3">
      <button
        onClick={handleClick}
        className={`w-full rounded-full px-4 py-2 text-sm font-semibold ${
          active ? "bg-brand text-slate-950" : "border border-brand text-brand"
        }`}
      >
        {active ? "Super Suggest: on" : "Super Suggest"}
      </button>
      <p className="mt-1 text-center text-xs text-slate-500">
        {active && geo.status === "loading"
          ? "Getting your location..."
          : active && geo.status === "denied"
            ? "Location access denied — tap to retry."
            : "Within 10km of you, 12km of RR Nagar, 10km of HSR Layout"}
      </p>
    </div>
  );
}
