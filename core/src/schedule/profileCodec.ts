// URL state for the profile, overrides and additions (spec 3.8). Pure, so the planner can reuse it. Keys are written in a
// fixed order and defaults are left out; an unknown or invalid value falls back to the default without an error.
import { DEFAULT_PROFILE, type Pace, type Profile } from "./types.ts";

export interface TimelineUrlState {
  profile: Profile;
  /** Day number -> variant key (d=5C). */
  overrides: Record<number, string>;
  /** Visitor additions in insertion order (add=5.pyramid-lake). */
  added: { day: number; slug: string }[];
}

/** The keys this codec owns, in output order. `view` stays with useTripUrl. */
export const PROFILE_KEYS = ["p", "pace", "a", "walk", "split", "d", "add"] as const;

const PACES: readonly Pace[] = ["relaxed", "standard", "full"];
const WALKS = [5, 8, 12];
/** The adult count a link may carry (Q296, 26 Oct 2026): 1 to 12. Children's ages never enter the codec; `p=family-<n>` carries the youngest only. */
export const MIN_ADULTS = 1;
export const MAX_URL_ADULTS = 12;
/** `a=<n>` as a whole number 1 to 12 with no sign, leading zero or decimal; anything else is not a count. */
export const parseAdults = (v: string | null): number | null => (v !== null && /^(?:[1-9]|1[0-2])$/.test(v) ? Number(v) : null);

/** Parses `p=family-6&pace=relaxed&a=3&walk=8&split=1&d=5C,9A&add=5.moraine-lake`. */
export function parseTimelineUrl(query: URLSearchParams | string, defaults: Profile = DEFAULT_PROFILE): TimelineUrlState {
  const q = typeof query === "string" ? new URLSearchParams(query) : query;
  const get = (k: string): string | null => q.get(k);
  const profile: Profile = { ...defaults };
  const p = get("p");
  if (p === "adults") {
    profile.party = "adults";
    profile.youngest = null;
  } else if (p) {
    const mm = /^family-(\d{1,2})$/.exec(p);
    if (mm && Number(mm[1]) <= 17) {
      profile.party = "family";
      profile.youngest = Number(mm[1]);
    }
  }
  const pace = get("pace");
  if (pace && PACES.includes(pace as Pace)) profile.pace = pace as Pace;
  // `a=1` (the only value before Q296) still means one adult; `a=2` to `a=12` are the exact count (spec 5.4, codec change)
  const adults = parseAdults(get("a"));
  if (adults !== null) profile.adults = adults;
  const walk = Number(get("walk"));
  if (WALKS.includes(walk)) profile.walkKm = walk;
  if (get("split") === "1") profile.split = true;
  const overrides: Record<number, string> = {};
  for (const part of (get("d") ?? "").split(",")) {
    const mm = /^(\d{1,2})([ABC])$/.exec(part.trim());
    if (mm) overrides[Number(mm[1])] = mm[2]!;
  }
  const added: TimelineUrlState["added"] = [];
  for (const part of (get("add") ?? "").split(",")) {
    const mm = /^(\d{1,2})\.([a-z0-9][a-z0-9-]*)$/.exec(part.trim());
    if (mm) added.push({ day: Number(mm[1]), slug: mm[2]! });
  }
  return { profile, overrides, added };
}

/** Serialises to a query string without the leading `?`, defaults omitted, in the order of PROFILE_KEYS. */
export function serialiseTimelineUrl(state: TimelineUrlState, defaults: Profile = DEFAULT_PROFILE): string {
  const out: string[] = [];
  const { profile: p } = state;
  const who = (x: Profile): string => (x.party === "adults" ? "adults" : `family-${x.youngest ?? 0}`);
  if (who(p) !== who(defaults)) out.push(`p=${who(p)}`);
  if (p.pace !== defaults.pace) out.push(`pace=${p.pace}`);
  // the exact count when it differs from the trip's default (2 on every trip today); out of range is never written
  if (p.adults !== defaults.adults && parseAdults(String(p.adults)) !== null) out.push(`a=${p.adults}`);
  if (p.walkKm !== defaults.walkKm && p.walkKm !== null) out.push(`walk=${p.walkKm}`);
  if (p.split !== defaults.split && p.split) out.push("split=1");
  const d = Object.entries(state.overrides).map(([n, k]) => [Number(n), k] as const).sort((a, b) => a[0] - b[0]);
  if (d.length) out.push(`d=${d.map(([n, k]) => `${n}${k}`).join(",")}`);
  if (state.added.length) out.push(`add=${state.added.map((a) => `${a.day}.${a.slug}`).join(",")}`);
  return out.join("&");
}

/** True when anything differs from the defaults: the Reset link shows. */
export const isChanged = (state: TimelineUrlState, defaults: Profile = DEFAULT_PROFILE): boolean => serialiseTimelineUrl(state, defaults) !== "";
