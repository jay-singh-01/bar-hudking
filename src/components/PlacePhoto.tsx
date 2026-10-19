import { useState } from "react";
import type { Place } from "../lib/types";
import { TYPE_META } from "../lib/discover";
import { sizedPhoto } from "../lib/photo";

interface PlacePhotoProps {
  place: Place;
  className?: string;
  /** Text size for the initial shown when there's no photo. */
  emojiSize?: string;
  src?: string;
}

export default function PlacePhoto({ place, className = "", emojiSize = "text-3xl", src }: PlacePhotoProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Cards are ~96px wide; 320px covers 3x screens without pulling full-size images.
  const url = src ?? sizedPhoto(place.photo, 320, 240);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        className={`photo-fade bg-surface-2 object-cover ${loaded ? "is-loaded" : ""} ${className}`}
      />
    );
  }

  // No photo: the place's initial set in the display serif on a tinted ground.
  const color = TYPE_META[place.type].color;
  return (
    <div
      className={`flex items-center justify-center bg-surface-2 ${className}`}
      style={{ backgroundColor: `color-mix(in oklab, ${color} 16%, var(--color-surface-2))` }}
      aria-hidden="true"
    >
      <span className={`font-display font-semibold ${emojiSize}`} style={{ color }}>
        {place.name.replace(/^the\s+/i, "").charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
