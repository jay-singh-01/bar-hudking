import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Optional. The app is fully usable without a backend — Supabase only adds
 * accounts (cross-device sync) and community stats. The client library is
 * loaded lazily so people using a copy without sync don't download it, and a
 * missing or dead backend can never take the app down.
 */
export const syncEnabled = !!(url && anonKey);

let client: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> | null {
  if (!syncEnabled) return null;
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return client;
}
