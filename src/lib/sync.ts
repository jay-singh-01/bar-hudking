import { useSyncExternalStore } from "react";
import { getSupabase, syncEnabled } from "./supabase";
import {
  clearUserData,
  coerceUserData,
  getUserData,
  mergeUserData,
  onLocalChange,
  replaceUserData,
} from "./store";

export type SyncPhase = "disabled" | "signed-out" | "syncing" | "synced" | "offline" | "error";

export interface SyncState {
  phase: SyncPhase;
  email: string | null;
  lastSyncedAt: number | null;
  error: string | null;
}

let syncState: SyncState = {
  phase: syncEnabled ? "signed-out" : "disabled",
  email: null,
  lastSyncedAt: null,
  error: null,
};
const listeners = new Set<() => void>();

function set(patch: Partial<SyncState>) {
  syncState = { ...syncState, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => syncState,
  );
}

let userId: string | null = null;
let running: Promise<void> | null = null;
let again = false;

/**
 * Pull the remote copy, merge it with this device's data, store the result
 * locally and push it back. Merging is record-level last-write-wins, so this
 * is safe to run any time, from any device, in any order.
 */
export function syncNow(): Promise<void> {
  const clientPromise = getSupabase();
  if (!clientPromise || !userId) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const supabase = await clientPromise;
    do {
      again = false;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        set({ phase: "offline" });
        return;
      }
      set({ phase: "syncing", error: null });
      try {
        const { data, error } = await supabase.from("user_data").select("data").eq("user_id", userId!).maybeSingle();
        if (error) throw error;
        const remote = coerceUserData(data?.data);
        const merged = remote ? mergeUserData(getUserData(), remote) : getUserData();
        replaceUserData(merged);
        const { error: pushError } = await supabase
          .from("user_data")
          .upsert({ user_id: userId!, data: merged, updated_at: new Date().toISOString() });
        if (pushError) throw pushError;
        set({ phase: "synced", lastSyncedAt: Date.now() });
      } catch (err) {
        set({ phase: "error", error: (err as Error).message ?? "Sync failed" });
        return;
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;

export async function initSync() {
  const clientPromise = getSupabase();
  if (!clientPromise) return;
  const supabase = await clientPromise;

  supabase.auth.getSession().then(({ data }) => {
    const user = data.session?.user;
    // Anonymous sessions from the old app version have no email — ignore them.
    if (user?.email) {
      userId = user.id;
      set({ email: user.email });
      syncNow();
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    if (user?.email) {
      const changed = user.id !== userId;
      userId = user.id;
      set({ email: user.email });
      if (changed) syncNow();
    } else {
      userId = null;
      set({ phase: "signed-out", email: null });
    }
  });

  onLocalChange(() => {
    if (!userId) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncNow, 1500);
  });

  window.addEventListener("online", () => syncNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncNow();
  });
}

async function requireClient() {
  const clientPromise = getSupabase();
  if (!clientPromise) throw new Error("Sync isn't configured");
  return clientPromise;
}

export async function sendSignInCode(email: string) {
  const supabase = await requireClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/me`, shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifySignInCode(email: string, token: string) {
  const supabase = await requireClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

export async function signOut(clearDevice: boolean) {
  const clientPromise = getSupabase();
  if (!clientPromise) return;
  await (await clientPromise).auth.signOut();
  if (clearDevice) clearUserData();
}

// ---------------------------------------------------------------------------
// Community stats: aggregate visits across everyone who syncs. Read-only RPC,
// works signed in or not.
// ---------------------------------------------------------------------------

export interface CommunityStat {
  visits: number;
  people: number;
  avgRating: number | null;
  avgCost: number | null;
}

let communityPromise: Promise<Map<string, CommunityStat>> | null = null;

export function loadCommunityStats(): Promise<Map<string, CommunityStat>> {
  const clientPromise = getSupabase();
  if (!clientPromise) return Promise.resolve(new Map());
  communityPromise ??= clientPromise
    .then((supabase) => supabase.rpc("community_stats"))
    .then(({ data, error }) => {
      if (error || !Array.isArray(data)) return new Map<string, CommunityStat>();
      return new Map(
        (data as { place_id: string; visits: number; people: number; avg_rating: number | null; avg_cost: number | null }[]).map(
          (r) => [r.place_id, { visits: r.visits, people: r.people, avgRating: r.avg_rating, avgCost: r.avg_cost }],
        ),
      );
    })
    // Offline or backend gone: no community section, never an error.
    .catch(() => new Map<string, CommunityStat>());
  return communityPromise;
}
