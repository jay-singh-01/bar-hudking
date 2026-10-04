/**
 * Free, no-key base dataset: every named bar / pub / restaurant / cafe /
 * brewery / nightclub in Greater Bangalore from OpenStreetMap (Overpass API).
 * Writes data/raw/osm.json; run `npm run data:build` afterwards.
 *
 * Usage: npm run data:osm
 */
import "../lib/env";
import { mkdirSync, writeFileSync } from "node:fs";
import { USER_AGENT } from "../lib/env";
import { BANGALORE_BBOX } from "../../src/lib/areas";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const bbox = BANGALORE_BBOX.join(",");
const query = `
[out:json][timeout:180];
(
  nwr["amenity"~"^(bar|pub|restaurant|cafe|biergarten|nightclub)$"]["name"](${bbox});
  nwr["craft"="brewery"]["name"](${bbox});
  nwr["microbrewery"="yes"]["name"](${bbox});
);
out center tags;
`;

async function main() {
  for (const endpoint of ENDPOINTS) {
    console.log(`Querying ${endpoint} ...`);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { elements: unknown[] };
      mkdirSync("data/raw", { recursive: true });
      writeFileSync("data/raw/osm.json", JSON.stringify(json));
      console.log(`Saved ${json.elements.length} OSM elements to data/raw/osm.json`);
      return;
    } catch (err) {
      console.error(`  Failed: ${(err as Error).message}`);
    }
  }
  process.exitCode = 1;
}

main();
