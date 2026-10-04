import type { TimeRange, WeeklyHours } from "./types";

// ---------------------------------------------------------------------------
// Parsing (used by the data pipeline)
// ---------------------------------------------------------------------------

const OSM_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseHHMM(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 48 || min > 59) return null;
  return h * 60 + min;
}

function parseOsmTimes(spec: string): TimeRange[] | null {
  const ranges: TimeRange[] = [];
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-");
    if (b === undefined) return null;
    const open = parseHHMM(a);
    let close = parseHHMM(b);
    if (open === null || close === null) return null;
    if (close <= open) close += 1440;
    ranges.push([open, close]);
  }
  return ranges;
}

function parseOsmDays(spec: string): number[] | null {
  const days = new Set<number>();
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-");
    const start = OSM_DAYS.indexOf(a);
    if (start === -1) return null;
    if (b === undefined) {
      days.add(start);
      continue;
    }
    const end = OSM_DAYS.indexOf(b);
    if (end === -1) return null;
    for (let i = start; ; i = (i + 1) % 7) {
      days.add(i);
      if (i === end) break;
    }
  }
  return [...days];
}

/**
 * Parses the common subset of OSM `opening_hours` ("Mo-Fr 11:00-23:00; Sa,Su
 * 12:00-01:00", "24/7", "11:00-23:00", "Mo off"). Rules with selectors we
 * don't understand (PH, months, weeks) are skipped. Returns null when nothing
 * usable is found, so callers never show made-up hours.
 */
export function parseOsmHours(raw: string | undefined): WeeklyHours | null {
  if (!raw) return null;
  const value = raw.trim();
  if (value === "24/7") return Array.from({ length: 7 }, () => [[0, 1440]]);

  const week: (TimeRange[] | undefined)[] = Array(7).fill(undefined);
  let parsedAny = false;

  for (const rule of value.split(/;|\|\|/)) {
    // Rules that apply only to public/school holidays are skipped; "PH" mixed
    // with weekdays ("PH,Mo-Su 09:00-23:00") just drops the PH part.
    if (/^\s*(PH|SH)(\s|$)/.test(rule)) continue;
    const r = rule
      .replace(/\b(PH|SH),|,(PH|SH)\b/g, "")
      .replace(/\s*-\s*/g, "-")
      .replace(/\s*,\s*/g, ",")
      .trim();
    if (!r) continue;
    const m = r.match(/^((?:[A-Z][a-z](?:-[A-Z][a-z])?,?)+)?\s*(.*)$/);
    if (!m) continue;
    const daySpec = m[1]?.replace(/,$/, "");
    const timeSpec = m[2].trim();
    const days = daySpec ? parseOsmDays(daySpec) : [0, 1, 2, 3, 4, 5, 6];
    if (!days) continue;

    let ranges: TimeRange[] | null;
    if (/^(off|closed)$/i.test(timeSpec)) ranges = [];
    else if (timeSpec === "24/7" || timeSpec === "00:00-24:00") ranges = [[0, 1440]];
    else ranges = parseOsmTimes(timeSpec);
    if (!ranges) continue;

    for (const d of days) week[d] = ranges;
    parsedAny = true;
  }

  if (!parsedAny) return null;
  return week.map((d) => d ?? []);
}

