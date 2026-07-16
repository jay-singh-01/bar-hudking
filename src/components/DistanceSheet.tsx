import BottomSheet from "./BottomSheet";
import { DISTANCE_OPTIONS_KM } from "../lib/constants";
import type { GeoState } from "../lib/useGeolocation";

interface DistanceSheetProps {
  selected: number | null;
  onChange: (next: number | null) => void;
  onClose: () => void;
  geo: GeoState;
}

export default function DistanceSheet({ selected, onChange, onClose, geo }: DistanceSheetProps) {
  return (
    <BottomSheet
      title="Distance"
      onClose={onClose}
      footer={
        selected !== null ? (
          <button
            onClick={() => onChange(null)}
            className="text-left text-sm text-slate-400 underline underline-offset-2"
          >
            Clear distance
          </button>
        ) : undefined
      }
    >
      {geo.status === "loading" && (
        <p className="px-2 py-2 text-sm text-slate-400">Getting your location...</p>
      )}
      {geo.status === "denied" && (
        <div className="px-2 py-2 text-sm text-slate-400">
          <p>Location access was denied.</p>
          <button onClick={geo.request} className="mt-2 text-brand underline underline-offset-2">
            Try again
          </button>
        </div>
      )}
      {geo.status === "unsupported" && (
        <p className="px-2 py-2 text-sm text-slate-400">
          Your browser doesn't support location services.
        </p>
      )}

      <ul className="flex flex-col gap-1">
        {DISTANCE_OPTIONS_KM.map((km) => (
          <li key={km}>
            <label className="flex items-center gap-3 rounded-lg px-2 py-2 active:bg-slate-800">
              <input
                type="radio"
                name="distance"
                checked={selected === km}
                onChange={() => {
                  if (geo.status === "idle") geo.request();
                  onChange(km);
                }}
                className="h-4 w-4 accent-brand"
              />
              <span className="text-sm text-slate-200">Within {km} km</span>
            </label>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
