import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation as useRouterLocation } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import Icon from "../components/Icon";
import CountUp from "../components/CountUp";
import BottomSheet from "../components/BottomSheet";
import { usePlaces } from "../lib/places";
import {
  clearUserData,
  coerceUserData,
  deleteSpot,
  getUserData,
  importUserData,
  live,
  saveSpot,
  setProfileName,
  setSuperSuggestAnchors,
  useUserData,
  type SuperSuggestAnchor,
} from "../lib/store";
import { DEFAULT_ANCHORS, inSuperSuggest, useAnchors } from "../lib/superSuggest";
import { isComplete } from "../lib/discover";
import { badges, computeStats } from "../lib/stats";
import { formatINR, TYPE_META } from "../lib/discover";
import { AREAS } from "../lib/areas";
import { requestLocation, useLocation } from "../lib/location";
import { sendSignInCode, signOut, syncNow, useSyncState, verifySignInCode } from "../lib/sync";
import { promptInstall, useCanInstall, isStandalone } from "../lib/install";
import { toast } from "../lib/toast";
import { PLACE_TYPES } from "../lib/types";

function Section({ id, title, children, sub }: { id?: string; title: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 px-1">
        <h2 className="text-lg font-bold">{title}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-surface p-3.5">
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString("en-IN");
}

export default function Me() {
  const { hash } = useRouterLocation();
  const { index } = usePlaces();
  const data = useUserData((d) => d);
  const stats = useMemo(() => (index ? computeStats(data, index.byId) : null), [data, index]);
  const earned = stats ? badges(stats) : [];

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <div className="pb-nav">
      <PageHeader title="Me" />
      <div className="flex flex-col gap-8 px-4 pt-2">
        <ProfileCard />

        {stats && (
          <Section title="Your Bangalore" sub={stats.outings ? "Everything you've logged so far" : "Log visits to start filling this in"}>
            <div className="grid grid-cols-2 gap-3">
              <Stat value={<CountUp value={stats.uniquePlaces} />} label="places tried" />
              <Stat value={<CountUp value={stats.outings} />} label={`outings · ${stats.thisMonth} this month`} />
              <Stat value={`${stats.areasVisited}/${stats.totalAreas}`} label="neighbourhoods explored" />
              <Stat value={stats.avgSpend ? formatINR(stats.avgSpend) : "—"} label="avg spend for two" />
            </div>

            {stats.uniquePlaces > 0 && (
              <div className="mt-3 rounded-2xl border border-line/70 bg-surface p-4">
                <p className="mb-2 text-sm font-semibold">What you go for</p>
                <div className="flex flex-wrap gap-2">
                  {PLACE_TYPES.filter((t) => stats.byType[t]).map((t) => (
                    <span key={t} className="rounded-full bg-surface-3 px-3 py-1 text-sm">
                      {TYPE_META[t].emoji} {stats.byType[t]} {stats.byType[t] === 1 ? TYPE_META[t].label.toLowerCase() : TYPE_META[t].plural.toLowerCase()}
                    </span>
                  ))}
                </div>
                {stats.topAreas.length > 0 && (
                  <>
                    <p className="mt-4 mb-2 text-sm font-semibold">Your go-to areas</p>
                    <ol className="flex flex-col gap-1.5 text-sm">
                      {stats.topAreas.map((a, i) => (
                        <li key={a.name} className="flex justify-between">
                          <span>
                            <span className="mr-2 text-muted">{i + 1}.</span>
                            {a.name}
                          </span>
                          <span className="text-muted">
                            {a.count} place{a.count > 1 ? "s" : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            )}
          </Section>
        )}

        {stats && (
          <Section title="Badges" sub={`${earned.filter((b) => b.progress >= b.goal).length} of ${earned.length} unlocked`}>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {earned.map((b) => {
                const done = b.progress >= b.goal;
                return (
                  <div
                    key={b.id}
                    className={`w-32 shrink-0 rounded-3xl border p-3 text-center ${
                      done ? "border-brand/50 bg-gradient-to-b from-brand/20 to-surface" : "border-line/70 bg-surface"
                    }`}
                  >
                    <div className={`text-4xl ${done ? "" : "opacity-30 grayscale"}`}>{b.emoji}</div>
                    <p className="mt-1 text-sm leading-tight font-bold">{b.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{b.description}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${(b.progress / b.goal) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-faint">
                      {b.progress}/{b.goal}
                    </p>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <SuperSuggestSettings />
        <Spots />
        <Account />
        <Backup />
        <About />
      </div>
    </div>
  );
}

function ProfileCard() {
  const name = useUserData((d) => d.profile.name);
  const [draft, setDraft] = useState(name);
  const canInstall = useCanInstall();
  useEffect(() => setDraft(name), [name]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-brand/25 via-surface to-surface p-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-2xl font-extrabold text-white">
          {name ? name[0].toUpperCase() : "🍻"}
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="profile-name" className="text-xs text-muted">
            What should we call you?
          </label>
          <input
            id="profile-name"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft.trim() !== name && setProfileName(draft.trim())}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder="Your name"
            maxLength={40}
            className="w-full bg-transparent text-xl font-bold outline-none placeholder:text-faint"
          />
        </div>
      </div>
      {canInstall && !isStandalone() && (
        <button className="btn-ghost w-full" onClick={promptInstall}>
          <Icon name="download" className="h-4 w-4" /> Install BarHudking on this device
        </button>
      )}
    </div>
  );
}

const RADII = [3, 5, 8, 12];
const SS_RADII = [5, 8, 10, 12, 15];

function SuperSuggestSettings() {
  const anchors = useAnchors();
  const { index } = usePlaces();
  const geo = useLocation();
  const [locating, setLocating] = useState<string | null>(null);
  const isDefault = anchors === DEFAULT_ANCHORS;
  const count = useMemo(
    () => (index ? index.places.filter((p) => isComplete(p) && inSuperSuggest(p, anchors)).length : 0),
    [index, anchors],
  );

  const update = (id: string, patch: Partial<SuperSuggestAnchor>) =>
    setSuperSuggestAnchors(anchors.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // Finish "use my location" once a fix arrives.
  useEffect(() => {
    if (locating && geo.coords) {
      update(locating, { lat: +geo.coords.lat.toFixed(5), lng: +geo.coords.lng.toFixed(5) });
      toast("Point moved to your location");
      setLocating(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.coords, locating]);

  return (
    <Section
      id="super-suggest"
      title="✨ Super Suggest"
      sub="Shows only places within range of all three points at once — the sweet spot between office, home and HSR."
    >
      <div className="flex flex-col gap-2">
        {anchors.map((a) => (
          <div key={a.id} className="rounded-2xl border border-line/70 bg-surface p-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <Icon name="pin" />
              </span>
              <input
                value={a.label}
                onChange={(e) => update(a.id, { label: e.target.value })}
                className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
                maxLength={40}
                aria-label="Point name"
              />
            </div>
            <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
              {SS_RADII.map((r) => (
                <button key={r} className={`chip px-3 py-1.5 ${a.radiusKm === r ? "chip-on" : ""}`} onClick={() => update(a.id, { radiusKm: r })}>
                  {r} km
                </button>
              ))}
            </div>
            <button
              className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-brand"
              onClick={() => {
                setLocating(a.id);
                requestLocation();
              }}
            >
              <Icon name="locate" className="h-3.5 w-3.5" />
              {locating === a.id ? "Finding you…" : "Set to where I am right now"}
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between px-1">
        <p className="text-sm text-muted">
          <strong className="text-ink">{count.toLocaleString("en-IN")}</strong> great places in your zone
        </p>
        {!isDefault && (
          <button className="text-xs text-muted underline" onClick={() => setSuperSuggestAnchors(null)}>
            Reset to defaults
          </button>
        )}
      </div>
    </Section>
  );
}

function Spots() {
  const spotsRec = useUserData((d) => d.spots);
  const spots = useMemo(() => live(spotsRec), [spotsRec]);
  const geo = useLocation();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("Home");
  const [radius, setRadius] = useState(5);
  const [source, setSource] = useState<"here" | string>("here");
  const waiting = useRef(false);

  function save() {
    if (source === "here") {
      if (!geo.coords) {
        waiting.current = true;
        requestLocation();
        return;
      }
      saveSpot({ label: label.trim() || "My spot", lat: geo.coords.lat, lng: geo.coords.lng, radiusKm: radius });
    } else {
      const area = AREAS.find((a) => a.name === source);
      if (!area) return;
      saveSpot({ label: label.trim() || area.name, lat: area.lat, lng: area.lng, radiusKm: radius });
    }
    toast("Spot saved");
    setAdding(false);
  }

  // Finish saving once location arrives.
  useEffect(() => {
    if (waiting.current && geo.coords && adding) {
      waiting.current = false;
      saveSpot({ label: label.trim() || "My spot", lat: geo.coords.lat, lng: geo.coords.lng, radiusKm: radius });
      toast("Spot saved");
      setAdding(false);
    }
  }, [geo.coords, adding, label, radius]);

  return (
    <Section id="spots" title="My spots" sub="Home, office, a friend's place — use the “Near my spots” filter to only see places close to them.">
      <div className="flex flex-col gap-2">
        {spots.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-line/70 bg-surface p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/15 text-brand">
              <Icon name={/home/i.test(s.label) ? "home" : "pin"} />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{s.label}</p>
              <p className="text-xs text-muted">Places within {s.radiusKm} km</p>
            </div>
            <button onClick={() => deleteSpot(s.id)} className="rounded-full p-2 text-faint active:bg-surface-2" aria-label={`Remove ${s.label}`}>
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button onClick={() => setAdding(true)} className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line p-3 text-sm font-semibold text-brand">
          <Icon name="plus" className="h-4 w-4" /> Add a spot
        </button>
      </div>

      {adding && (
        <BottomSheet
          title="Add a spot"
          onClose={() => setAdding(false)}
          footer={
            <button className="btn-primary w-full" onClick={save}>
              {source === "here" && !geo.coords ? (geo.status === "loading" ? "Finding you…" : "Use my location & save") : "Save spot"}
            </button>
          }
        >
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-sm font-semibold">Name</p>
              <div className="mb-2 flex gap-2">
                {["Home", "Work", "Gym", "Friend's"].map((l) => (
                  <button key={l} className={`chip ${label === l ? "chip-on" : ""}`} onClick={() => setLabel(l)}>
                    {l}
                  </button>
                ))}
              </div>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" maxLength={30} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Where</p>
              <select value={source} onChange={(e) => setSource(e.target.value)} className="input appearance-none">
                <option value="here">📍 Where I am right now</option>
                {AREAS.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
              {source === "here" && geo.status === "denied" && (
                <p className="mt-1 text-xs text-rose-400">Location is blocked — pick an area instead.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">How far are you happy to go?</p>
              <div className="flex gap-2">
                {RADII.map((r) => (
                  <button key={r} className={`chip flex-1 justify-center ${radius === r ? "chip-on" : ""}`} onClick={() => setRadius(r)}>
                    {r} km
                  </button>
                ))}
              </div>
            </div>
          </div>
        </BottomSheet>
      )}
    </Section>
  );
}

function Account() {
  const sync = useSyncState();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (sync.phase === "disabled") {
    return (
      <Section id="account" title="Your data" sub="Everything is saved privately on this device and works offline.">
        <div className="rounded-2xl border border-line/70 bg-surface p-4 text-sm text-muted">
          <p>
            Accounts & cross-device sync aren't switched on for this copy of BarHudking. Use <strong className="text-ink">Backup</strong> below to move
            your data to another phone.
          </p>
        </div>
      </Section>
    );
  }

  if (sync.email) {
    const status =
      sync.phase === "syncing"
        ? "Syncing…"
        : sync.phase === "offline"
          ? "Offline — will sync when you're back online"
          : sync.phase === "error"
            ? `Sync problem: ${sync.error}`
            : sync.lastSyncedAt
              ? `Synced ${timeAgo(sync.lastSyncedAt)}`
              : "Connected";
    return (
      <Section id="account" title="Account" sub="Your favorites, visits, notes and lists sync across every device you sign in on.">
        <div className="rounded-2xl border border-line/70 bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${sync.phase === "error" ? "bg-rose-500/15 text-rose-400" : "bg-ok/15 text-ok"}`}>
              <Icon name="cloud" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{sync.email}</p>
              <p className={`text-xs ${sync.phase === "error" ? "text-rose-400" : "text-muted"}`}>{status}</p>
            </div>
            <button onClick={() => syncNow()} className="rounded-full p-2 text-muted active:bg-surface-2" aria-label="Sync now">
              <Icon name="refresh" className={`h-5 w-5 ${sync.phase === "syncing" ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-ghost py-2.5 text-xs" onClick={() => signOut(false).then(() => toast("Signed out"))}>
              <Icon name="logout" className="h-4 w-4" /> Sign out
            </button>
            <button
              className="btn-ghost py-2.5 text-xs text-rose-400"
              onClick={() => {
                if (window.confirm("Sign out and remove your data from this device? It stays safe in your account.")) {
                  signOut(true).then(() => toast("Signed out and cleared this device"));
                }
              }}
            >
              Sign out & clear device
            </button>
          </div>
        </div>
      </Section>
    );
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      if (step === "email") {
        await sendSignInCode(email.trim());
        setStep("code");
      } else {
        await verifySignInCode(email.trim(), code.trim());
        toast("Signed in — syncing your data");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section id="account" title="Sync across devices" sub="Sign in with your email to keep your favorites, visits and lists on all your devices. No password needed.">
      <form
        className="rounded-2xl border border-line/70 bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {step === "email" ? (
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="input"
          />
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">
              We emailed <strong className="text-ink">{email}</strong>. Tap the link in the email, or enter the code from it:
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="123456"
              className="input text-center text-2xl tracking-[0.4em]"
            />
          </>
        )}
        {err && <p className="mt-2 text-xs text-rose-400">{err}</p>}
        <button type="submit" className="btn-primary mt-3 w-full" disabled={busy || (step === "code" && code.length < 6)}>
          {busy ? "Please wait…" : step === "email" ? "Email me a sign-in link" : "Verify & sign in"}
        </button>
        {step === "code" && (
          <button type="button" className="mt-2 w-full text-center text-xs text-muted" onClick={() => setStep("email")}>
            Use a different email
          </button>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Anything you've already saved on this device is merged into your account when you sign in — nothing is lost.
        </p>
      </form>
    </Section>
  );
}

function Backup() {
  const fileInput = useRef<HTMLInputElement>(null);

  function exportData() {
    const blob = new Blob([JSON.stringify(getUserData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `barhudking-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup downloaded");
  }

  async function importFile(file: File) {
    try {
      const parsed = coerceUserData(JSON.parse(await file.text()));
      if (!parsed) throw new Error("That doesn't look like a BarHudking backup.");
      importUserData(parsed);
      toast("Backup restored and merged");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <Section id="backup" title="Backup" sub="Download everything you've saved as a file, or restore one. Restoring merges — it never deletes.">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={exportData}>
          <Icon name="download" className="h-4 w-4" /> Export
        </button>
        <button className="btn-ghost" onClick={() => fileInput.current?.click()}>
          <Icon name="upload" className="h-4 w-4" /> Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <button
        className="mt-3 w-full py-2 text-center text-xs text-rose-400/80"
        onClick={() => {
          if (window.confirm("Erase all favorites, visits, notes, lists and spots on this device? This can't be undone unless you have a backup or you're signed in.")) {
            clearUserData();
            toast("All data on this device erased");
          }
        }}
      >
        Erase all data on this device
      </button>
    </Section>
  );
}

function About() {
  const { index } = usePlaces();
  return (
    <Section id="about" title="About the data">
      <div className="rounded-2xl border border-line/70 bg-surface p-4 text-sm text-muted">
        {index && (
          <p className="mb-2">
            <strong className="text-ink">{index.places.length.toLocaleString("en-IN")}</strong> places across{" "}
            <strong className="text-ink">{index.areas.length}</strong> neighbourhoods, updated{" "}
            {new Date(index.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
          </p>
        )}
        <ul className="list-disc space-y-1 pl-4 text-xs">
          {index?.attribution.map((a) => <li key={a}>{a}</li>)}
          <li>Map tiles © OpenStreetMap contributors</li>
          <li>Cost for two is approximate — from Google price ranges, review mentions or price level.</li>
        </ul>
        <p className="mt-3 text-[11px] text-faint">BarHudking v2 · Made for Bangalore 🍻</p>
      </div>
    </Section>
  );
}
