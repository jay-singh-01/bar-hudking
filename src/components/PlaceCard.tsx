import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Place } from "../lib/types";
import { formatPriceForTwo, isHiddenGem, TYPE_META } from "../lib/discover";
import { formatDistance, haversineKm, type Coords } from "../lib/geo";
import { openStatus } from "../lib/hours";
import { useUserData } from "../lib/store";
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
    return <span className="text-xs font-semibold text-rose-400">Temporarily closed</span>;
  }
  const status = openStatus(place.hours, now);
  if (!status) return null;
  return (
    <span
      className={`text-xs font-medium ${
        status.open ? (status.closingSoon ? "text-amber-400" : "text-ok") : "text-rose-400"
      }`}
    >
      {status.open ? (status.closingSoon ? "Closing soon" : "Open") : "Closed"}
      <span className="font-normal text-muted"> · {status.label}</span>
    </span>
  );
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
  const meta = TYPE_META[place.type];
  const price = formatPriceForTwo(place);
  const distance = coords ? formatDistance(haversineKm(coords, place)) : null;
  const tags = (place.features ?? []).slice(0, 2);
  const gem = isHiddenGem(place);

  return (
    <Link
      to={`/place/${encodeURIComponent(place.id)}`}
      className="group lift flex animate-fade-up gap-3.5 rounded-3xl border border-line/70 bg-surface p-2.5 pr-3 transition active:scale-[0.99] active:bg-surface-2"
      style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}
    >
      <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl">
        <PlacePhoto place={place} className="h-full w-full" />
        <FavoriteButton
          placeId={place.id}
          className="absolute top-1.5 right-1.5 h-8 w-8 bg-black/45 backdrop-blur-sm"
          iconClassName="h-4 w-4"
        />
        {visits > 0 && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ok/90 px-1.5 py-0.5 text-[10px] font-bold text-black">
            ✓ {visits > 1 ? `${visits}×` : "Been"}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-2 flex-1 text-[15px] leading-snug font-bold">{place.name}</h3>
          {action}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <RatingPill rating={place.rating} count={place.ratingCount} />
          {price && <span className="text-muted">{price}</span>}
        </div>

        <p className="truncate text-[13px] text-muted">
          {meta.emoji} {meta.label}
          {place.cuisine?.[0] ? ` · ${place.cuisine[0]}` : ""}
          {place.area ? ` · ${place.area}` : ""}
          {distance ? ` · ${distance}` : ""}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <OpenBadge place={place} />
          {gem && (
            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">💎 Hidden gem</span>
          )}
          {!gem &&
            tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink/80">
                {t}
              </span>
            ))}
        </div>
      </div>
    </Link>
  );
}

export default memo(PlaceCard);

export function PlaceCardSkeleton() {
  return (
    <div className="flex gap-3.5 rounded-3xl border border-line/70 bg-surface p-2.5">
      <div className="skeleton h-[104px] w-[104px] shrink-0 rounded-2xl" />
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        <div className="skeleton h-4 w-3/4 rounded-full" />
        <div className="skeleton h-3 w-1/2 rounded-full" />
        <div className="skeleton h-3 w-2/3 rounded-full" />
      </div>
    </div>
  );
}

/** Larger photo-first card for horizontal carousels. */
export function PlaceTile({ place, coords }: { place: Place; coords?: Coords | null }) {
  const price = formatPriceForTwo(place);
  return (
    <Link
      to={`/place/${encodeURIComponent(place.id)}`}
      className="lift relative block w-44 shrink-0 overflow-hidden rounded-3xl border border-line/70 bg-surface transition active:scale-[0.98]"
    >
      <div className="relative h-32">
        <PlacePhoto place={place} className="h-full w-full" emojiSize="text-5xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
        <FavoriteButton
          placeId={place.id}
          className="absolute top-2 right-2 h-8 w-8 bg-black/45 backdrop-blur-sm"
          iconClassName="h-4 w-4"
        />
        <div className="absolute bottom-2 left-2">
          <RatingPill rating={place.rating} />
        </div>
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-bold">{place.name}</h3>
        <p className="truncate text-xs text-muted">
          {[place.area, coords ? formatDistance(haversineKm(coords, place)) : null, price ? price.replace(" for two", "") : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
