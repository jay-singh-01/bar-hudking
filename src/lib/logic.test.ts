import { describe, expect, it } from "vitest";
import { emptyUserData, mergeUserData, coerceUserData } from "./store";
import { minutesUntilClose, openStatus, parseGoogleDay, parseOsmHours } from "./hours";
import {
  EMPTY_FILTERS,
  editDistance,
  matchesFilters,
  openForAtLeast,
  priceBand,
  searchScore,
  setSearchCorpus,
  type FilterContext,
} from "./discover";
import { buildTaste, suggestForYou } from "./taste";
import { parseSharedList, parseVoteLink } from "./share";
import { priceForTwoFromRange, priceForTwoFromText, priceLevelFromSymbols } from "../../scripts/lib/price";
import { nameSimilarity } from "../../scripts/lib/normalize";
import type { Place, TimeRange } from "./types";

const place = (over: Partial<Place>): Place => ({
  id: over.id ?? "x",
  name: "Toit",
  type: "brewery",
  lat: 12.97,
  lng: 77.64,
  area: "Indiranagar",
  ...over,
});

const ctx = (over: Partial<FilterContext> = {}): FilterContext => ({
  coords: null,
  spots: [],
  anchors: [],
  visitedIds: new Set(),
  hiddenIds: new Set(),
  now: new Date(2026, 9, 3, 20, 0), // Sat 3 Oct 2026, 8 pm
  ...over,
});

describe("sync merge", () => {
  it("is last-write-wins per record and commutative", () => {
    const a = emptyUserData();
    const b = emptyUserData();
    a.favorites.p1 = { placeId: "p1", updatedAt: 10 };
    b.favorites.p1 = { placeId: "p1", updatedAt: 20, deleted: true };
    a.favorites.p2 = { placeId: "p2", updatedAt: 5 };
    b.plans.x = { id: "x", title: "Fri", placeIds: ["p1"], votes: {}, createdAt: 1, updatedAt: 1 };
    const ab = mergeUserData(a, b);
    expect(ab).toEqual(mergeUserData(b, a));
    expect(ab.favorites.p1.deleted).toBe(true);
    expect(ab.favorites.p2).toBeTruthy();
    expect(ab.plans.x.title).toBe("Fri");
  });

  it("rejects unknown versions and accepts round-tripped data", () => {
    expect(coerceUserData({ version: 2 })).toBeNull();
    expect(coerceUserData(JSON.parse(JSON.stringify(emptyUserData())))).toBeTruthy();
  });
});

describe("opening hours", () => {
  it("parses OSM rules, including PH and spaced ranges", () => {
    const h = parseOsmHours("Mo-Fr 12:00-15:00,19:00-23:30; Sa,Su 12:00-01:00; PH off")!;
    expect(h[0]).toEqual([[720, 900], [1140, 1410]]);
    expect(h[6]).toEqual([[720, 1500]]);
    expect(parseOsmHours("PH,Mo-Su 09:00 - 23:00")![3]).toEqual([[540, 1380]]);
    expect(parseOsmHours("sunrise-sunset")).toBeNull();
  });

  it("parses Google day strings", () => {
    expect(parseGoogleDay("11 am–11:30 pm")).toEqual([[660, 1410]]);
    expect(parseGoogleDay("12–3:30 pm, 7–11 pm")).toEqual([[720, 930], [1140, 1380]]);
    expect(parseGoogleDay("6 pm–1 am")).toEqual([[1080, 1500]]);
  });

  it("treats past-midnight hours as still the previous night", () => {
    const week: TimeRange[][] = Array.from({ length: 7 }, () => []);
    week[4] = [[1080, 1500]]; // Fri 6 pm – 1 am
    expect(openStatus(week, new Date(2026, 9, 3, 0, 30))!.open).toBe(true);
    expect(openStatus(week, new Date(2026, 9, 3, 2, 0))!.open).toBe(false);
    expect(minutesUntilClose(week, new Date(2026, 9, 3, 0, 30))).toBe(30);
  });
});

describe("prices", () => {
  it("turns Google per-person ranges into cost for two", () => {
    expect(priceForTwoFromRange("₹1,000–2,000")).toEqual([2000, 4000]);
    expect(priceLevelFromSymbols("₹₹₹")).toBe(3);
    expect(priceForTwoFromText("about ₹1,500 for two people")).toEqual([1500, 1500]);
    expect(priceForTwoFromText("₹500 per person")).toBeNull();
    expect(priceBand(place({ priceForTwo: [2000, 4000] }))).toBe("luxury");
  });
});

