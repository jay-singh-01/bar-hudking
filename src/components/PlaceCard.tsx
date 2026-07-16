import { useState } from "react";
import type { Place } from "../lib/types";
import { useUserPlaces } from "../lib/UserPlacesProvider";
import { googleMapsUrl } from "../lib/maps";
import VisitedPrompt from "./VisitedPrompt";

function formatPrice(min: number | null, max: number | null) {
  if (min !== null && max !== null) return `₹${min}–${max} for two`;
  if (min !== null) return `₹${min}+ for two`;
  return null;
}

function formatType(type: string | null) {
  if (!type) return null;
  return type[0].toUpperCase() + type.slice(1);
}

interface PlaceCardProps {
  place: Place;
  distanceKm?: number | null;
}

export default function PlaceCard({ place, distanceKm }: PlaceCardProps) {
  const price = formatPrice(place.price_min, place.price_max);
  const { favoriteIds, visited, toggleFavorite, markVisited, unmarkVisited } = useUserPlaces();
  const [showVisitedPrompt, setShowVisitedPrompt] = useState(false);

  const isFavorite = favoriteIds.has(place.id);
  const visitInfo = visited.get(place.id);
  const isVisited = visitInfo !== undefined;

  async function handleToggleVisited() {
    if (isVisited) {
      unmarkVisited(place.id);
    } else {
      await markVisited(place.id);
      setShowVisitedPrompt(true);
    }
  }

  function openInGoogleMaps() {
    window.open(googleMapsUrl(place), "_blank", "noopener,noreferrer");
  }

  return (
    <div
      onClick={openInGoogleMaps}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openInGoogleMaps();
        }
      }}
      className="flex cursor-pointer flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4"
    >
      <div className="flex items-start gap-3">
        {place.image_url && (
          <img
            src={place.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        )}

        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-100">
              {place.name}
            </h3>
            <p className="truncate text-sm text-slate-400">
              {[place.area, formatType(place.place_type)].filter(Boolean).join(" · ")}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(place.id);
              }}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className={isFavorite ? "text-red-500" : "text-slate-600"}
            >
              <svg
                viewBox="0 0 24 24"
                fill={isFavorite ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21s-6.716-4.35-9.428-8.06C.68 10.31 1.2 6.6 4.2 5.06c2.4-1.23 5.1-.3 6.3 1.86 1.2-2.16 3.9-3.09 6.3-1.86 3 1.54 3.52 5.25 1.63 7.88C18.716 16.65 12 21 12 21z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleVisited();
              }}
              aria-label={isVisited ? "Unmark as visited" : "Mark as visited"}
              className={isVisited ? "text-emerald-400" : "text-slate-600"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {place.rating !== null && (
          <span className="flex items-center gap-1 text-amber-400">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.8L10 14.9l-5.21 2.62 1-5.8-4.21-4.1 5.82-.85L10 1.5z" />
            </svg>
            <span className="text-slate-200">{place.rating}</span>
            {place.review_count !== null && (
              <span className="text-slate-500">({place.review_count})</span>
            )}
          </span>
        )}
        {price && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
            {price}
          </span>
        )}
        {distanceKm != null && (
          <span className="text-slate-500">{distanceKm.toFixed(1)} km away</span>
        )}
      </div>

      {visitInfo && (visitInfo.rating !== null || visitInfo.costForTwo !== null) && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {visitInfo.rating !== null && <span>Your rating: {visitInfo.rating}★</span>}
          {visitInfo.costForTwo !== null && <span>₹{visitInfo.costForTwo} for two</span>}
        </div>
      )}

      {showVisitedPrompt && (
        <div onClick={(e) => e.stopPropagation()}>
          <VisitedPrompt placeId={place.id} onClose={() => setShowVisitedPrompt(false)} />
        </div>
      )}
    </div>
  );
}
