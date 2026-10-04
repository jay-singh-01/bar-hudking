import type { Place, PlaceType } from "./types";
import type { UserData } from "./store";
import { live } from "./store";
import { AREAS } from "./areas";

export interface Stats {
  outings: number;
  uniquePlaces: number;
  areasVisited: number;
  totalAreas: number;
  avgSpend: number | null;
  avgRating: number | null;
  thisMonth: number;
  topAreas: { name: string; count: number }[];
  byType: Partial<Record<PlaceType, number>>;
  favorites: number;
  lists: number;
  maxRepeat: number;
  ratedVisits: number;
  streakWeeks: number;
}

/** Local YYYY-MM-DD (toISOString would shift dates across UTC midnight in IST). */
function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Monday of the week containing the date, for "weeks in a row" streaks. */
function weekKey(d: Date) {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return localISO(monday);
}

export function computeStats(data: UserData, byId: Map<string, Place>): Stats {
  const visits = live(data.visits);
  const places = new Map<string, number>();
  for (const v of visits) places.set(v.placeId, (places.get(v.placeId) ?? 0) + 1);

  const areaCounts = new Map<string, number>();
  const byType: Partial<Record<PlaceType, number>> = {};
  for (const id of places.keys()) {
    const p = byId.get(id);
    if (!p) continue;
    if (p.area) areaCounts.set(p.area, (areaCounts.get(p.area) ?? 0) + 1);
    byType[p.type] = (byType[p.type] ?? 0) + 1;
  }

  const spends = visits.map((v) => v.costForTwo).filter((c): c is number => c !== null && c > 0);
  const ratings = visits.map((v) => v.rating).filter((r): r is number => r !== null);
  const month = localISO(new Date()).slice(0, 7);

  // Consecutive weeks (ending this week or last) with at least one outing.
  const weeks = new Set(visits.map((v) => weekKey(new Date(`${v.date}T00:00:00`))));
  let streak = 0;
  const cursor = new Date();
  if (!weeks.has(weekKey(cursor))) cursor.setDate(cursor.getDate() - 7);
  while (weeks.has(weekKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }

  return {
    outings: visits.length,
    uniquePlaces: places.size,
    areasVisited: areaCounts.size,
    totalAreas: AREAS.length,
    avgSpend: spends.length ? spends.reduce((a, b) => a + b, 0) / spends.length : null,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    thisMonth: visits.filter((v) => v.date.startsWith(month)).length,
    topAreas: [...areaCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    byType,
    favorites: live(data.favorites).length,
    lists: live(data.lists).length,
    maxRepeat: Math.max(0, ...places.values()),
    ratedVisits: ratings.length,
    streakWeeks: streak,
  };
}

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  description: string;
  progress: number;
  goal: number;
}

export function badges(s: Stats): Badge[] {
  const b = (id: string, emoji: string, title: string, description: string, progress: number, goal: number): Badge => ({
    id,
    emoji,
    title,
    description,
    progress: Math.min(progress, goal),
    goal,
  });
  return [
    b("first", "🥂", "First round", "Log your first visit", s.outings, 1),
    b("regular", "🪑", "Regular", "Go back to the same place 3 times", s.maxRepeat, 3),
    b("hopper", "🗺️", "Neighbourhood hopper", "Visit places in 5 different areas", s.areasVisited, 5),
    b("explorer", "🧭", "City explorer", "Visit places in 15 different areas", s.areasVisited, 15),
    b("brew", "🍻", "Brewery hopper", "Visit 5 breweries", s.byType.brewery ?? 0, 5),
    b("cafe", "☕", "Café crawler", "Visit 10 cafés", s.byType.cafe ?? 0, 10),
    b("critic", "📝", "Critic", "Rate 10 visits", s.ratedVisits, 10),
    b("curator", "🗂️", "Curator", "Make 3 lists", s.lists, 3),
    b("fifty", "🏅", "Half century", "Try 50 different places", s.uniquePlaces, 50),
    b("streak", "🔥", "On a roll", "Go out 4 weeks in a row", s.streakWeeks, 4),
  ];
}
