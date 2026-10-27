// Park visits, derived (protected-area-entry 6.1; owner QP4): which parks and zones a trip enters, on which days and nights, and how
// (day visit, front-country night, backcountry night). Pure: the trip's stops and bases as capture refs in, the graph index's chains
// (entity-graph 6.2) for membership. Explicit `part_of` first, then the park's `covers_areas`; never geometry (QP2). A park the trip only
// drives through has no stop and no base in it and is not a visit until the stored override of P3 (QP4).
//
// Server side only, like the graph index (P9: one data boundary); the web reads the result through the trip's read model. Dateless: day
// and night numbers only.
import type { GraphIndex } from "../graph/build.ts";

export type VisitMode = "day" | "overnight_front" | "overnight_back";
export const VISIT_MODE_ORDER: readonly VisitMode[] = ["day", "overnight_front", "overnight_back"];

/** The kind a park line and the API say, from the `nature.protected.*` leaf. */
export type ParkKind = "national" | "state_provincial" | "conservation" | "reserve" | "forest" | "dark_sky" | "zone";
const KIND_OF_LEAF: Readonly<Record<string, ParkKind>> = {
  national_park: "national", state_provincial_park: "state_provincial", conservation_area: "conservation", nature_reserve: "reserve",
  forest: "forest", dark_sky_site: "dark_sky", zone: "zone",
};

/** What the trip says, as capture refs: a stop per day (any layer), and the base of each night (night n is the night after day n). */
export interface TripPlaces {
  stops: readonly { day: number; ref: string }[];
  nights: readonly { night: number; ref: string }[];
}

export interface ParkVisit {
  /** the park or zone record */
  ref: string;
  name: string;
  kind: ParkKind;
  /** a zone's park (the nearest protected record above it); null for a top-level park */
  parent: string | null;
  /** days with a stop in it and the days of the nights based in it, ascending */
  days: number[];
  /** nights whose base is in it, ascending */
  nights: number[];
  /** the mode of each of `days` */
  byDay: { day: number; mode: VisitMode }[];
  /** the distinct modes, in VISIT_MODE_ORDER */
  modes: VisitMode[];
}

const under = (type: string, prefix: string): boolean => type === prefix || type.startsWith(`${prefix}.`);
const PROTECTED = "nature.protected";
/** A base of these types makes the night a backcountry night (6.1). */
export const BACKCOUNTRY_BASES: readonly string[] = ["stay.camp.backcountry_site", "stay.mountain"];

/** Every park or zone a record lies in or is: the protected records of its chain (6.2), nearest first. */
export function protectedOf(g: GraphIndex, ref: string): string[] {
  return g.chainOf(ref).map((c) => c.ref).filter((r) => {
    const rec = g.recs.get(r);
    return !!rec && under(rec.type, PROTECTED);
  });
}

function kindOf(type: string): ParkKind {
  return KIND_OF_LEAF[type.split(".")[2] ?? ""] ?? "reserve";
}

/**
 * The parks and zones a trip enters (6.1), in the order first entered (then by ref). Mode of a day: the mode of that night when it is
 * based in the park; else the mode of the night before (the morning after a campground night is not a day visit: a day-use permit
 * needed for `day` only does not apply); else `day`. A night is `overnight_back` when its base is a backcountry site or a mountain hut
 * or bivouac, else `overnight_front`.
 */
export function parkVisits(g: GraphIndex, trip: TripPlaces): ParkVisit[] {
  const acc = new Map<string, { days: Set<number>; nights: Map<number, VisitMode> }>();
  const slot = (park: string) => {
    let s = acc.get(park);
    if (!s) acc.set(park, (s = { days: new Set(), nights: new Map() }));
    return s;
  };
  for (const s of trip.stops) for (const p of protectedOf(g, s.ref)) slot(p).days.add(s.day);
  for (const n of trip.nights) {
    const base = g.recs.get(n.ref);
    const mode: VisitMode = base && BACKCOUNTRY_BASES.some((t) => under(base.type, t)) ? "overnight_back" : "overnight_front";
    for (const p of protectedOf(g, n.ref)) {
      const s = slot(p);
      const had = s.nights.get(n.night);
      // two bases on one night (a split party) in one park: the backcountry one decides
      s.nights.set(n.night, had === "overnight_back" ? had : mode);
    }
  }
  const out: ParkVisit[] = [];
  for (const [ref, s] of acc) {
    const rec = g.recs.get(ref)!;
    const nights = [...s.nights.keys()].sort((a, b) => a - b);
    const days = [...new Set([...s.days, ...nights])].sort((a, b) => a - b);
    const byDay = days.map((day) => ({ day, mode: s.nights.get(day) ?? s.nights.get(day - 1) ?? ("day" as VisitMode) }));
    const modes = VISIT_MODE_ORDER.filter((m) => byDay.some((b) => b.mode === m));
    const above = protectedOf(g, ref).filter((r) => r !== ref);
    out.push({ ref, name: rec.name ?? "Unnamed protected area", kind: kindOf(rec.type), parent: kindOf(rec.type) === "zone" ? (above[0] ?? null) : null, days, nights, byDay, modes });
  }
  return out.sort((a, b) => (a.days[0] ?? Infinity) - (b.days[0] ?? Infinity) || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
}
