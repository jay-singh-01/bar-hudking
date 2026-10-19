import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";

const KEY = "barhudking:theme";
const listeners = new Set<() => void>();
const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: light)") : null;

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

let pref: ThemePref = readPref();

export function resolvedTheme(p: ThemePref = pref): "light" | "dark" {
  if (p !== "system") return p;
  return media?.matches ? "light" : "dark";
}

/** Same logic as the inline script in index.html, which runs before first paint. */
function apply() {
  const t = resolvedTheme();
  const root = document.documentElement;
  root.classList.toggle("light", t === "light");
  root.classList.toggle("dark", t === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "light" ? "#f6f1e8" : "#100e0c");
}

export function initTheme() {
  apply();
  media?.addEventListener("change", () => {
    if (pref === "system") {
      apply();
      listeners.forEach((l) => l());
    }
  });
}

export function setThemePref(next: ThemePref) {
  pref = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  apply();
  listeners.forEach((l) => l());
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pref,
  );
}
