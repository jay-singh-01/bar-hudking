import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon, { type IconName } from "../components/Icon";
import PlacePhoto from "../components/PlacePhoto";
import FavoriteButton from "../components/FavoriteButton";
import { MiniStars, formatCount } from "../components/Rating";
import { PlaceTile } from "../components/PlaceCard";
import VisitSheet from "../components/VisitSheet";
import AddToListSheet from "../components/AddToListSheet";
import ReportSheet from "../components/ReportSheet";
import MiniMap from "../components/MiniMap";
import EmptyState from "../components/EmptyState";
import { usePlaces } from "../lib/places";
import type { Place } from "../lib/types";
import { approxPriceForTwo, formatINR, isComplete, isHiddenGem, sortPlaces, TYPE_META } from "../lib/discover";
import { describeDay, openStatus, todayIndex, WEEKDAY_LABELS } from "../lib/hours";
import { formatDistance, haversineKm } from "../lib/geo";
import { directionsUrl, googleMapsUrl, googleReviewsUrl, uberUrl } from "../lib/maps";
import { placeUrl, shareLink } from "../lib/share";
import { shareCard } from "../lib/shareCard";
import { live, setNote, unhidePlace, useUserData, visitsFor, type Visit } from "../lib/store";
import { useFilterContext } from "../lib/useFilterContext";
import { sizedPhoto } from "../lib/photo";
import { loadCommunityStats, type CommunityStat } from "../lib/sync";
import { toast } from "../lib/toast";
import { rememberPlace } from "../lib/recent";

