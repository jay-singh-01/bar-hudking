import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import PlacePhoto from "../components/PlacePhoto";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import { RatingPill } from "../components/Rating";
import { usePlaces } from "../lib/places";
import { deletePlan, recordVote, useUserData } from "../lib/store";
import { parseVoteLink, planInviteUrl, shareLink } from "../lib/share";
import { formatPriceForTwo } from "../lib/discover";
import { toast } from "../lib/toast";
import type { Place } from "../lib/types";

/** The organiser's view of a plan: shortlist, live tally, share and collect votes. */
export default function PlanPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const plan = useUserData((d) => (d.plans[id] && !d.plans[id].deleted ? d.plans[id] : null));
  const myName = useUserData((d) => d.profile.name);
  const { index } = usePlaces();
  const [paste, setPaste] = useState("");

  const rows = useMemo(() => {
    if (!plan || !index) return [];
    const voters = Object.entries(plan.votes);
    return plan.placeIds
      .map((pid) => index.byId.get(pid))
      .filter((p): p is Place => !!p)
      .map((p) => ({ place: p, voters: voters.filter(([, v]) => v === p.id).map(([name]) => name) }))
      .sort((a, b) => b.voters.length - a.voters.length);
  }, [plan, index]);

  if (!plan) {
    return <EmptyState icon="vote" title="Plan not found" message="It may have been deleted." action={{ label: "Back to Saved", onClick: () => navigate("/saved?tab=plans") }} />;
  }

  const total = Object.keys(plan.votes).length;
  const top = rows[0]?.voters.length ?? 0;
  const me = myName || "Me";
  const myPick = plan.votes[me];

  function collect(text: string) {
    const q = text.trim().replace(/^.*?\?/, "?");
    const link = parseVoteLink(q);
    if (!link?.reply || link.id !== plan!.id) {
      toast("That doesn't look like a reply to this plan");
      return;
    }
    const ok = recordVote(plan!.id, link.reply.from, link.reply.placeId);
    toast(ok ? `${link.reply.from}'s vote counted` : "That vote isn't for a place on this plan");
    setPaste("");
  }

  return (
    <div className="pb-nav">
      <PageHeader
        title={plan.title}
        subtitle={total ? `${total} vote${total > 1 ? "s" : ""} so far` : "No votes yet"}
        back
        right={
          <button
            className="rounded-full p-2.5 text-muted active:bg-surface-2"
            aria-label="Delete plan"
            onClick={() => {
              if (!window.confirm(`Delete “${plan.title}”?`)) return;
              deletePlan(plan.id);
              navigate("/saved?tab=plans", { replace: true });
            }}
          >
            <Icon name="trash" className="h-5 w-5" />
          </button>
        }
      />

      <div className="px-4 pt-4">
        <button
          className="btn-primary w-full"
          onClick={() =>
            shareLink(plan.title, `${plan.title} — vote for where we go`, planInviteUrl({ id: plan.id, title: plan.title, placeIds: plan.placeIds, by: myName || undefined }))
          }
        >
          <Icon name="share" className="h-4 w-4" /> Send to friends
        </button>
        <p className="mt-2 text-center text-xs text-muted">Friends pick one and send you a link back. Open it here to count their vote.</p>

        <ul className="mt-6 flex flex-col gap-3">
          {rows.map(({ place, voters }) => {
            const share = total ? voters.length / total : 0;
            const leading = voters.length > 0 && voters.length === top;
            return (
              <li key={place.id} className={`card overflow-hidden ${leading ? "!border-brand/60" : ""}`}>
                <div className="flex gap-3 p-2.5">
                  <Link to={`/place/${encodeURIComponent(place.id)}`} className="shrink-0">
                    <PlacePhoto place={place} className="h-16 w-16 rounded-lg" emojiSize="text-xl" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/place/${encodeURIComponent(place.id)}`} className="truncate text-[15px] font-semibold">
                        {place.name}
                      </Link>
                      <span className="tabular shrink-0 text-sm font-semibold">{voters.length}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <RatingPill rating={place.rating} />
                      <span className="truncate text-xs text-muted">{[place.area, formatPriceForTwo(place)].filter(Boolean).join(" · ")}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{voters.length ? voters.join(", ") : "No votes yet"}</p>
                  </div>
                </div>
                <div className="h-1 bg-surface-2">
                  <div className="h-full bg-brand transition-all duration-700" style={{ width: `${share * 100}%` }} />
                </div>
                <button
                  className={`w-full border-t border-line py-2 text-[13px] font-medium ${myPick === place.id ? "text-brand" : "text-muted"}`}
                  onClick={() => recordVote(plan.id, me, place.id)}
                >
                  {myPick === place.id ? "Your pick" : "Vote for this"}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 border-t border-line pt-5">
          <p className="eyebrow mb-2">Got a reply link?</p>
          <div className="flex gap-2">
            <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste it here" className="input" />
            <button className="btn-ghost shrink-0" disabled={!paste.trim()} onClick={() => collect(paste)}>
              Count
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">Usually you can just tap the link your friend sends — this is for when it opens somewhere else.</p>
        </div>
      </div>
    </div>
  );
}
