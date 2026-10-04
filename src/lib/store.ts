import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// User data model. Lives on the device (localStorage) and optionally syncs to
// Supabase (see sync.ts). Every record carries `updatedAt` and is soft-deleted,
// so two devices' copies can be merged record-by-record (last write wins).
// ---------------------------------------------------------------------------

export interface Synced {
  updatedAt: number;
  deleted?: boolean;
}
export interface Favorite extends Synced {
  placeId: string;
}
export interface Visit extends Synced {
  id: string;
  placeId: string;
  /** YYYY-MM-DD */
  date: string;
  rating: number | null;
  costForTwo: number | null;
  note: string;
}
export interface Note extends Synced {
  placeId: string;
  text: string;
}
export interface PlaceList extends Synced {
  id: string;
  name: string;
  emoji: string;
  placeIds: string[];
  createdAt: number;
}
export interface Spot extends Synced {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusKm: number;
}
export interface Profile extends Synced {
  name: string;
}
export interface SuperSuggestAnchor {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radiusKm: number;
}
/** Custom Super Suggest points; absent means the app defaults. */
export interface SuperSuggestConfig extends Synced {
  anchors: SuperSuggestAnchor[];
}

export interface UserData {
  version: 1;
  favorites: Record<string, Favorite>;
  visits: Record<string, Visit>;
  notes: Record<string, Note>;
  lists: Record<string, PlaceList>;
  spots: Record<string, Spot>;
  profile: Profile;
  superSuggest?: SuperSuggestConfig;
}

const COLLECTIONS = ["favorites", "visits", "notes", "lists", "spots"] as const;
type CollectionKey = (typeof COLLECTIONS)[number];

export function emptyUserData(): UserData {
  return {
    version: 1,
    favorites: {},
    visits: {},
    notes: {},
    lists: {},
    spots: {},
    profile: { name: "", updatedAt: 0 },
  };
}

function newer<T extends Synced>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

/** Record-level last-write-wins merge. Commutative, so sync order doesn't matter. */
export function mergeUserData(a: UserData, b: UserData): UserData {
  const out = emptyUserData();
  for (const key of COLLECTIONS) {
    const merged: Record<string, Synced> = {};
    const ids = new Set([...Object.keys(a[key] ?? {}), ...Object.keys(b[key] ?? {})]);
    for (const id of ids) {
      merged[id] = newer(
        (a[key] as Record<string, Synced>)?.[id],
        (b[key] as Record<string, Synced>)?.[id],
      )!;
    }
    (out[key] as Record<string, Synced>) = merged;
  }
  out.profile = newer(a.profile, b.profile) ?? out.profile;
  const ss = newer(a.superSuggest, b.superSuggest);
  if (ss) out.superSuggest = ss;
  return out;
}

/** Defensive parse of anything (localStorage, backup file, remote row) into UserData. */
export function coerceUserData(raw: unknown): UserData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<UserData>;
  if (r.version !== 1) return null;
  const base = emptyUserData();
  for (const key of COLLECTIONS) {
    if (r[key] && typeof r[key] === "object") (base[key] as unknown) = r[key];
  }
  if (r.profile && typeof r.profile === "object") base.profile = r.profile;
  if (r.superSuggest && Array.isArray(r.superSuggest.anchors)) base.superSuggest = r.superSuggest;
  return base;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const STORAGE_KEY = "barhudking:user:v1";

function loadLocal(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return (raw && coerceUserData(JSON.parse(raw))) || emptyUserData();
  } catch {
    return emptyUserData();
  }
}

let state: UserData = loadLocal();
const listeners = new Set<() => void>();
const localChangeListeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode) — data still lives in memory for this session.
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function commit(next: UserData) {
  state = next;
  persist();
  emit();
  localChangeListeners.forEach((l) => l());
}

export function getUserData(): UserData {
  return state;
}