describe("search", () => {
  const toit = place({ cuisine: ["Pizza"], description: "Rustic microbrewery with craft beers" });
  const cafe = place({ id: "c", name: "Third Wave Coffee", type: "cafe", area: "Koramangala" });
  setSearchCorpus([toit, cafe]);

  it("ranks name matches above other matches", () => {
    expect(searchScore(toit, "toit")).toBeGreaterThan(searchScore(toit, "indiranagar"));
    expect(searchScore(toit, "sushi")).toBe(0);
  });

  it("tolerates typos", () => {
    expect(editDistance("koramangla", "koramangala", 2)).toBe(1);
    expect(searchScore(cafe, "koramangla")).toBeGreaterThan(0);
    expect(searchScore(cafe, "cofee")).toBeGreaterThan(0);
  });

  it("understands everyday words", () => {
    expect(searchScore(toit, "beer")).toBeGreaterThan(0);
    expect(searchScore(cafe, "coffee")).toBeGreaterThan(0);
  });
});

describe("filters", () => {
  const lateHours: TimeRange[][] = Array.from({ length: 7 }, () => [[720, 1500]]); // noon – 1 am daily
  const earlyHours: TimeRange[][] = Array.from({ length: 7 }, () => [[480, 1260]]); // 8 am – 9 pm

  it("Tonight keeps places open for at least two more hours", () => {
    expect(openForAtLeast(place({ hours: lateHours }), ctx().now, 120)).toBe(true);
    expect(matchesFilters(place({ hours: lateHours }), { ...EMPTY_FILTERS, tonight: true }, ctx())).toBe(true);
    expect(matchesFilters(place({ hours: earlyHours }), { ...EMPTY_FILTERS, tonight: true }, ctx())).toBe(false);
  });

  it("budget compares the typical cost for two", () => {
    const f = { ...EMPTY_FILTERS, maxBudget: 1500 };
    expect(matchesFilters(place({ priceForTwo: [800, 1400] }), f, ctx())).toBe(true);
    expect(matchesFilters(place({ priceForTwo: [2000, 3000] }), f, ctx())).toBe(false);
    expect(matchesFilters(place({}), f, ctx())).toBe(false);
  });

  it("never shows hidden places", () => {
    expect(matchesFilters(place({ id: "h" }), EMPTY_FILTERS, ctx({ hiddenIds: new Set(["h"]) }))).toBe(false);
  });
});

describe("taste", () => {
  it("suggests places similar to favourites and skips known ones", () => {
    const brew = (id: string, area = "Indiranagar") => place({ id, type: "brewery", area, rating: 4.5, ratingCount: 2000, photo: "x.jpg" });
    const cafe = place({ id: "cafe", type: "cafe", area: "Jayanagar", rating: 4.6, ratingCount: 2000, photo: "x.jpg" });
    const all = [brew("a"), brew("b"), brew("c"), cafe];
    const d = emptyUserData();
    d.favorites.a = { placeId: "a", updatedAt: 1 };
    d.favorites.b = { placeId: "b", updatedAt: 1 };
    const t = buildTaste(d, new Map(all.map((p) => [p.id, p])))!;
    const picks = suggestForYou(all, t, () => true);
    expect(picks[0].id).toBe("c");
    expect(picks.map((p) => p.id)).not.toContain("a");
  });
});

describe("share links", () => {
  it("round-trips list and vote links", () => {
    expect(parseSharedList("?n=Fri&e=x&p=a,b")!.placeIds).toEqual(["a", "b"]);
    const invite = parseVoteLink("?id=p1&t=Dinner&p=a,b,c&by=Nik")!;
    expect(invite.placeIds).toEqual(["a", "b", "c"]);
    expect(invite.reply).toBeUndefined();
    const reply = parseVoteLink("?id=p1&t=Dinner&r=b&from=Asha")!;
    expect(reply.reply).toEqual({ placeId: "b", from: "Asha" });
  });
});

describe("data matching", () => {
  it("matches venue names across sources", () => {
    expect(nameSimilarity("Toit", "Toit Brewpub")).toBeGreaterThanOrEqual(0.67);
    expect(nameSimilarity("Toit", "Truffles")).toBeLessThan(0.5);
  });
});
