import { memo, useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Place } from "../lib/types";
import { formatPriceForTwo, isHiddenGem, TYPE_META } from "../lib/discover";
import { formatDistance, haversineKm, type Coords } from "../lib/geo";
import { openStatus } from "../lib/hours";
import { isFavorite, toggleFavorite, useUserData } from "../lib/store";
import { toast } from "../lib/toast";
import PlacePhoto from "./PlacePhoto";
import FavoriteButton from "./FavoriteButton";
import { RatingPill } from "./Rating";

function useVisitCount(placeId: string) {
  return useUserData((d) => {
    let n = 0;
    for (const v of Object.values(d.visits)) if (v.placeId === placeId && !v.deleted) n++;
    return n;
  });
}

export function OpenBadge({ place, now }: { place: Place; now?: Date }) {
  if (place.status === "temporarily_closed") {
    return <span className="text-xs font-medium text-brand-2">Temporarily closed</span>;
  }
  const status = openStatus(place.hours, now);
  if (!status) return null;
  const tone = status.open ? (status.closingSoon ? "text-brand" : "text-ok") : "text-faint";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span className="font-medium">{status.open ? (status.closingSoon ? "Closing soon" : "Open") : "Closed"}</span>
      <span className="text-muted">· {status.label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Swipe left to save. Pointer-driven so it works with touch and mouse; the
// track allows vertical panning so scrolling the list is unaffected.
// ---------------------------------------------------------------------------

const SAVE_AT = 88;

function useSwipeToSave(placeId: string) {
  const card = useRef<HTMLDivElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; active: boolean; moved: boolean } | null>(null);

  const set = (dx: number, animate: boolean) => {
    if (!card.current || !reveal.current) return;
    card.current.style.transition = animate ? "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
    card.current.style.transform = dx ? `translateX(${dx}px)` : "";
    reveal.current.style.opacity = String(Math.min(1, -dx / SAVE_AT));
  };

  return {
    card,
    reveal,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        drag.current = { x: e.clientX, y: e.clientY, dx: 0, active: false, moved: false };
      },
      onPointerMove: (e: PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.active) {
          // Commit to a horizontal swipe only when it's clearly sideways.
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4 && dx < 0) {
            d.active = true;
            d.moved = true;
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              // The pointer was already released (fast flick); the swipe still works without capture.
            }
          } else if (Math.abs(dy) > 10) {
            drag.current = null;
            return;
          } else return;
        }
        d.dx = Math.max(-140, Math.min(0, dx));
        set(d.dx, false);
      },
      onPointerUp: () => {
        const d = drag.current;
        if (!d) return;
        if (d.active && d.dx <= -SAVE_AT) {
          const added = toggleFavorite(placeId);
          if (navigator.vibrate) navigator.vibrate(12);
          toast(added ? "Saved to favorites" : "Removed from favorites", { label: "Undo", onClick: () => toggleFavorite(placeId) });
        }
        set(0, true);
        // Let the click that follows a drag know it shouldn't open the place.
        setTimeout(() => (drag.current = null), 0);
      },
      onPointerCancel: () => {
        set(0, true);
        drag.current = null;
      },
      onClickCapture: (e: MouseEvent) => {
        if (drag.current?.moved) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
    },
  };
}

interface PlaceCardProps {
  place: Place;
  coords?: Coords | null;
  /** Optional right-side slot (e.g. remove from list). */
  action?: ReactNode;
  index?: number;
}

function PlaceCard({ place, coords, action, index = 0 }: PlaceCardProps) {
  const visits = useVisitCount(place.id);
  const saved = useUserData((d) => isFavorite(d, place.id));
  const { card, reveal, handlers } = useSwipeToSave(place.id);
  const meta = TYPE_META[place.type];
  const price = formatPriceForTwo(place);
  const distance = coords ? formatDistance(haversineKm(coords, place)) : null;
  const gem = isHiddenGem(place);

  return (
    <div className="swipe-track animate-fade-up" style={{ animationDelay: `${Math.min(index, 8) * 22}ms` }}>
      <div ref={reveal} className="swipe-reveal" style={{ opacity: 0 }} aria-hidden="true">
        {saved ? "Remove" : "Save"}
      </div>
      <div ref={card} className="relative" {...handlers}>
        <Link
          to={`/place/${encodeURIComponent(place.id)}`}
          draggable={false}
          className="lift card flex gap-3.5 p-2.5 pr-3 transition active:bg-surface-2"
        >
          <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl">
            <PlacePhoto place={place} className="h-full w-full" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {gem && <p className="eyebrow mb-0.5 !text-[10px] !text-brand">Hidden gem</p>}
                <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold">{place.name}</h3>
              </div>
              {action ?? <FavoriteButton placeId={place.id} className="-mt-0.5 -mr-1 h-8 w-8" iconClassName="h-[18px] w-[18px]" />}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
              <RatingPill rating={place.rating} count={place.ratingCount} />
              {price && <span className="tabular text-[13px] text-muted">{price}</span>}
            </div>

            <p className="truncate text-[13px] text-muted">
              {meta.label}
              {place.cuisine?.[0] ? ` · ${place.cuisine[0]}` : ""}
              {place.area ? ` · ${place.area}` : ""}
              {distance ? ` · ${distance}` : ""}
            </p>

            <div className="flex items-center gap-3">
              <OpenBadge place={place} />
              {visits > 0 && <span className="text-xs text-muted">✓ Been {visits > 1 ? `${visits}×` : "here"}</span>}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default memo(PlaceCard);

export function PlaceCardSkeleton() {
  return (
    <div className="card flex gap-3.5 p-2.5">
      <div className="skeleton h-[92px] w-[92px] shrink-0 rounded-xl" />
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

/** Photo-first card for horizontal rows. */
export function PlaceTile({ place, coords, caption }: { place: Place; coords?: Coords | null; caption?: string }) {
  const price = formatPriceForTwo(place);
  return (
    <Link to={`/place/${encodeURIComponent(place.id)}`} className="group block w-40 shrink-0">
      <div className="relative h-28 overflow-hidden rounded-xl">
        <PlacePhoto place={place} className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]" />
        <FavoriteButton placeId={place.id} onPhoto className="absolute top-1.5 right-1.5 h-7 w-7 bg-black/40 backdrop-blur-sm" iconClassName="h-3.5 w-3.5" />
      </div>
      <h3 className="mt-2 truncate text-sm font-semibold">{place.name}</h3>
      <div className="mt-0.5 flex items-center gap-2">
        <RatingPill rating={place.rating} />
        <span className="truncate text-xs text-muted">
          {caption ?? [place.area, coords ? formatDistance(haversineKm(coords, place)) : null, price ? price.replace(" for two", "") : null].filter(Boolean).join(" · ")}
        </span>
      </div>
    </Link>
  );
}
