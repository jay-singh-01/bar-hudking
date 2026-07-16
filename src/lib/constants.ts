export const BANGALORE_AREAS = [
  "Indiranagar",
  "Koramangala",
  "Cunningham Road",
  "MG Road/Lavelle Road",
  "HSR Layout",
  "J. P. Nagar",
  "Jayanagar",
  "Whitefield",
  "Kammanahalli",
  "Halasuru",
  "Bellandur",
  "Electronic City",
  "Malleshwaram",
  "North Bangalore",
  "North East Bangalore",
  "South Bangalore",
  "South East Bangalore",
  "Hosur",
] as const;

export const PLACE_TYPES = [
  "restaurant",
  "bar",
  "pub",
  "cafe",
  "brewery",
  "nightclub",
] as const;

export const DISTANCE_OPTIONS_KM = [2, 5, 10, 15, 20, 25] as const;

// Locality-center coordinates, not a specific address. HSR Layout is the
// centroid of seeded places actually tagged area="HSR Layout"; Rajarajeshwari
// Nagar has no seeded places to average, so it's the general area center.
export const REFERENCE_POINTS = {
  rajarajeshwariNagar: { lat: 12.925, lng: 77.5121 },
  hsrLayout: { lat: 12.9157, lng: 77.6481 },
} as const;

export const SUPER_SUGGEST_RADII_KM = {
  fromUser: 10,
  fromRajarajeshwariNagar: 12,
  fromHsrLayout: 10,
} as const;