/** Replace state from a sync/import without re-triggering a sync push. */
export function replaceUserData(next: UserData) {
  state = next;
  persist();
  emit();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Fires only for changes the user made on this device (used to schedule sync pushes). */
export function onLocalChange(listener: () => void) {
  localChangeListeners.add(listener);
  return () => localChangeListeners.delete(listener);
}

// Keep tabs of the same app in sync with each other.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      state = loadLocal();
      emit();
    }
  });
}

export function useUserData<T>(selector: (d: UserData) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

// ---------------------------------------------------------------------------
// Selectors. Callers should memoize on the returned collection, which only
// changes identity when that collection changes.
// ---------------------------------------------------------------------------

export function live<T extends Synced>(rec: Record<string, T>): T[] {
  return Object.values(rec).filter((r) => !r.deleted);
}

export function isFavorite(d: UserData, placeId: string) {
  const f = d.favorites[placeId];
  return !!f && !f.deleted;
}

export function visitsFor(visits: Record<string, Visit>, placeId: string): Visit[] {
  return live(visits)
    .filter((v) => v.placeId === placeId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function setIn<K extends CollectionKey>(key: K, id: string, value: UserData[K][string]) {
  commit({ ...state, [key]: { ...state[key], [id]: value } });
}

export function toggleFavorite(placeId: string): boolean {
  const next = !isFavorite(state, placeId);
  setIn("favorites", placeId, { placeId, updatedAt: Date.now(), deleted: !next });
  return next;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function saveVisit(visit: Omit<Visit, "id" | "updatedAt"> & { id?: string }): string {
  const id = visit.id ?? uid();
  setIn("visits", id, { ...visit, id, updatedAt: Date.now() });
  return id;
}

export function deleteVisit(id: string) {
  const v = state.visits[id];
  if (v) setIn("visits", id, { ...v, deleted: true, updatedAt: Date.now() });
}

export function setNote(placeId: string, text: string) {
  setIn("notes", placeId, { placeId, text, updatedAt: Date.now(), deleted: !text.trim() });
}

export function createList(name: string, emoji: string, placeIds: string[] = []): string {
  const id = uid();
  const now = Date.now();
  setIn("lists", id, { id, name: name.trim() || "Untitled list", emoji, placeIds, createdAt: now, updatedAt: now });
  return id;
}

export function updateList(id: string, patch: Partial<Pick<PlaceList, "name" | "emoji" | "placeIds">>) {
  const l = state.lists[id];
  if (l) setIn("lists", id, { ...l, ...patch, updatedAt: Date.now() });
}

export function deleteList(id: string) {
  const l = state.lists[id];
  if (l) setIn("lists", id, { ...l, deleted: true, updatedAt: Date.now() });
}

export function toggleInList(listId: string, placeId: string) {
  const l = state.lists[listId];
  if (!l) return;
  const placeIds = l.placeIds.includes(placeId)
    ? l.placeIds.filter((p) => p !== placeId)
    : [placeId, ...l.placeIds];
  updateList(listId, { placeIds });
}

export function saveSpot(spot: Omit<Spot, "id" | "updatedAt"> & { id?: string }) {
  const id = spot.id ?? uid();
  setIn("spots", id, { ...spot, id, updatedAt: Date.now() });
}

export function deleteSpot(id: string) {
  const s = state.spots[id];
  if (s) setIn("spots", id, { ...s, deleted: true, updatedAt: Date.now() });
}

/** Pass null to go back to the default points. */
export function setSuperSuggestAnchors(anchors: SuperSuggestAnchor[] | null) {
  commit({ ...state, superSuggest: { anchors: anchors ?? [], updatedAt: Date.now() } });
}

export function setProfileName(name: string) {
  commit({ ...state, profile: { name, updatedAt: Date.now() } });
}

/** Merge a backup file or shared data into this device's data. */
export function importUserData(incoming: UserData) {
  commit(mergeUserData(state, incoming));
}

export function clearUserData() {
  replaceUserData(emptyUserData());
}
