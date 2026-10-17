// Which research lanes run for a trip (plan 7.2, 7.3). One function so the UI's "Suggested research", the skills and the
// CLI agree. The result carries a reason for every lane and for every lane that was left out.
import { isCityOver500k } from "./cities.ts";

type Row = Record<string, any>;

export const LANES = [
  "overview", "sights", "hidden-gems", "trails", "adventure", "relax-luxury", "city-culture", "road-trip", "stays", "timing", "logistics", "entry", "fares", "community",
] as const;
export type Lane = (typeof LANES)[number];

export interface LaneChoice {
  lane: Lane;
  reason: string;
}

export interface LaneSelection {
  lanes: LaneChoice[];
  dropped: LaneChoice[];
}

export interface SelectOptions {
  /** longest drive of a day trip, in minutes; the road-trip lane joins a day trip above 90 */
  driveMinutes?: number;
  /** the owner's home country (default CA): the entry lane runs for any other */
  homeCountry?: string;
}

const ACTIVITY_WORDS = /\b(boat|tour|zip|raft|kayak|canoe|glacier|ferrata|climb|cruise|canyon|safari|snorkel|dive|horse|heli|sled|gondola|cave|penguin|wildlife)/i;
const TRAIL_WORDS = /\b(trail|hike|hiking|trek|summit|walk|laguna|mirador|pass)\b/i;

/** the trip pieces this needs; a whole trip document works as is */
export function selectLanes(doc: Row, opts: SelectOptions = {}): LaneSelection {
  const trip: Row = doc.trip ?? {};
  const profile: Row = doc.profile ?? {};
  const home = opts.homeCountry ?? "CA";
  const tags = new Set<string>(((doc.trip_tags ?? []) as Row[]).map((t) => t.tag_id ?? t));
  const styles = new Set<string>([trip.primary_style, ...tags].filter(Boolean));
  const has = (...s: string[]): string | null => s.find((x) => styles.has(x)) ?? null;
  const dayTrip = trip.duration_shape === "day-trip";
  const nights: number = trip.nights ?? 0;
  const countries: string[] = trip.countries ?? [];
  const mustDo: Row[] = profile.must_do ?? [];
  const bases: Row[] = doc.bases ?? [];

  const why = new Map<Lane, string>();
  const no = new Map<Lane, string>();
  const yes = (l: Lane, r: string): void => void why.set(l, r);
  const nope = (l: Lane, r: string): void => void no.set(l, r);

  yes("overview", "every trip");
  yes("timing", "every trip");

  if (dayTrip) {
    // a day trip keeps overview, sights or trails by style, timing and (when the drive is long) road-trip
    if (has("adventure", "active-nature", "scenic-relaxed", "family")) yes("trails", `day trip with style ${has("adventure", "active-nature", "scenic-relaxed", "family")}`);
    else yes("sights", "day trip without a trail style");
    if ((opts.driveMinutes ?? 0) > 90) yes("road-trip", `day trip with a ${opts.driveMinutes} minute drive`);
    for (const l of ["stays", "logistics", "entry", "fares", "community"] as Lane[]) nope(l, "day trips drop this lane");
  } else {
    yes("sights", "every trip except day trips with a trail style");

    const gem = has("hidden-gems") ?? ((profile.pace ?? 5) <= 2 && styles.has("scenic-relaxed") ? "pace 2 or less with scenic-relaxed" : null);
    if (gem) yes("hidden-gems", `style ${gem}`);
    else nope("hidden-gems", "no hidden-gems tag, and not a slow scenic trip");

    const trailStyle = has("adventure", "active-nature", "scenic-relaxed", "family");
    const trailMust = mustDo.find((m) => TRAIL_WORDS.test(m.text ?? "") || /trail/.test(m.ref ?? ""));
    if (trailStyle) yes("trails", `style ${trailStyle}`);
    else if (trailMust) yes("trails", `a must-do is a trail ("${trailMust.text}")`);
    else nope("trails", "no hiking style and no trail among the must-dos");

    const advStyle = has("adventure", "active-nature", "family");
    const activityMust = mustDo.find((m) => ACTIVITY_WORDS.test(m.text ?? ""));
    if (advStyle) yes("adventure", `style ${advStyle}`);
    else if ((profile.kids_mode ?? "none") !== "none" && activityMust) yes("adventure", `children on the trip and a must-do activity ("${activityMust.text}")`);
    else nope("adventure", "no adventure style, and no must-do activity with children");

    const relax = has("luxury-relax", "relax", "romantic") ?? (profile.comfort === "splurge" ? "comfort splurge" : null);
    if (relax) yes("relax-luxury", `style ${relax}`);
    else nope("relax-luxury", "no relax, luxury or romantic style, and comfort is not splurge");

    const bigBase = bases.find((b) => isCityOver500k(String(b.name ?? "")));
    if (styles.has("city-culture")) yes("city-culture", "style city-culture");
    else if (bigBase) yes("city-culture", `base ${bigBase.name} is a city of more than 500,000`);
    else nope("city-culture", "no city-culture style and no base in a city of more than 500,000");

    const rt = trip.movement_shape === "road-trip" || trip.movement_shape === "camper" || styles.has("road-trip");
    if (rt) yes("road-trip", `movement ${trip.movement_shape === "road-trip" || trip.movement_shape === "camper" ? trip.movement_shape : "road-trip style"}`);
    else nope("road-trip", `movement is ${trip.movement_shape ?? "unknown"}; the car, if any, is not the trip`);

    if (nights > 0) {
      yes("stays", `${nights} nights`);
      yes("logistics", `${nights} nights`);
    } else {
      nope("stays", "no nights");
      nope("logistics", "no nights");
    }
    const foreign = countries.filter((c) => c !== home);
    if (foreign.length) yes("entry", `${foreign.join(", ")} is not ${home}`);
    else nope("entry", `only ${home}`);
    const flights = (profile.transport ?? []).includes("domestic-flight") || ((doc.items ?? []) as Row[]).some((i) => i.type === "flight") || foreign.length > 0;
    if (flights || nights >= 2) yes("fares", flights ? "the trip flies" : `${nights} nights`);
    else nope("fares", "no flights and under 2 nights");
    yes("community", "a multi-day trip");
  }

  // the owner's overrides last
  for (const l of (profile.lanes_extra ?? []) as Lane[]) {
    if (LANES.includes(l)) {
      yes(l, "added by profile.lanes_extra");
      no.delete(l);
    }
  }
  for (const l of (profile.lanes_skip ?? []) as Lane[]) {
    if (!LANES.includes(l)) continue;
    const was = why.get(l);
    if (was !== undefined) nope(l, `profile.lanes_skip (it would have run: ${was})`);
    else nope(l, `profile.lanes_skip (${no.get(l) ?? "not selected anyway"})`);
    why.delete(l);
  }
  return {
    lanes: LANES.filter((l) => why.has(l)).map((l) => ({ lane: l, reason: why.get(l)! })),
    dropped: LANES.filter((l) => !why.has(l)).map((l) => ({ lane: l, reason: no.get(l) ?? "not triggered" })),
  };
}
