import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BottomSheet from "./BottomSheet";
import Icon from "./Icon";
import PlacePhoto from "./PlacePhoto";
import { RatingPill } from "./Rating";
import { OpenBadge } from "./PlaceCard";
import type { Place } from "../lib/types";
import { formatPriceForTwo, TYPE_META } from "../lib/discover";
import { formatDistance, haversineKm, type Coords } from "../lib/geo";
import { directionsUrl } from "../lib/maps";

interface SurpriseSheetProps {
  /** Candidates, best first. The pick is weighted toward the top. */
  candidates: Place[];
  coords: Coords | null;
  onClose: () => void;
  title?: string;
}

function weightedPick(pool: Place[], exclude?: string): Place | null {
  const options = pool.filter((p) => !p.status).slice(0, 80).filter((p) => p.id !== exclude);
  if (!options.length) return pool[0] ?? null;
  // Rank-based weights: #1 is ~6x likelier than #80, but anything can come up.
  const weights = options.map((_, i) => 1 / (1 + i / 15));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

export default function SurpriseSheet({ candidates, coords, onClose, title = "Tonight, try…" }: SurpriseSheetProps) {
  const navigate = useNavigate();
  const [pick, setPick] = useState<Place | null>(null);
  const [spinning, setSpinning] = useState(true);
  const [flicker, setFlicker] = useState<string>("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Read through a ref so a parent re-render with a new array doesn't restart the spin.
  const pool = useRef(candidates);
  pool.current = candidates;

  const spin = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSpinning(true);
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      // Ease out: steps get slower toward the end, like a slot machine.
      const at = 900 * (1 - Math.pow(1 - i / steps, 2));
      timers.current.push(
        setTimeout(() => setFlicker(pool.current[Math.floor(Math.random() * Math.min(pool.current.length, 80))]?.name ?? ""), at),
      );
    }
    timers.current.push(
      setTimeout(() => {
        setPick((prev) => weightedPick(pool.current, prev?.id));
        setSpinning(false);
        if (navigator.vibrate) navigator.vibrate(20);
      }, 950),
    );
  }, []);

  useEffect(() => {
    spin();
    return () => timers.current.forEach(clearTimeout);
  }, [spin]);

  if (!candidates.length) {
    return (
      <BottomSheet title="Surprise me" onClose={onClose}>
        <p className="py-6 text-center text-muted">Nothing matches your current filters. Loosen them up and try again!</p>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title={title} onClose={onClose}>
      {spinning || !pick ? (
        <div className="flex h-[340px] flex-col items-center justify-center gap-4">
          <Icon name="dice" className="h-10 w-10 animate-spin text-brand [animation-duration:0.7s]" strokeWidth={1.5} />
          <p className="font-display h-8 max-w-full truncate px-4 text-xl font-semibold text-muted">{flicker}</p>
        </div>
      ) : (
        <div className="animate-fade-up">
          <div className="relative overflow-hidden rounded-xl">
            <PlacePhoto place={pick} className="h-52 w-full" emojiSize="text-6xl" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">
                {TYPE_META[pick.type].label}
                {pick.area ? ` · ${pick.area}` : ""}
              </p>
              <h3 className="font-display text-[26px] leading-tight font-semibold text-white">{pick.name}</h3>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <RatingPill rating={pick.rating} count={pick.ratingCount} />
            {formatPriceForTwo(pick) && <span className="tabular text-muted">{formatPriceForTwo(pick)}</span>}
            {coords && <span className="text-muted">{formatDistance(haversineKm(coords, pick))} away</span>}
            <OpenBadge place={pick} />
          </div>
          {(pick.description || pick.review) && (
            <p className="font-display mt-3 line-clamp-3 text-[15px] leading-relaxed text-ink/80 italic">{pick.description ?? `“${pick.review!.text}”`}</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="btn-ghost" onClick={spin}>
              <Icon name="shuffle" className="h-4 w-4" /> Spin again
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                onClose();
                navigate(`/place/${encodeURIComponent(pick.id)}`);
              }}
            >
              Let's go
            </button>
          </div>
          <a
            href={directionsUrl(pick)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 text-sm text-muted"
          >
            <Icon name="navigation" className="h-4 w-4" /> Directions
          </a>
        </div>
      )}
    </BottomSheet>
  );
}
