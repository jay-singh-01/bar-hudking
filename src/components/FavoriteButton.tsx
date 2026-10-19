import { useState } from "react";
import { isFavorite, toggleFavorite, useUserData } from "../lib/store";
import { toast } from "../lib/toast";
import Icon from "./Icon";

interface FavoriteButtonProps {
  placeId: string;
  className?: string;
  iconClassName?: string;
  /** Sits on top of a photo: draw the outline in white so it stays visible. */
  onPhoto?: boolean;
}

export default function FavoriteButton({ placeId, className = "", iconClassName = "h-5 w-5", onPhoto }: FavoriteButtonProps) {
  const fav = useUserData((d) => isFavorite(d, placeId));
  const [burst, setBurst] = useState(0);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggleFavorite(placeId);
        if (added) setBurst(Date.now());
        if (navigator.vibrate) navigator.vibrate(10);
        toast(added ? "Saved to favorites" : "Removed from favorites", {
          label: "Undo",
          onClick: () => toggleFavorite(placeId),
        });
      }}
      aria-label={fav ? "Remove from favorites" : "Save to favorites"}
      aria-pressed={fav}
      className={`relative flex items-center justify-center rounded-full transition active:scale-90 ${className}`}
    >
      {burst > 0 && <span key={burst} className="heart-burst" onAnimationEnd={() => setBurst(0)} />}
      <Icon
        name="heart"
        filled={fav}
        className={`${iconClassName} ${fav ? "animate-pop text-brand-2" : onPhoto ? "text-white" : "text-faint"}`}
      />
    </button>
  );
}
