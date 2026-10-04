// Turns the various price signals Google/SearchApi expose into an
// approximate INR cost for two. Every value here comes from real data on the
// listing; the "for two" figure is derived (per-person x 2) and the app labels
// it as approximate.

function toNumber(s: string): number {
  return Number(s.replace(/[,\s]/g, ""));
}

/**
 * Google Maps shows Indian venues as a per-person range: "₹200–400",
 * "₹1,000–2,000", "₹2,000+". Returns cost for two.
 */
export function priceForTwoFromRange(raw: string | undefined): [number, number] | null {
  if (!raw) return null;
  const range = raw.match(/₹\s?([\d,]+)\s*[–—-]\s*₹?\s?([\d,]+)/);
  if (range) {
    const min = toNumber(range[1]);
    const max = toNumber(range[2]);
    if (min > 0 && max >= min) return [min * 2, max * 2];
  }
  const plus = raw.match(/₹\s?([\d,]+)\s*\+/);
  if (plus) {
    const min = toNumber(plus[1]);
    if (min > 0) return [min * 2, Math.round(min * 3)];
  }
  return null;
}

/** "₹₹" / "$$$" style price level, 1-4. */
export function priceLevelFromSymbols(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^([₹$])\1{0,3}$/);
  return m ? raw.trim().length : null;
}

/**
 * Review snippets sometimes state an explicit "for two" price ("around
 * ₹1,500 for two"). Only explicit for-two mentions are used.
 */
export function priceForTwoFromText(text: string | undefined): [number, number] | null {
  if (!text) return null;
  const forTwo = /for\s*(?:two|2)(?:\s*people)?/i;
  const WINDOW = 40;
  const near = (i: number, len: number) => forTwo.test(text.slice(Math.max(0, i - WINDOW), i + len + WINDOW));

  const range = text.match(/(?:₹|rs\.?|inr)\s?([\d,]+)\s*[-–—]\s*(?:₹|rs\.?)?\s?([\d,]+)/i);
  if (range && near(range.index!, range[0].length)) {
    const min = toNumber(range[1]);
    const max = toNumber(range[2]);
    if (min >= 100 && max >= min) return [min, max];
  }
  const single = text.match(/(?:₹|rs\.?|inr)\s?([\d,]+)/i);
  if (single && near(single.index!, single[0].length)) {
    const v = toNumber(single[1]);
    if (v >= 100) return [v, v];
  }
  return null;
}
