import { startTransition, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

const SPARKS = 10;

interface Burst {
  id: number;
  rect: DOMRect;
}

interface SuperSuggestChipProps {
  active: boolean;
  onToggle: (next: boolean) => void;
  className?: string;
}

/**
 * The Super Suggest toggle. Turning it on sets off a small celebration —
 * sparkles fanning out, a light sweep across the chip and a soft glow pulse.
 * The effect is portaled to <body> at the chip's position because the chip
 * row scrolls horizontally, which would clip anything drawn outside it.
 */
export default function SuperSuggestChip({ active, onToggle, className = "" }: SuperSuggestChipProps) {
  const [burst, setBurst] = useState<Burst | null>(null);

  return (
    <button
      className={`chip super-chip ${active ? "is-on" : ""} ${className}`}
      onClick={(e) => {
        const next = !active;
        if (next) {
          setBurst({ id: Date.now(), rect: e.currentTarget.getBoundingClientRect() });
          if (navigator.vibrate) navigator.vibrate([12, 40, 18]);
        }
        // The burst renders right away; refiltering thousands of places is a
        // transition so it never delays the start of the animation.
        startTransition(() => onToggle(next));
      }}
      aria-pressed={active}
    >
      <Icon key={burst?.id ?? 0} name="sparkles" className={`h-4 w-4 ${burst ? "ss-spin" : ""}`} filled={active} />
      Super Suggest
      {burst &&
        createPortal(
          <span
            key={burst.id}
            className="ss-fx"
            aria-hidden="true"
            style={{ position: "fixed", left: burst.rect.left, top: burst.rect.top, width: burst.rect.width, height: burst.rect.height, zIndex: 70 }}
            onAnimationEnd={(e) => e.target === e.currentTarget && setBurst(null)}
          >
            <span className="ss-sweep" />
            <span className="ss-glow" />
            {Array.from({ length: SPARKS }, (_, i) => (
              <span
                key={i}
                className="ss-spark"
                style={
                  {
                    "--a": `${(360 / SPARKS) * i + (i % 2 ? 12 : -6)}deg`,
                    "--d": `${34 + (i % 3) * 12}px`,
                    "--delay": `${(i % 4) * 30}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </span>,
          document.body,
        )}
    </button>
  );
}
