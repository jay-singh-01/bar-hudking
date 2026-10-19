import { useEffect, useMemo, useState } from "react";
import { Link, useLocation as useRouterLocation, useNavigate } from "react-router-dom";
import PlacePhoto from "../components/PlacePhoto";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import Logo from "../components/Logo";
import { RatingPill } from "../components/Rating";
import { usePlaces } from "../lib/places";
import { getUserData, recordVote, setProfileName, useUserData } from "../lib/store";
import { parseVoteLink, shareLink, voteReplyUrl } from "../lib/share";
import { formatPriceForTwo, TYPE_META } from "../lib/discover";
import { toast } from "../lib/toast";
import type { Place } from "../lib/types";

/**
 * Opened from a plan link. Two cases:
 *  - an invite (friend's view): pick a place, send a reply link back;
 *  - a reply (organiser's view): count the vote and jump to the plan.
 */
export default function VotePage() {
  const { search } = useRouterLocation();
  const navigate = useNavigate();
  const link = useMemo(() => parseVoteLink(search), [search]);
  const { index } = usePlaces();
  const myName = useUserData((d) => d.profile.name);
  const [name, setName] = useState(myName);
  const [pick, setPick] = useState<string | null>(null);

  // A reply landing on the organiser's phone: record it and show the tally.
  const isMine = link ? !!getUserData().plans[link.id] && !getUserData().plans[link.id].deleted : false;
  useEffect(() => {
    if (!link?.reply || !isMine) return;
    const ok = recordVote(link.id, link.reply.from, link.reply.placeId);
    toast(ok ? `${link.reply.from}'s vote counted` : "That vote isn't for a place on this plan");
    navigate(`/plans/${link.id}`, { replace: true });
  }, [link, isMine, navigate]);

  const places = useMemo(
    () => (link && index ? link.placeIds.map((id) => index.byId.get(id)).filter((p): p is Place => !!p) : []),
    [link, index],
  );

  if (!link) {
    return <EmptyState icon="vote" title="Broken link" message="This plan link is missing something." action={{ label: "Go to Discover", onClick: () => navigate("/") }} />;
  }

  if (link.reply && !isMine) {
    const place = index?.byId.get(link.reply.placeId);
    return (
      <EmptyState
        icon="vote"
        title={`${link.reply.from} picked ${place?.name ?? "a place"}`}
        message="This reply needs to be opened on the phone of whoever made the plan, so their app can count it."
        action={{ label: "Go to Discover", onClick: () => navigate("/") }}
      />
    );
  }
  if (link.reply) return null;

  return (
    <div className="pb-nav">
      <header className="border-b border-line px-4 pt-6 pb-5" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
        <Link to="/" className="mb-5 flex items-center gap-2">
          <Logo className="h-6 w-6" />
          <span className="font-display text-lg font-semibold">BarHudking</span>
        </Link>
        <p className="eyebrow">{link.by ? `${link.by} is asking` : "You're invited to vote"}</p>
        <h1 className="font-display mt-1 text-[30px] leading-tight font-semibold">{link.title}</h1>
        <p className="mt-1 text-sm text-muted">Pick the one you'd like most.</p>
      </header>

      <div className="px-4 pt-4">
        <ul className="flex flex-col gap-3">
          {places.map((p) => {
            const on = pick === p.id;
            return (
              <li key={p.id}>
                <button
                  onClick={() => setPick(p.id)}
                  className={`card flex w-full gap-3 p-2.5 text-left transition ${on ? "!border-ink ring-1 ring-ink" : ""}`}
                >
                  <PlacePhoto place={p} className="h-20 w-20 shrink-0 rounded-lg" emojiSize="text-2xl" />
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <RatingPill rating={p.rating} count={p.ratingCount} />
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {[TYPE_META[p.type].label, p.area, formatPriceForTwo(p)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${on ? "border-ink bg-ink text-bg" : "border-line"}`}>
                    {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {index && places.length === 0 && <p className="py-8 text-center text-sm text-muted">These places aren't in your version of the app yet.</p>}

        <div className="mt-6 flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="input" maxLength={30} />
          <button
            className="btn-primary w-full"
            disabled={!pick || !name.trim()}
            onClick={() => {
              if (!pick) return;
              if (name.trim() !== myName) setProfileName(name.trim());
              const placeName = places.find((p) => p.id === pick)?.name ?? "my pick";
              shareLink(link.title, `I vote for ${placeName}`, voteReplyUrl(link.id, link.title, pick, name.trim()));
            }}
          >
            <Icon name="share" className="h-4 w-4" /> Send my vote{link.by ? ` to ${link.by}` : ""}
          </button>
          <p className="text-center text-xs text-muted">Sends a link back — when they open it, your vote is counted.</p>
        </div>
      </div>
    </div>
  );
}
