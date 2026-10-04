import { useEffect, useState } from "react";

/** useState that survives reloads (localStorage) or tab navigation (sessionStorage). Fails soft. */
export function usePersisted<T>(key: string, initial: T, storage: "local" | "session" = "session") {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = (storage === "local" ? localStorage : sessionStorage).getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      // Objects merge over the default so newly added fields get their defaults.
      return isPlainObject(initial) && isPlainObject(parsed) ? { ...initial, ...parsed } : parsed;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      (storage === "local" ? localStorage : sessionStorage).setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value, storage]);

  return [value, setValue] as const;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
