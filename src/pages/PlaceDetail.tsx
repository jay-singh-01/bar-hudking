import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon, { type IconName } from "../components/Icon";
import PlacePhoto from "../components/PlacePhoto";
import FavoriteButton from "../components/FavoriteButton";
import { MiniStars, RatingPill, formatCount } from "../components/Rating";
import { OpenBadge, PlaceTile } from "../components/PlaceCard";
import VisitSheet from "../components/VisitSheet";
import AddToListSheet from "../components/AddToListSheet";
import MiniMap from "../components/MiniMap";
import EmptyState from "../components/EmptyState";
import { usePlaces } from "../lib/places";
import type { Place } from "../lib/types";
import { formatINR, formatPriceForTwo, isComplete, isHiddenGem, sortPlaces, TYPE_META } from "../lib/discover";
import { describeDay, todayIndex, WEEKDAY_LABELS } from "../lib/hours";
import { formatDistance, haversineKm } from "../lib/geo";
import { directionsUrl, googleMapsUrl, googleReviewsUrl, uberUrl } from "../lib/maps";
import { placeUrl, shareLink } from "../lib/share";
import { live, setNote, useUserData, visitsFor, type Visit } from "../lib/store";
import { useFilterContext } from "../lib/useFilterContext";
import { sizedPhoto } from "../lib/photo";
import { loadCommunityStats, type CommunityStat } from "../lib/sync";

