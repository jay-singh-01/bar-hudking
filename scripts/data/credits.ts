/**
 * Free: prints the remaining SearchApi credits for the key in .env.local.
 *
 * Usage: npm run data:credits
 */
import "../lib/env";

const key = process.env.SEARCHAPI_KEY;
if (!key) throw new Error("Missing SEARCHAPI_KEY in .env.local");

const res = await fetch(`https://www.searchapi.io/api/v1/me?api_key=${key}`);
const json = (await res.json().catch(() => ({}))) as { account?: { remaining_credits?: number } };
console.log(`Remaining SearchApi credits: ${json.account?.remaining_credits ?? "unknown"}`);
