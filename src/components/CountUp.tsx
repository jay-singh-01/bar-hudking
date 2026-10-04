import { useEffect, useRef, useState } from "react";

/** Eases a number from its previous value (0 at first) to `value`. */
export default function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const origin = from.current;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const v = Math.round(origin + (value - origin) * (1 - Math.pow(1 - k, 3)));
      setN(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{n.toLocaleString("en-IN")}</>;
}