function Action({ icon, label, href, onClick }: { icon: IconName; label: string; href?: string; onClick?: () => void }) {
  const cls = "flex flex-col items-center gap-1.5 text-xs font-medium text-ink/90 active:scale-95 transition";
  const inner = (
    <>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-brand">
        <Icon name={icon} />
      </span>
      {label}
    </>
  );
  return href ? (
    <a href={href} target={href.startsWith("tel:") ? undefined : "_blank"} rel="noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line/70 bg-surface p-4">
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Header photo with a slow settle-in zoom and gentle scroll parallax. Small
 * thumbnails (from Google's local results) would look blurry stretched, so
 * they sit as a sharp tile over a soft, blurred copy of themselves.
 */
function HeroPhoto({ place }: { place: Place }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (ref.current) ref.current.style.transform = `translateY(${Math.min(window.scrollY, 400) * 0.35}px)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const lowRes = place.photo?.startsWith("/photos/");
  return (
    <div ref={ref} className="absolute inset-0 will-change-transform">
      {lowRes ? (
        <>
          <img src={place.photo} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl" />
          <div className="absolute inset-0 flex items-center justify-center pb-14">
            <img
              src={place.photo}
              alt=""
              className="h-36 w-36 animate-fade-up rounded-3xl object-cover shadow-2xl ring-1 ring-white/20"
            />
          </div>
        </>
      ) : (
        <div className="h-full w-full animate-ken-burns">
          <PlacePhoto place={place} src={sizedPhoto(place.photo, 900, 640)} className="h-full w-full" emojiSize="text-8xl" />
        </div>
      )}
    </div>
  );
}

function formatVisitDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function NoteEditor({ placeId }: { placeId: string }) {
  const saved = useUserData((d) => (d.notes[placeId]?.deleted ? "" : (d.notes[placeId]?.text ?? "")));
  const [text, setText] = useState(saved);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div>
      <textarea
        value={text}
        rows={text ? 3 : 2}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          setStatus("idle");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            setNote(placeId, v);
            setStatus("saved");
          }, 600);
        }}
        placeholder="Private notes — what to order, best table, who recommended it…"
        className="input resize-none text-sm"
      />
      <p className="mt-1 h-4 text-right text-[11px] text-muted">{status === "saved" ? "Saved ✓" : ""}</p>
    </div>
  );
}

export default function PlaceDetail() {
  const { id = "" } = useParams();
  const placeId = decodeURIComponent(id);
  const navigate = useNavigate();
  const { index, error } = usePlaces();
  const ctx = useFilterContext();
  const place = index?.byId.get(placeId);

  const visitsRec = useUserData((d) => d.visits);
  const visits = useMemo(() => visitsFor(visitsRec, placeId), [visitsRec, placeId]);
  const listsRec = useUserData((d) => d.lists);
  const inLists = useMemo(() => live(listsRec).filter((l) => l.placeIds.includes(placeId)), [listsRec, placeId]);

  const [sheet, setSheet] = useState<{ kind: "visit"; visit?: Visit } | { kind: "list" } | null>(null);
  const [community, setCommunity] = useState<CommunityStat | null>(null);
  const [showAllHours, setShowAllHours] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [placeId]);

  useEffect(() => {
    if (!place) return;
    let alive = true;
    loadCommunityStats().then((m) => alive && setCommunity(m.get(place.id) ?? null));
    return () => {
      alive = false;
    };
  }, [place]);

  const nearby = useMemo(() => {
    if (!index || !place) return [];
    const close = index.places.filter((p) => p.id !== place.id && isComplete(p) && haversineKm(place, p) <= 1.5);
    const sameType = close.filter((p) => p.type === place.type);
    return sortPlaces(sameType.length >= 4 ? sameType : close, "recommended", { ...ctx, coords: place }, "").slice(0, 10);
  }, [index, place, ctx]);

  if (error) return <EmptyState emoji="📡" title="Couldn't load places" message={error} />;
  if (!index) return <div className="skeleton h-72 w-full" />;
  if (!place) {
    return (
      <EmptyState
        emoji="🫥"
        title="Place not found"
        message="This place isn't in the current data set — it may have closed or been merged."
        action={{ label: "Back to Discover", onClick: () => navigate("/") }}
      />
    );
  }

  const meta = TYPE_META[place.type];
  const rating = place.rating;
  const ratingCount = place.ratingCount;
  const price = formatPriceForTwo(place);
  const distance = ctx.coords ? haversineKm(ctx.coords, place) : null;
  const myRatings = visits.filter((v) => v.rating !== null);
  const myAvg = myRatings.length ? myRatings.reduce((s, v) => s + v.rating!, 0) / myRatings.length : null;
  const today = todayIndex(ctx.now);

  return (
    <div className="pb-nav">
      {/* Hero */}
      <div className="relative h-80 w-full overflow-hidden">
        <HeroPhoto place={place} />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-black/40" />
        <div
          className="absolute inset-x-0 top-0 flex items-center justify-between p-3"
          style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur"
            aria-label="Back"
          >
            <Icon name="chevronLeft" className="h-6 w-6" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => shareLink(place.name, `${place.name} — ${meta.label} in ${place.area ?? "Bangalore"}`, placeUrl(place.id))}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 backdrop-blur"
              aria-label="Share"
            >
              <Icon name="share" className="h-5 w-5" />
            </button>
            <FavoriteButton placeId={place.id} className="h-10 w-10 bg-black/45 backdrop-blur" />
          </div>
        </div>
      </div>

      <div className="relative -mt-20 flex flex-col gap-4 px-4">
        {/* Title */}
        <div className="animate-fade-up">
          <p className="text-xs font-bold tracking-wider text-brand uppercase">
            {meta.emoji} {meta.label}
            {place.cuisine?.length ? ` · ${place.cuisine.slice(0, 3).join(", ")}` : ""}
          </p>
          <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight">{place.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {[place.area ?? "Bangalore", distance !== null ? `${formatDistance(distance)} away` : null].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {rating !== undefined ? (
              <span className="flex items-center gap-2">
                <RatingPill rating={rating} />
                <a href={googleReviewsUrl(place)} target="_blank" rel="noreferrer" className="text-sm text-muted underline decoration-faint underline-offset-4">
                  {ratingCount ? `${formatCount(ratingCount)} Google reviews` : "Google reviews"}
                </a>
              </span>
            ) : (
              <span className="text-sm text-muted">No Google rating yet</span>
            )}
            {price && (
              <span className="flex items-center gap-1.5 text-sm">
                <Icon name="wallet" className="h-4 w-4 text-muted" />
                <span>
                  ≈ {price}
                  <span className="text-muted"> (approx.)</span>
                </span>
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <OpenBadge place={place} now={ctx.now} />
            {isHiddenGem(place) && (
              <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">💎 Hidden gem</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-5 gap-1 py-1">
          <Action icon="navigation" label="Directions" href={directionsUrl(place)} />
          {place.phone ? <Action icon="phone" label="Call" href={`tel:${place.phone.replace(/\s/g, "")}`} /> : <Action icon="map" label="Maps" href={googleMapsUrl(place)} />}
          <Action icon="car" label="Ride" href={uberUrl(place)} />
          <Action icon="bookmark" label={inLists.length ? `In ${inLists.length} list${inLists.length > 1 ? "s" : ""}` : "Add to list"} onClick={() => setSheet({ kind: "list" })} />
          {place.website ? <Action icon="globe" label="Website" href={place.website} /> : <Action icon="share" label="Share" onClick={() => shareLink(place.name, place.name, placeUrl(place.id))} />}
        </div>

        {place.bookingUrl && (
          <a href={place.bookingUrl} target="_blank" rel="noreferrer" className="btn-ghost -mt-1 w-full">
            <Icon name="calendar" className="h-4 w-4 text-brand" /> Book a table
          </a>
        )}

        {/* Your experience */}
        <Card
          title="Your experience"
          right={
            visits.length > 0 && (
              <span className="text-xs text-muted">
                {visits.length} visit{visits.length > 1 ? "s" : ""}
                {myAvg !== null ? ` · avg ${myAvg.toFixed(1)}★` : ""}
              </span>
            )
          }
        >
          {visits.length === 0 ? (
            <p className="mb-3 text-sm text-muted">Been here? Log it to build your personal food & drinks diary.</p>
          ) : (
            <ul className="mb-3 flex flex-col divide-y divide-line/60">
              {visits.map((v) => (
                <li key={v.id}>
                  <button className="flex w-full items-start gap-3 py-2.5 text-left" onClick={() => setSheet({ kind: "visit", visit: v })}>
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ok/15 text-ok">
                      <Icon name="checkCircle" className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {formatVisitDate(v.date)}
                        {v.rating !== null && <MiniStars value={v.rating} />}
                      </span>
                      <span className="block text-xs text-muted">
                        {[v.costForTwo ? `${formatINR(v.costForTwo)} for two` : null, v.note || null].filter(Boolean).join(" · ") || "Tap to add details"}
                      </span>
                    </span>
                    <Icon name="edit" className="mt-1 h-4 w-4 text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn-primary w-full" onClick={() => setSheet({ kind: "visit" })}>
            <Icon name="plus" className="h-4 w-4" />
            {visits.length ? "Log another visit" : "I've been here"}
          </button>
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Icon name="note" className="h-4 w-4 text-muted" /> My notes
            </p>
            <NoteEditor key={place.id} placeId={place.id} />
          </div>
        </Card>

        {community && community.visits > 0 && (
          <Card title="BarHudking community">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="text-xl font-extrabold">{community.people}</p>
                <p className="text-[11px] text-muted">{community.people === 1 ? "person has" : "people have"} been</p>
              </div>
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="text-xl font-extrabold">{community.avgRating ? `${community.avgRating}★` : "—"}</p>
                <p className="text-[11px] text-muted">avg rating</p>
              </div>
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="text-xl font-extrabold">{community.avgCost ? formatINR(community.avgCost) : "—"}</p>
                <p className="text-[11px] text-muted">real spend for two</p>
              </div>
            </div>
          </Card>
        )}

        {/* About */}
        {(place.description || place.review || place.features?.length) && (
          <Card title="About">
            {place.description && <p className="mb-3 text-sm leading-relaxed text-ink/85">{place.description}</p>}
            {place.review && (
              <blockquote className="mb-3 rounded-2xl bg-surface-2 p-3 text-sm leading-relaxed text-ink/85 italic">
                “{place.review.text}”
                {place.review.author && <span className="mt-1 block text-xs text-muted not-italic">— {place.review.author}</span>}
              </blockquote>
            )}
            {place.features && place.features.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {place.features.map((f) => (
                  <span key={f} className="rounded-full bg-surface-3 px-3 py-1 text-xs">
                    {f}
                  </span>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Reviews: Google's own page is free to link to */}
        {place.googleId && (
          <a
            href={googleReviewsUrl(place)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-3xl border border-line/70 bg-surface p-4 active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-star/15 text-star">
              <Icon name="star" filled />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Read the reviews</span>
              <span className="block text-xs text-muted">
                {ratingCount ? `${formatCount(ratingCount)} reviews` : "Reviews"} on Google · sort by newest or most relevant
              </span>
            </span>
            <Icon name="external" className="h-4 w-4 text-faint" />
          </a>
        )}

        {/* Hours */}
        {place.hours && (
          <Card
            title="Hours"
            right={
              <button className="text-xs font-semibold text-brand" onClick={() => setShowAllHours(!showAllHours)}>
                {showAllHours ? "Today only" : "Full week"}
              </button>
            }
          >
            <ul className="flex flex-col gap-1.5 text-sm">
              {place.hours.map((ranges, d) =>
                showAllHours || d === today ? (
                  <li key={d} className={`flex justify-between ${d === today ? "font-semibold text-ink" : "text-muted"}`}>
                    <span>
                      {WEEKDAY_LABELS[d]}
                      {d === today && " (today)"}
                    </span>
                    <span className="text-right">{describeDay(ranges)}</span>
                  </li>
                ) : null,
              )}
            </ul>
          </Card>
        )}

        {/* Location */}
        <Card title="Location">
          <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer" className="block">
            <MiniMap lat={place.lat} lng={place.lng} emoji={meta.emoji} color={meta.color} />
          </a>
          {place.address && <p className="mt-3 text-sm text-ink/85">{place.address}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={directionsUrl(place)} target="_blank" rel="noreferrer" className="btn-ghost py-2.5 text-xs">
              <Icon name="navigation" className="h-4 w-4" /> Directions
            </a>
            <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer" className="btn-ghost py-2.5 text-xs">
              <Icon name="external" className="h-4 w-4" /> Google Maps
            </a>
          </div>
        </Card>

        {nearby.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-bold">Also around here</h2>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {nearby.map((p) => (
                <PlaceTile key={p.id} place={p} coords={ctx.coords} />
              ))}
            </div>
          </section>
        )}

        <p className="px-2 pt-2 text-center text-[11px] leading-relaxed text-faint">
          Info wrong or place closed?{" "}
          <a
            className="underline"
            target="_blank"
            rel="noreferrer"
            href={`https://www.openstreetmap.org/note/new#map=19/${place.lat}/${place.lng}`}
          >
            Tell OpenStreetMap
          </a>{" "}
          · <Link to="/me#about" className="underline">Data sources</Link>
        </p>
      </div>

      {sheet?.kind === "visit" && <VisitSheet place={place} visit={sheet.visit} onClose={() => setSheet(null)} />}
      {sheet?.kind === "list" && <AddToListSheet placeId={place.id} onClose={() => setSheet(null)} />}
    </div>
  );
}
