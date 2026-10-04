import type { Place } from "./types";
import { haversineKm } from "./geo";
import { getUserData, useUserData, type SuperSuggestAnchor } from "./store";

// Super Suggest: places that are within range of ALL of these points at once
// — the sweet spot between office, home and friends. Each person can move the
// points or change the radius on the Me tab; these are the starting values.
export const DEFAULT_ANCHORS: SuperSuggestAnchor[] = [
  { id: "bosch", label: "Bosch, Adugodi", lat: 12.944, lng: 77.606, radiusKm: 10 },
  // Bhoomika Layout isn't on OpenStreetMap; this is RR Nagar's centre until
  // someone sets the exact spot with "Use my location".
  { id: "home", label: "Bhoomika Layout, RR Nagar", lat: 12.9274, lng: 77.5155, radiusKm: 10 },
  { id: "hsr", label: "HSR Layout", lat: 12.9121, lng: 77.6446, radiusKm: 10 },
];

export function anchorsOf(d = getUserData()): SuperSuggestAnchor[] {
  return d.superSuggest?.anchors?.length ? d.superSuggest.anchors : DEFAULT_ANCHORS;
}

export function useAnchors(): SuperSuggestAnchor[] {
  const custom = useUserData((d) => d.superSuggest?.anchors);
  return custom?.length ? custom : DEFAULT_ANCHORS;
}

export function inSuperSuggest(p: Place, anchors: SuperSuggestAnchor[]): boolean {
  return anchors.every((a) => haversineKm(a, p) <= a.radiusKm);
}

export function describeAnchors(anchors: SuperSuggestAnchor[]): string {
  const names = anchors.map((a) => a.label.split(",")[0]);
  const sameRadius = anchors.every((a) => a.radiusKm === anchors[0].radiusKm);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0];
  return sameRadius ? `Within ${anchors[0].radiusKm} km of ${list}` : `In range of ${list}`;
}
