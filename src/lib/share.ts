import { toast } from "./toast";

/** Share via the native share sheet, falling back to the clipboard. */
export async function shareLink(title: string, text: string, url: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    window.prompt("Copy this link", url);
  }
}

// Lists are shared as a self-contained URL — no backend needed, the
// recipient's app resolves ids against its own bundled place data.

export interface SharedList {
  name: string;
  emoji: string;
  placeIds: string[];
  from?: string;
}

export function sharedListUrl(list: SharedList): string {
  const params = new URLSearchParams({ n: list.name, e: list.emoji, p: list.placeIds.join(",") });
  if (list.from) params.set("f", list.from);
  return `${window.location.origin}/shared?${params}`;
}

export function parseSharedList(search: string): SharedList | null {
  const params = new URLSearchParams(search);
  const ids = params.get("p")?.split(",").filter(Boolean) ?? [];
  if (!ids.length) return null;
  return {
    name: params.get("n") || "Shared list",
    emoji: params.get("e") || "📍",
    placeIds: ids.slice(0, 200),
    from: params.get("f") || undefined,
  };
}

export function placeUrl(placeId: string) {
  return `${window.location.origin}/place/${encodeURIComponent(placeId)}`;
}
