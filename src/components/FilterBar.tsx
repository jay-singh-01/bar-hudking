import { useState } from "react";
import FilterSheet from "./FilterSheet";
import DistanceSheet from "./DistanceSheet";
import { PLACE_TYPES } from "../lib/constants";
import { EMPTY_FILTERS } from "../lib/types";
import type { PlaceFilters } from "../lib/types";
import type { GeoState } from "../lib/useGeolocation";

type MultiFilterKey = "areas" | "placeTypes" | "cuisines" | "vibes";
type OpenSheet = MultiFilterKey | "distance" | null;

interface FilterBarProps {
  filters: PlaceFilters;
  onChange: (filters: PlaceFilters) => void;
  areaOptions: string[];
  cuisineOptions: string[];
  vibeOptions: string[];
  geo: GeoState;
}

export default function FilterBar({
  filters,
  onChange,
  areaOptions,
  cuisineOptions,
  vibeOptions,
  geo,
}: FilterBarProps) {
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);

  const chips: { key: MultiFilterKey; label: string; options: string[] }[] = [
    { key: "areas", label: "Location", options: areaOptions },
    { key: "placeTypes", label: "Type", options: [...PLACE_TYPES] },
    { key: "cuisines", label: "Cuisine", options: cuisineOptions },
    { key: "vibes", label: "Vibe", options: vibeOptions },
  ];

  function setFilter(key: MultiFilterKey, next: string[]) {
    onChange({ ...filters, [key]: next });
  }

  const activeChip = chips.find((c) => c.key === openSheet);
  const hasAnyFilter =
    chips.some((c) => filters[c.key].length > 0) ||
    filters.maxDistanceKm !== null ||
    filters.superSuggest;

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {chips
          .filter((c) => c.options.length > 0)
          .map((chip) => {
            const count = filters[chip.key].length;
            return (
              <button
                key={chip.key}
                onClick={() => setOpenSheet(chip.key)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  count > 0
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-slate-700 text-slate-300"
                }`}
              >
                {chip.label}
                {count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}

        <button
          onClick={() => setOpenSheet("distance")}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${
            filters.maxDistanceKm !== null
              ? "border-brand bg-brand/10 text-brand"
              : "border-slate-700 text-slate-300"
          }`}
        >
          Distance{filters.maxDistanceKm !== null ? ` (${filters.maxDistanceKm}km)` : ""}
        </button>

        {hasAnyFilter && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm text-slate-400 underline underline-offset-2"
          >
            Clear all
          </button>
        )}
      </div>

      {activeChip && (
        <FilterSheet
          title={activeChip.label}
          options={activeChip.options}
          selected={filters[activeChip.key]}
          onChange={(next) => setFilter(activeChip.key, next)}
          onClose={() => setOpenSheet(null)}
        />
      )}

      {openSheet === "distance" && (
        <DistanceSheet
          selected={filters.maxDistanceKm}
          onChange={(km) => onChange({ ...filters, maxDistanceKm: km })}
          onClose={() => setOpenSheet(null)}
          geo={geo}
        />
      )}
    </>
  );
}
