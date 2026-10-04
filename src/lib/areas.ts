// Bangalore localities used for the Area filter, nearest-area tagging in the
// data pipeline, and SearchApi query targeting. Coordinates are locality
// centers. `tier` controls how many SearchApi categories an area gets when
// enriching (core = nightlife/dining hubs).
export interface Area {
  name: string;
  lat: number;
  lng: number;
  tier: "core" | "outer";
}

export const AREAS: Area[] = [
  { name: "Indiranagar", lat: 12.9716, lng: 77.6412, tier: "core" },
  { name: "Koramangala", lat: 12.9352, lng: 77.6146, tier: "core" },
  { name: "MG Road/Brigade Road", lat: 12.9752, lng: 77.6065, tier: "core" },
  { name: "Church Street/Lavelle Road", lat: 12.9718, lng: 77.5985, tier: "core" },
  { name: "Cunningham Road/Vasanth Nagar", lat: 12.9861, lng: 77.5954, tier: "core" },
  { name: "Ulsoor", lat: 12.9817, lng: 77.6286, tier: "core" },
  { name: "HSR Layout", lat: 12.9121, lng: 77.6446, tier: "core" },
  { name: "Domlur/Old Airport Road", lat: 12.9611, lng: 77.6387, tier: "core" },
  { name: "Marathahalli", lat: 12.9591, lng: 77.6974, tier: "core" },
  { name: "Whitefield", lat: 12.9698, lng: 77.75, tier: "core" },
  { name: "Jayanagar", lat: 12.9293, lng: 77.5852, tier: "core" },
  { name: "J. P. Nagar", lat: 12.906, lng: 77.5836, tier: "core" },
  { name: "BTM Layout", lat: 12.9166, lng: 77.6101, tier: "core" },
  { name: "Electronic City", lat: 12.8452, lng: 77.6602, tier: "core" },
  { name: "Bellandur", lat: 12.9299, lng: 77.6834, tier: "core" },
  { name: "Malleshwaram", lat: 13.0077, lng: 77.5694, tier: "core" },
  { name: "Rajajinagar", lat: 12.9911, lng: 77.5554, tier: "core" },
  { name: "Kammanahalli/Banaswadi", lat: 13.0158, lng: 77.6394, tier: "core" },
  { name: "Sarjapur Road", lat: 12.901, lng: 77.687, tier: "core" },
  { name: "Hebbal/Manyata", lat: 13.0358, lng: 77.6105, tier: "core" },
  { name: "Frazer Town", lat: 12.9987, lng: 77.615, tier: "outer" },
  { name: "Richmond Town", lat: 12.9634, lng: 77.6, tier: "outer" },
  { name: "Sadashivanagar", lat: 13.0068, lng: 77.5813, tier: "outer" },
  { name: "Basavanagudi", lat: 12.9422, lng: 77.576, tier: "outer" },
  { name: "Banashankari", lat: 12.925, lng: 77.5567, tier: "outer" },
  { name: "Bannerghatta Road", lat: 12.8894, lng: 77.5972, tier: "outer" },
  { name: "KR Puram", lat: 13.0088, lng: 77.6958, tier: "outer" },
  { name: "Hennur/Kalyan Nagar", lat: 13.0334, lng: 77.6408, tier: "outer" },
  { name: "Vijayanagar", lat: 12.9719, lng: 77.5352, tier: "outer" },
  { name: "Basaveshwaranagar", lat: 12.9935, lng: 77.539, tier: "outer" },
  { name: "Yeshwanthpur", lat: 13.0284, lng: 77.554, tier: "outer" },
  { name: "Yelahanka", lat: 13.1007, lng: 77.5963, tier: "outer" },
  { name: "Rajarajeshwari Nagar", lat: 12.925, lng: 77.5121, tier: "outer" },
  { name: "Kanakapura Road", lat: 12.88, lng: 77.556, tier: "outer" },
  { name: "Majestic/Gandhinagar", lat: 12.977, lng: 77.572, tier: "outer" },
  { name: "Shivajinagar/Commercial Street", lat: 12.983, lng: 77.606, tier: "outer" },
  { name: "Sahakar Nagar", lat: 13.0623, lng: 77.5869, tier: "outer" },
  { name: "RT Nagar", lat: 13.021, lng: 77.596, tier: "outer" },
  { name: "Thanisandra", lat: 13.06, lng: 77.635, tier: "outer" },
  { name: "Horamavu", lat: 13.03, lng: 77.66, tier: "outer" },
  { name: "Brookefield", lat: 12.966, lng: 77.718, tier: "outer" },
  { name: "Bommanahalli/Hosur Road", lat: 12.903, lng: 77.625, tier: "outer" },
  { name: "Hulimavu/Begur", lat: 12.878, lng: 77.61, tier: "outer" },
  { name: "Uttarahalli", lat: 12.906, lng: 77.545, tier: "outer" },
  { name: "Kengeri", lat: 12.908, lng: 77.485, tier: "outer" },
  { name: "Nagarbhavi", lat: 12.96, lng: 77.51, tier: "outer" },
];

// Rough bounding box for Greater Bangalore: south, west, north, east.
export const BANGALORE_BBOX = [12.8, 77.4, 13.2, 77.85] as const;
export const BANGALORE_CENTER = { lat: 12.9716, lng: 77.5946 };
