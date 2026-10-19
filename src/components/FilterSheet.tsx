import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import BottomSheet from "./BottomSheet";
import { EMPTY_FILTERS, formatINR, TYPE_META, type Filters } from "../lib/discover";
import { PLACE_TYPES } from "../lib/types";
import type { PlacesIndex } from "../lib/places";
import { requestLocation, useLocation } from "../lib/location";
import { live, useUserData } from "../lib/store";

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
    <section className="border-b border-line py-5 last:border-0">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="eyebrow">{title}</h3>
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
        <span className="block text-[15px]">{label}</span>
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-ink" : "bg-surface-3"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

const DISTANCES = [1, 2, 5, 10, 20];
const RATINGS = [4.0, 4.3, 4.5];
const BUDGET_MIN = 400;
const BUDGET_MAX = 5000;
const BUDGET_STEP = 100;

export default function FilterSheet({ filters, onChange, onClose, index, resultCount, spotCount }: FilterSheetProps) {
  const [allCuisines, setAllCuisines] = useState(false);
  const [allAreas, setAllAreas] = useState(false);
  const geo = useLocation();
  const visits = useUserData((d) => d.visits);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  // What this person actually spends, from their own journal.
  const usualSpend = useMemo(() => {
    const costs = live(visits)
      .map((v) => v.costForTwo)
      .filter((c): c is number => !!c && c > 0)
      .sort((a, b) => a - b);
    return costs.length >= 2 ? costs[Math.floor(costs.length / 2)] : null;
  }, [visits]);

  const cuisines = allCuisines ? index.cuisines : index.cuisines.slice(0, 18);
  const areas = allAreas ? index.areas : index.areas.slice(0, 14);
  const budget = filters.maxBudget ?? BUDGET_MAX;

  return (
    <BottomSheet
      title="Filters"
      tall
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button className="btn-ghost flex-1" onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query, superSuggest: filters.superSuggest })}>
            Reset
          </button>
          <button className="btn-primary flex-[2]" onClick={onClose}>
            Show {resultCount.toLocaleString("en-IN")} places
          </button>
        </div>
      }
    >
      <Section title="Type">
        <div className="grid grid-cols-3 gap-2">
          {PLACE_TYPES.map((t) => {
            const on = filters.types.includes(t);
            return (
              <button
                key={t}
                onClick={() => set({ types: toggle(filters.types, t) })}
                className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition ${
                  on ? "border-ink bg-ink text-bg" : "border-line"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: TYPE_META[t].color }} />
                {TYPE_META[t].plural}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="When">
        <Switch
          label="Tonight"
          sub="Open now and for at least the next two hours"
          checked={filters.tonight}
          onChange={(v) => set({ tonight: v, openNow: v ? false : filters.openNow })}
        />
        <Switch label="Open now" sub="Only places with known hours" checked={filters.openNow} onChange={(v) => set({ openNow: v, tonight: v ? false : filters.tonight })} />
        <Switch
          label="Near my spots"
          sub={
            spotCount ? (
              `Within range of your ${spotCount} saved spot${spotCount > 1 ? "s" : ""}`
            ) : (
              <Link to="/me#spots" className="underline">
                Add home or work first
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
        title="Budget for two"
        hint={filters.maxBudget === null ? "Any" : <span className="tabular font-semibold text-ink">Up to {formatINR(budget)}</span>}
      >
        <input
          type="range"
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={BUDGET_STEP}
          value={budget}
          onChange={(e) => {
            const v = Number(e.target.value);
            set({ maxBudget: v >= BUDGET_MAX ? null : v });
          }}
          className="w-full accent-[var(--brand)]"
          aria-label="Maximum budget for two"
        />
        <div className="tabular mt-1 flex justify-between text-[11px] text-faint">
          <span>{formatINR(BUDGET_MIN)}</span>
          <span>{formatINR(BUDGET_MAX)}+</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[800, 1500, 2500].map((b) => (
            <button key={b} className={`chip ${filters.maxBudget === b ? "chip-on" : ""}`} onClick={() => set({ maxBudget: filters.maxBudget === b ? null : b })}>
              Under {formatINR(b)}
            </button>
          ))}
          {usualSpend && (
            <button className={`chip ${filters.maxBudget === usualSpend ? "chip-on" : ""}`} onClick={() => set({ maxBudget: usualSpend })}>
              My usual · {formatINR(usualSpend)}
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-faint">Places without a known price are hidden while a budget is set.</p>
      </Section>

      <Section title="Distance from you" hint={geo.status === "denied" ? "Location blocked" : geo.status === "loading" ? "Locating…" : undefined}>
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

      <Section title="Google rating">
        <div className="flex flex-wrap gap-2">
          <button className={`chip ${filters.minRating === null ? "chip-on" : ""}`} onClick={() => set({ minRating: null })}>
            Any
          </button>
          {RATINGS.map((r) => (
            <button key={r} className={`chip ${filters.minRating === r ? "chip-on" : ""}`} onClick={() => set({ minRating: r })}>
              {r.toFixed(1)}+
            </button>
          ))}
        </div>
      </Section>

      {index.features.length > 0 && (
        <Section title="Features">
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
              {c.name} <span className="tabular opacity-50">{c.count}</span>
            </button>
          ))}
          {index.cuisines.length > 18 && (
            <button className="chip border-dashed" onClick={() => setAllCuisines(!allCuisines)}>
              {allCuisines ? "Show less" : `${index.cuisines.length - 18} more`}
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
              {a.name} <span className="tabular opacity-50">{a.count}</span>
            </button>
          ))}
          {index.areas.length > 14 && (
            <button className="chip border-dashed" onClick={() => setAllAreas(!allAreas)}>
              {allAreas ? "Show less" : `${index.areas.length - 14} more`}
            </button>
          )}
        </div>
      </Section>
    </BottomSheet>
  );
}
