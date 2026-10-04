import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import BottomSheet from "./BottomSheet";
import { EMPTY_FILTERS, PRICE_BANDS, TYPE_META, type Filters } from "../lib/discover";
import { PLACE_TYPES } from "../lib/types";
import type { PlacesIndex } from "../lib/places";
import { requestLocation, useLocation } from "../lib/location";

interface FilterSheetProps {
  filters: Filters;
  onChange: (next: Filters) => void;
  onClose: () => void;
  index: PlacesIndex;
  resultCount: number;
  spotCount: number;
}

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <section className="border-b border-line/60 py-5 last:border-0">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-bold tracking-wide text-ink/90 uppercase">{title}</h3>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Switch({ label, sub, checked, onChange, disabled }: { label: string; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-4 py-2 ${disabled ? "opacity-50" : ""}`}>
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-surface-3"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}

const DISTANCES = [1, 2, 5, 10, 20];
const RATINGS = [3.5, 4.0, 4.3, 4.5];

export default function FilterSheet({ filters, onChange, onClose, index, resultCount, spotCount }: FilterSheetProps) {
  const [allCuisines, setAllCuisines] = useState(false);
  const [allAreas, setAllAreas] = useState(false);
  const geo = useLocation();
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const cuisines = allCuisines ? index.cuisines : index.cuisines.slice(0, 18);
  const areas = allAreas ? index.areas : index.areas.slice(0, 14);

  return (
    <BottomSheet
      title="Filters"
      tall
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button className="btn-ghost flex-1" onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}>
            Reset
          </button>
          <button className="btn-primary flex-[2]" onClick={onClose}>
            Show {resultCount.toLocaleString("en-IN")} places
          </button>
        </div>
      }
    >
      <Section title="What are you in the mood for?">
        <div className="grid grid-cols-3 gap-2">
          {PLACE_TYPES.map((t) => {
            const on = filters.types.includes(t);
            return (
              <button
                key={t}
                onClick={() => set({ types: toggle(filters.types, t) })}
                className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-sm font-medium transition ${
                  on ? "border-brand/70 bg-brand/15 text-brand" : "border-line bg-surface-2"
                }`}
              >
                <span className="text-2xl">{TYPE_META[t].emoji}</span>
                {TYPE_META[t].plural}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Right now">
        <Switch label="Open now" sub="Only places with known hours" checked={filters.openNow} onChange={(v) => set({ openNow: v })} />
        <Switch
          label="Near my spots"
          sub={
            spotCount ? (
              `Within range of your ${spotCount} saved spot${spotCount > 1 ? "s" : ""}`
            ) : (
              <Link to="/me#spots" className="text-brand underline">
                Add home/work spots first
              </Link>
            )
          }
          checked={filters.nearMySpots}
          disabled={!spotCount}
          onChange={(v) => set({ nearMySpots: v })}
        />
        <Switch label="Hide places I've been" checked={filters.hideVisited} onChange={(v) => set({ hideVisited: v })} />
      </Section>

      <Section
        title="Distance from you"
        hint={geo.status === "denied" ? "Location blocked" : geo.status === "loading" ? "Locating…" : undefined}
      >
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${filters.maxDistanceKm === null ? "chip-on" : ""}`} onClick={() => set({ maxDistanceKm: null })}>
            Any
          </button>
          {DISTANCES.map((km) => (
            <button
              key={km}
              className={`chip ${filters.maxDistanceKm === km ? "chip-on" : ""}`}
              onClick={() => {
                if (!geo.coords) requestLocation();
                set({ maxDistanceKm: km });
              }}
            >
              {km} km
            </button>
          ))}
        </div>
      </Section>

      <Section title="Cost for two" hint="Approx.">
        <div className="grid grid-cols-4 gap-2">
          {PRICE_BANDS.map((b) => {
            const on = filters.prices.includes(b.id);
            return (
              <button
                key={b.id}
                onClick={() => set({ prices: toggle(filters.prices, b.id) })}
                className={`rounded-2xl border px-1 py-2.5 text-center transition ${
                  on ? "border-brand/70 bg-brand/15 text-brand" : "border-line bg-surface-2"
                }`}
              >
                <span className="block text-sm font-bold">{b.label}</span>
                <span className="block text-[10px] text-muted">{b.hint}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Google rating">
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${filters.minRating === null ? "chip-on" : ""}`} onClick={() => set({ minRating: null })}>
            Any
          </button>
          {RATINGS.map((r) => (
            <button key={r} className={`chip ${filters.minRating === r ? "chip-on" : ""}`} onClick={() => set({ minRating: r })}>
              {r.toFixed(1)}★+
            </button>
          ))}
        </div>
      </Section>

      {index.features.length > 0 && (
        <Section title="Vibe & features">
          <div className="flex flex-wrap gap-2">
            {index.features.map((f) => (
              <button
                key={f.name}
                className={`chip ${filters.features.includes(f.name) ? "chip-on" : ""}`}
                onClick={() => set({ features: toggle(filters.features, f.name) })}
              >
                {f.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Cuisine">
        <div className="flex flex-wrap gap-2">
          {cuisines.map((c) => (
            <button
              key={c.name}
              className={`chip ${filters.cuisines.includes(c.name) ? "chip-on" : ""}`}
              onClick={() => set({ cuisines: toggle(filters.cuisines, c.name) })}
            >
              {c.name} <span className="text-faint">{c.count}</span>
            </button>
          ))}
          {index.cuisines.length > 18 && (
            <button className="chip border-dashed" onClick={() => setAllCuisines(!allCuisines)}>
              {allCuisines ? "Show less" : `+${index.cuisines.length - 18} more`}
            </button>
          )}
        </div>
      </Section>

      <Section title="Neighbourhood">
        <div className="flex flex-wrap gap-2">
          {areas.map((a) => (
            <button
              key={a.name}
              className={`chip ${filters.areas.includes(a.name) ? "chip-on" : ""}`}
              onClick={() => set({ areas: toggle(filters.areas, a.name) })}
            >
              {a.name} <span className="text-faint">{a.count}</span>
            </button>
          ))}
          {index.areas.length > 14 && (
            <button className="chip border-dashed" onClick={() => setAllAreas(!allAreas)}>
              {allAreas ? "Show less" : `+${index.areas.length - 14} more`}
            </button>
          )}
        </div>
      </Section>
    </BottomSheet>
  );
}
