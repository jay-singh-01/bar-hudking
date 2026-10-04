import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Place } from "../lib/types";
import type { Coords } from "../lib/geo";
import PlaceCard, { PlaceCardSkeleton } from "./PlaceCard";

const PAGE = 24;

// Survives navigating to a place and back, so the list doesn't jump to the top.
const memory = new Map<string, { count: number; scrollY: number }>();

interface PlaceListProps {
  places: Place[];
  coords?: Coords | null;
  /** Identifies this list for scroll restoration; change it to reset (e.g. on new filters). */
  memoryKey: string;
  renderAction?: (place: Place) => ReactNode;
}

export default function PlaceList({ places, coords, memoryKey, renderAction }: PlaceListProps) {
  const remembered = memory.get(memoryKey);
  const [count, setCount] = useState(remembered?.count ?? PAGE);
  const observer = useRef<IntersectionObserver | null>(null);
  const keyRef = useRef(memoryKey);
  const countRef = useRef(count);
  countRef.current = count;

  // New filters/search: start from the top again.
  useEffect(() => {
    if (keyRef.current !== memoryKey) {
      keyRef.current = memoryKey;
      setCount(memory.get(memoryKey)?.count ?? PAGE);
    }
  }, [memoryKey]);

  useLayoutEffect(() => {
    const saved = memory.get(memoryKey);
    if (saved) window.scrollTo(0, saved.scrollY);
    return () => {
      memory.set(memoryKey, { count: countRef.current, scrollY: window.scrollY });
    };
    // Restore once per key; count is tracked through a ref.
  }, [memoryKey]);

  const sentinel = useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      if (!node) return;
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) setCount((c) => Math.min(c + PAGE, places.length));
        },
        { rootMargin: "800px" },
      );
      observer.current.observe(node);
    },
    [places.length],
  );

  const visible = places.slice(0, count);

  return (
    <div className="flex flex-col gap-3">
      {visible.map((p, i) => (
        <PlaceCard key={p.id} place={p} coords={coords} index={i % PAGE} action={renderAction?.(p)} />
      ))}
      {count < places.length && (
        // Keyed by count so the observer re-attaches and fires again if still in view.
        <div key={count} ref={sentinel} className="flex flex-col gap-3">
          <PlaceCardSkeleton />
        </div>
      )}
    </div>
  );
}
