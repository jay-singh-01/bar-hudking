import { BANGALORE_AREAS } from "../../src/lib/constants";

// Bangalore localities that commonly appear in addresses under a different
// name than the one we display in the filter UI.
const ALIASES: Record<string, string[]> = {
  Halasuru: ["Halasuru", "Ulsoor"],
  "HSR Layout": ["HSR Layout", "HSR"],
  "J. P. Nagar": ["J. P. Nagar", "J.P. Nagar", "JP Nagar", "J P Nagar"],
  "MG Road/Lavelle Road": ["MG Road", "M.G. Road", "Mahatma Gandhi Road", "Lavelle Road"],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\broad\b/g, "rd")
    .replace(/\s+/g, " ")
    .trim();
}

function matchCuratedArea(address: string): string | null {
  const normalizedAddress = normalize(address);
  for (const area of BANGALORE_AREAS) {
    const candidates = ALIASES[area] ?? [area];
    for (const candidate of candidates) {
      if (normalizedAddress.includes(normalize(candidate))) {
        return area;
      }
    }
  }
  return null;
}

// Segments that show up right before the city name in Google/SearchApi
// addresses but aren't actually a locality — floor/unit numbers, lobby
// descriptors, landmark references ("opposite X").
function isPlausibleLocality(segment: string): boolean {
  if (/^\d+[a-z]*$/i.test(segment)) return false; // pure door/unit number
  if (/\b(floor|level|lobby)\b/i.test(segment)) return false;
  if (/^(opposite|behind|near|beside)\b/i.test(segment)) return false;
  if (segment.length < 3) return false;
  return true;
}

/**
 * Google/SearchApi addresses are formatted "<street details>, <locality>,
 * Bengaluru, Karnataka <pincode>, India" — the segment immediately before
 * the city name is usually the locality, even when it's not one of our
 * curated areas (e.g. "Ashok Nagar", "Marathahalli"). When that segment is
 * noise (a floor/unit number, "opposite X") walk backward for the nearest
 * plausible one instead of returning garbage.
 */
function extractFallbackLocality(address: string): string | null {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  // Match the city as its own segment, not merely containing the word —
  // venue names like "JW Marriott Bengaluru" would otherwise anchor here
  // instead of the real "Bengaluru" segment further along. Last exact
  // match wins, since the standalone city segment always comes last.
  let anchorIdx = parts.findLastIndex((p) => /^(bengaluru|bangalore)$/i.test(p));
  if (anchorIdx <= 0) {
    // A few addresses omit the city entirely (plus-code style) — anchor
    // on "Karnataka <pincode>" instead.
    anchorIdx = parts.findLastIndex((p) => /^karnataka\b/i.test(p));
  }
  if (anchorIdx <= 0) return null;

  for (let i = anchorIdx - 1; i >= 0; i--) {
    if (isPlausibleLocality(parts[i])) return parts[i];
  }
  return null;
}

/**
 * Matches a place's address to an area for the Location filter. Curated
 * BANGALORE_AREAS entries take priority (and their aliases collapse
 * variant spellings, e.g. "Ulsoor" -> "Halasuru"); anything else falls
 * back to whatever locality the address itself names, so no place is left
 * without a filterable area just because it's outside the curated list.
 */
export function matchArea(address: string | null): string | null {
  if (!address) return null;
  return matchCuratedArea(address) ?? extractFallbackLocality(address);
}