function Action({ icon, label, href, onClick }: { icon: IconName; label: string; href?: string; onClick?: () => void }) {
  const cls = "flex flex-1 flex-col items-center gap-1.5 py-1 text-[11px] font-medium text-muted transition active:text-ink";
  const inner = (
    <>
      <Icon name={icon} className="h-5 w-5 text-ink" strokeWidth={1.75} />
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

function Block({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      {title && (
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
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
          <div className="absolute inset-0 flex items-center justify-center pb-16">
            <img src={place.photo} alt="" className="h-32 w-32 animate-fade-up rounded-xl object-cover shadow-2xl ring-1 ring-white/20" />
          </div>
        </>
      ) : (
        <div className="h-full w-full animate-ken-burns">
          <PlacePhoto place={place} src={sizedPhoto(place.photo, 900, 640)} className="h-full w-full" emojiSize="text-7xl" />
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
        placeholder="Private notes — what to order, best table, who recommended it"
        className="input resize-none text-sm"
      />
      <p className="mt-1 h-4 text-right text-[11px] text-muted">{status === "saved" ? "Saved" : ""}</p>
    </div>
  );
}

/** One cell of the fact strip under the title. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 px-3 first:pl-0 last:pr-0">
      <p className="eyebrow !text-[10px]">{label}</p>
      <div className="tabular mt-1 truncate text-[15px] font-semibold">{children}</div>
    </div>
  );
}

/** Compact open/closed for the fact strip: "Till 1 am", "Opens 6 pm". */
function NowCell({ place, now }: { place: Place; now: Date }) {
  if (place.status === "temporarily_closed") return <span className="text-brand-2">Closed for now</span>;
  const s = openStatus(place.hours, now);
  if (!s) return <span className="font-normal text-muted">—</span>;
  const text = s.label.replace(/^Closes /, "Till ").replace(/^Open 24 hours$/, "24 hours");
  return (
    <span className={`inline-flex items-center gap-1.5 ${s.open ? (s.closingSoon ? "text-brand" : "text-ok") : "text-muted"}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{text}</span>
    </span>
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
  const hidden = ctx.hiddenIds.has(placeId);

  const [sheet, setSheet] = useState<{ kind: "visit"; visit?: Visit } | { kind: "list" } | { kind: "report" } | null>(null);
  const [community, setCommunity] = useState<CommunityStat | null>(null);
  const [showAllHours, setShowAllHours] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [placeId]);

  useEffect(() => {
    if (place) rememberPlace(place.id);
  }, [place]);

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
    const close = index.places.filter((p) => p.id !== place.id && isComplete(p) && !ctx.hiddenIds.has(p.id) && haversineKm(place, p) <= 1.5);
    const sameType = close.filter((p) => p.type === place.type);
    return sortPlaces(sameType.length >= 4 ? sameType : close, "recommended", { ...ctx, coords: place }, "").slice(0, 10);
  }, [index, place, ctx]);

  if (error) return <EmptyState icon="refresh" title="Couldn't load places" message={error} />;
  if (!index) return <div className="skeleton h-72 w-full" />;
  if (!place) {
    return (
      <EmptyState
        icon="search"
        title="Place not found"
        message="This place isn't in the current data set — it may have closed or been merged."
        action={{ label: "Back to Discover", onClick: () => navigate("/") }}
      />
    );
  }

  const meta = TYPE_META[place.type];
  const price = approxPriceForTwo(place);
  const distance = ctx.coords ? haversineKm(ctx.coords, place) : null;
  const myRatings = visits.filter((v) => v.rating !== null);
  const myAvg = myRatings.length ? myRatings.reduce((s, v) => s + v.rating!, 0) / myRatings.length : null;
  const today = todayIndex(ctx.now);

  return (
    <div className="pb-nav">
      {/* Hero */}
      <div className="relative h-[340px] w-full overflow-hidden">
        <HeroPhoto place={place} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/35" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
            aria-label="Back"
          >
            <Icon name="chevronLeft" className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => shareLink(place.name, `${place.name} — ${meta.label} in ${place.area ?? "Bangalore"}`, placeUrl(place.id))}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
              aria-label="Share link"
            >
              <Icon name="share" className="h-[18px] w-[18px]" />
            </button>
            <FavoriteButton placeId={place.id} onPhoto className="h-9 w-9 bg-black/40 backdrop-blur" iconClassName="h-[18px] w-[18px]" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-4 pb-5">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-white/75 uppercase">
            {meta.label}
            {place.cuisine?.length ? ` · ${place.cuisine.slice(0, 2).join(", ")}` : ""}
            {isHiddenGem(place) ? " · Hidden gem" : ""}
          </p>
          <h1 className="font-display mt-1 text-[34px] leading-[1.05] font-semibold text-white">{place.name}</h1>
          <p className="mt-1.5 text-sm text-white/75">
            {place.area ? (
              <Link to={`/?area=${encodeURIComponent(place.area)}`} className="underline decoration-white/40 underline-offset-4">
                {place.area}
              </Link>
            ) : (
              "Bangalore"
            )}
            {distance !== null ? ` · ${formatDistance(distance)} away` : ""}
          </p>
        </div>
      </div>

      <div className="px-4">
        {hidden && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-line p-3 text-sm">
            <span className="text-muted">You've hidden this place.</span>
            <button
              className="font-medium underline underline-offset-4"
              onClick={() => {
                unhidePlace(place.id);
                toast("Showing it again");
              }}
            >
              Unhide
            </button>
          </div>
        )}

        {/* Fact strip */}
        <div className="flex divide-x divide-line py-5">
          <Fact label="Google">
            {place.rating !== undefined ? (
              <a href={googleReviewsUrl(place)} target="_blank" rel="noreferrer" className="inline-flex items-baseline gap-1">
                <Icon name="star" filled className="h-3.5 w-3.5 self-center text-star" />
                {place.rating.toFixed(1)}
                {place.ratingCount ? <span className="text-xs font-normal text-muted">{formatCount(place.ratingCount)}</span> : null}
              </a>
            ) : (
              <span className="font-normal text-muted">—</span>
            )}
          </Fact>
          <Fact label="For two">
            {price ? (price[0] === price[1] ? formatINR(price[0]) : `${formatINR(price[0])}–${formatINR(price[1]).slice(1)}`) : <span className="font-normal text-muted">—</span>}
          </Fact>
          <Fact label="Now">
            <NowCell place={place} now={ctx.now} />
          </Fact>
        </div>

        {/* Actions */}
        <div className="flex border-y border-line py-3">
          <Action icon="navigation" label="Directions" href={directionsUrl(place)} />
          {place.phone ? <Action icon="phone" label="Call" href={`tel:${place.phone.replace(/\s/g, "")}`} /> : <Action icon="map" label="Maps" href={googleMapsUrl(place)} />}
          <Action icon="car" label="Ride" href={uberUrl(place)} />
          <Action icon="bookmark" label={inLists.length ? `In ${inLists.length} list${inLists.length > 1 ? "s" : ""}` : "Save to list"} onClick={() => setSheet({ kind: "list" })} />
          <Action
            icon="image"
            label={sharing ? "Making…" : "Share card"}
            onClick={async () => {
              setSharing(true);
              await shareCard(place);
              setSharing(false);
            }}
          />
        </div>

        {place.bookingUrl && (
          <a href={place.bookingUrl} target="_blank" rel="noreferrer" className="btn-primary mt-4 w-full">
            <Icon name="calendar" className="h-4 w-4" /> Book a table
          </a>
        )}

        {place.description && <p className="font-display mt-6 text-lg leading-relaxed text-ink/90 italic">{place.description}</p>}

        {/* Your experience */}
        <div className="mt-6">
          <Block
            title="Your visits"
            right={
              visits.length > 0 && (
                <span className="tabular text-xs text-muted">
                  {visits.length} visit{visits.length > 1 ? "s" : ""}
                  {myAvg !== null ? ` · avg ${myAvg.toFixed(1)}★` : ""}
                </span>
              )
            }
          >
            {visits.length === 0 ? (
              <p className="mb-3 text-sm text-muted">Been here? Log it to build your own food and drinks diary.</p>
            ) : (
              <ul className="mb-3 flex flex-col divide-y divide-line">
                {visits.map((v) => (
                  <li key={v.id}>
                    <button className="flex w-full items-start gap-3 py-3 text-left" onClick={() => setSheet({ kind: "visit", visit: v })}>
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
            <button className="btn-ghost w-full" onClick={() => setSheet({ kind: "visit" })}>
              <Icon name="plus" className="h-4 w-4" />
              {visits.length ? "Log another visit" : "I've been here"}
            </button>
            <p className="eyebrow mt-6 mb-2">My notes</p>
            <NoteEditor key={place.id} placeId={place.id} />
          </Block>
        </div>

        {community && community.visits > 0 && (
          <Block title="From BarHudking users">
            <div className="flex divide-x divide-line">
              <Fact label="Been here">{community.people}</Fact>
              <Fact label="Avg rating">{community.avgRating ? `${community.avgRating}★` : "—"}</Fact>
              <Fact label="Real spend">{community.avgCost ? formatINR(community.avgCost) : "—"}</Fact>
            </div>
          </Block>
        )}

        {(place.review || place.features?.length || place.googleId) && (
          <Block title="Good to know">
            {place.features && place.features.length > 0 && <p className="mb-3 text-sm leading-relaxed text-ink/85">{place.features.join(" · ")}</p>}
            {place.review && (
              <blockquote className="mb-3 border-l-2 border-brand pl-3 text-sm leading-relaxed text-muted italic">“{place.review.text}”</blockquote>
            )}
            {place.googleId && (
              <a href={googleReviewsUrl(place)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4">
                Read {place.ratingCount ? `all ${formatCount(place.ratingCount)}` : "the"} reviews on Google
                <Icon name="external" className="h-3.5 w-3.5" />
              </a>
            )}
          </Block>
        )}

        {place.hours && (
          <Block
            title="Hours"
            right={
              <button className="text-[13px] text-muted underline underline-offset-4" onClick={() => setShowAllHours(!showAllHours)}>
                {showAllHours ? "Today" : "Full week"}
              </button>
            }
          >
            <ul className="tabular flex flex-col gap-1.5 text-sm">
              {place.hours.map((ranges, d) =>
                showAllHours || d === today ? (
                  <li key={d} className={`flex justify-between ${d === today ? "font-semibold text-ink" : "text-muted"}`}>
                    <span>
                      {WEEKDAY_LABELS[d]}
                      {d === today && showAllHours && " (today)"}
                    </span>
                    <span className="text-right">{describeDay(ranges)}</span>
                  </li>
                ) : null,
              )}
            </ul>
          </Block>
        )}

        <Block title="Where">
          <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer" className="block">
            <MiniMap lat={place.lat} lng={place.lng} color={meta.color} />
          </a>
          {place.address && <p className="mt-3 text-sm text-ink/85">{place.address}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={directionsUrl(place)} target="_blank" rel="noreferrer" className="btn-ghost py-2.5 text-[13px]">
              <Icon name="navigation" className="h-4 w-4" /> Directions
            </a>
            <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer" className="btn-ghost py-2.5 text-[13px]">
              <Icon name="external" className="h-4 w-4" /> Google Maps
            </a>
          </div>
        </Block>

        {nearby.length > 0 && (
          <Block title="Also around here">
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {nearby.map((p) => (
                <PlaceTile key={p.id} place={p} coords={ctx.coords} />
              ))}
            </div>
          </Block>
        )}

        <div className="flex items-center justify-between border-t border-line py-5 text-[13px] text-muted">
          {!hidden ? (
            <button className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline" onClick={() => setSheet({ kind: "report" })}>
              <Icon name="flag" className="h-3.5 w-3.5" /> Something wrong?
            </button>
          ) : (
            <span />
          )}
          <Link to="/me#about" className="underline-offset-4 hover:underline">
            Data sources
          </Link>
        </div>
      </div>

      {sheet?.kind === "visit" && <VisitSheet place={place} visit={sheet.visit} onClose={() => setSheet(null)} />}
      {sheet?.kind === "list" && <AddToListSheet placeId={place.id} onClose={() => setSheet(null)} />}
      {sheet?.kind === "report" && <ReportSheet place={place} onClose={() => setSheet(null)} onHidden={() => setSheet(null)} />}
    </div>
  );
}
