import { useState } from "react";
import type { Place } from "../lib/types";
import { TYPE_META } from "../lib/discover";
import { sizedPhoto } from "../lib/photo";

// Deterministic per-place gradient so photo-less places still look distinct.
function hue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

interface PlacePhotoProps {
  place: Place;
  className?: string;
  emojiSize?: string;
  src?: string;
}

export default function PlacePhoto({ place, className = "", emojiSize = "text-4xl", src }: PlacePhotoProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Cards are ~104px wide; 320px covers 3x screens without pulling full-size images.
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
        className={`photo-fade object-cover ${loaded ? "is-loaded" : ""} ${className}`}
      />
    );
  }

  const h = hue(place.id);
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{
        background: `radial-gradient(circle at 25% 20%, hsl(${h} 70% 38%), hsl(${(h + 40) % 360} 60% 16%) 70%)`,
      }}
      aria-hidden="true"
    >
      <span className={`${emojiSize} drop-shadow-lg`}>{TYPE_META[place.type].emoji}</span>
    </div>
  );
}