const GOOGLE_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function parseGoogleClock(s: string, fallbackMeridiem?: string): { mins: number; meridiem?: string } | null {
  const m = s
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const meridiem = m[3] ?? fallbackMeridiem;
  if (meridiem === "pm" && h < 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  return { mins: h * 60 + min, meridiem: m[3] };
}

/** Parses one Google day string: "11 am–11:30 pm", "12–3:30 pm, 7–11 pm", "Open 24 hours", "Closed". */
export function parseGoogleDay(raw: string): TimeRange[] | null {
  const s = raw.replace(/\u202f|\u2009|\u00a0/g, " ").trim();
  if (/closed/i.test(s)) return [];
  if (/24 hours/i.test(s)) return [[0, 1440]];
  const ranges: TimeRange[] = [];
  for (const part of s.split(",")) {
    const [a, b] = part.split(/\s*[–—-]\s*/);
    if (!a || !b) return null;
    const close = parseGoogleClock(b);
    if (!close) return null;
    const open = parseGoogleClock(a, close.meridiem);
    if (!open) return null;
    let openMins = open.mins;
    // "12–3:30 pm" means noon; "11–2 am" means 11 pm to 2 am.
    if (!a.match(/am|pm/i) && openMins > close.mins && close.meridiem === "pm") openMins -= 720;
    let closeMins = close.mins;
    if (closeMins <= openMins) closeMins += 1440;
    ranges.push([openMins, closeMins]);
  }
  return ranges;
}

/** Parses SearchApi/Google `operating_hours` ({ monday: "11 am–11 pm", ... }). */
export function parseGoogleWeek(obj: Record<string, unknown> | undefined): WeeklyHours | null {
  if (!obj) return null;
  const week: WeeklyHours = [];
  for (const day of GOOGLE_DAYS) {
    const v = obj[day];
    if (typeof v !== "string") return null;
    const ranges = parseGoogleDay(v);
    if (!ranges) return null;
    week.push(ranges);
  }
  return week;
}

// ---------------------------------------------------------------------------
// Evaluation (used by the app)
// ---------------------------------------------------------------------------

export interface OpenStatus {
  open: boolean;
  /** e.g. "Closes 11:30 pm", "Opens 6 pm", "Open 24 hours" */
  label: string;
  closingSoon: boolean;
}

/** JS getDay() is Sun=0; our weeks are Mon=0. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function formatMinutes(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const meridiem = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return min ? `${h12}:${String(min).padStart(2, "0")} ${meridiem}` : `${h12} ${meridiem}`;
}

export function openStatus(hours: WeeklyHours | undefined, now = new Date()): OpenStatus | null {
  if (!hours || hours.length !== 7) return null;
  const day = mondayIndex(now);
  const mins = now.getHours() * 60 + now.getMinutes();

  if (hours.every((d) => d.length === 1 && d[0][0] === 0 && d[0][1] >= 1440)) {
    return { open: true, label: "Open 24 hours", closingSoon: false };
  }

  // Ranges from today, plus yesterday's ranges that spill past midnight.
  const yesterday = hours[(day + 6) % 7].map(([o, c]) => [o - 1440, c - 1440] as TimeRange);
  for (const [o, c] of [...yesterday, ...hours[day]]) {
    if (mins >= o && mins < c) {
      return { open: true, label: `Closes ${formatMinutes(c)}`, closingSoon: c - mins <= 60 };
    }
  }

  const laterToday = hours[day].find(([o]) => o > mins);
  if (laterToday) return { open: false, label: `Opens ${formatMinutes(laterToday[0])}`, closingSoon: false };

  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (hours[d].length) {
      const when = i === 1 ? "tomorrow" : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][d];
      return { open: false, label: `Opens ${when} ${formatMinutes(hours[d][0][0])}`, closingSoon: false };
    }
  }
  return { open: false, label: "Closed", closingSoon: false };
}

/** Is the place open at `minutes` (since midnight) on the current weekday? Used by "open late" filters. */
export function isOpenAt(hours: WeeklyHours | undefined, at: Date): boolean {
  return openStatus(hours, at)?.open ?? false;
}

export const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function describeDay(ranges: TimeRange[]): string {
  if (!ranges.length) return "Closed";
  if (ranges.length === 1 && ranges[0][0] === 0 && ranges[0][1] >= 1440) return "Open 24 hours";
  return ranges.map(([o, c]) => `${formatMinutes(o)} – ${formatMinutes(c)}`).join(", ");
}

export function todayIndex(now = new Date()): number {
  return mondayIndex(now);
}
