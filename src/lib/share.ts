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

// ---------------------------------------------------------------------------
// Group plans. The organiser shares a link with the shortlist; each friend
// opens it, picks one and sends back a reply link. Opening the reply on the
// organiser's phone records the vote — no backend involved.
// ---------------------------------------------------------------------------

export interface PlanInvite {
  id: string;
  title: string;
  placeIds: string[];
  by?: string;
}

export function planInviteUrl(p: PlanInvite): string {
  const params = new URLSearchParams({ id: p.id, t: p.title, p: p.placeIds.join(",") });
  if (p.by) params.set("by", p.by);
  return `${window.location.origin}/vote?${params}`;
}

export function voteReplyUrl(planId: string, title: string, placeId: string, from: string): string {
  const params = new URLSearchParams({ id: planId, t: title, r: placeId, from });
  return `${window.location.origin}/vote?${params}`;
}

export interface VoteLink {
  id: string;
  title: string;
  placeIds: string[];
  by?: string;
  /** Present on a friend's reply: the place they picked and their name. */
  reply?: { placeId: string; from: string };
}

export function parseVoteLink(search: string): VoteLink | null {
  const q = new URLSearchParams(search);
  const id = q.get("id");
  if (!id) return null;
  const r = q.get("r");
  return {
    id,
    title: q.get("t") || "Where should we go?",
    placeIds: (q.get("p") ?? "").split(",").filter(Boolean).slice(0, 8),
    by: q.get("by") || undefined,
    reply: r ? { placeId: r, from: q.get("from") || "A friend" } : undefined,
  };
}
