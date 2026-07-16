/**
 * One-time backfill: derives `area` for existing `places` rows by matching
 * their `address` against scripts/lib/matchArea.ts (curated Bangalore
 * areas first, falling back to whatever locality the address itself
 * names). Only touches rows where area is currently null — safe to re-run
 * (e.g. after tweaking matchArea's aliases) without clobbering anything
 * already set.
 *
 * Usage: npm run backfill-area
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — fall back to whatever is already in process.env
}

import { createClient } from "@supabase/supabase-js";
import { matchArea } from "./lib/matchArea";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from("places")
    .select("id, address")
    .is("area", null);

  if (error) throw error;
  if (!data || data.length === 0) {
    console.log("No rows with area=null. Nothing to do.");
    return;
  }

  console.log(`Checking ${data.length} rows with area=null...`);

  let matched = 0;
  for (const row of data) {
    const area = matchArea(row.address);
    if (!area) continue;

    const { error: updateError } = await supabase
      .from("places")
      .update({ area })
      .eq("id", row.id);

    if (updateError) {
      console.error(`  Failed to update ${row.id}: ${updateError.message}`);
      continue;
    }
    matched++;
  }

  console.log(`\nMatched and updated: ${matched}`);
  console.log(`Still unmatched (address missing or unparseable): ${data.length - matched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
