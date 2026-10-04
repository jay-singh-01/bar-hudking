import Icon from "./Icon";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(n: number) {
  return n < 1000 ? String(n) : compact.format(n);
}

export function RatingPill({ rating, count, className = "" }: { rating?: number; count?: number; className?: string }) {
  if (rating === undefined) return null;
  const tone = rating >= 4.5 ? "bg-emerald-500" : rating >= 4.0 ? "bg-emerald-600/90" : rating >= 3.5 ? "bg-amber-600" : "bg-zinc-600";
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold text-white ${tone}`}>
        {rating.toFixed(1)}
        <Icon name="star" filled className="h-3 w-3" />
      </span>
      {count !== undefined && <span className="text-xs text-muted">({formatCount(count)})</span>}
    </span>
  );
}

export function StarInput({ value, onChange, size = "h-9 w-9" }: { value: number | null; onChange: (v: number | null) => void; size?: string }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= (value ?? 0);
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(value === n ? null : n)}
            className={`transition-transform active:scale-90 ${on ? "text-star" : "text-surface-3"}`}
          >
            <Icon name="star" filled className={`${size} ${on ? "animate-pop" : ""}`} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}

export function MiniStars({ value }: { value: number }) {
  return (
    <span className="inline-flex text-star" aria-label={`${value} stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" filled={n <= value} className={`h-3.5 w-3.5 ${n <= value ? "" : "text-surface-3"}`} />
      ))}
    </span>
  );
}
