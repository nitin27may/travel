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

const get = (q: URLSearchParams | string, key: string): string | null => (typeof q === "string" ? new URLSearchParams(q) : q).get(key);

/** Parses `p=family-6&pace=relaxed&a=1&walk=8&split=1&d=5C,9A&add=5.moraine-lake`. */
export function parseTimelineUrl(query: URLSearchParams | string, defaults: Profile = DEFAULT_PROFILE): TimelineUrlState {
  const q = typeof query === "string" ? new URLSearchParams(query) : query;
  const profile: Profile = { ...defaults };
  const p = get(q, "p");
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
  const pace = get(q, "pace");
  if (pace && (PACES as readonly string[]).includes(pace)) profile.pace = pace as Pace;
  if (get(q, "a") === "1") profile.adults = 1;
  const walk = Number(get(q, "walk"));
  if (WALKS.includes(walk)) profile.walkKm = walk;
  if (get(q, "split") === "1") profile.split = true;
  const overrides: Record<number, string> = {};
  for (const part of (get(q, "d") ?? "").split(",")) {
    const mm = /^(\d{1,2})([ABC])$/.exec(part.trim());
    if (mm) overrides[Number(mm[1])] = mm[2]!;
  }
  const added: TimelineUrlState["added"] = [];
  for (const part of (get(q, "add") ?? "").split(",")) {
    const mm = /^(\d{1,2})\.([a-z0-9][a-z0-9-]*)$/.exec(part.trim());
    if (mm) added.push({ day: Number(mm[1]), slug: mm[2]! });
  }
  return { profile, overrides, added };
}

/** Serialises to a query string without the leading `?`, defaults omitted, in the order of PROFILE_KEYS. */
export function serialiseTimelineUrl(state: TimelineUrlState, defaults: Profile = DEFAULT_PROFILE): string {
  const out: string[] = [];
  const { profile: p } = state;
  const party = p.party === "adults" ? "adults" : `family-${p.youngest ?? 0}`;
  const dparty = defaults.party === "adults" ? "adults" : `family-${defaults.youngest ?? 0}`;
  if (party !== dparty) out.push(`p=${party}`);
  if (p.pace !== defaults.pace) out.push(`pace=${p.pace}`);
  if (p.adults !== defaults.adults && p.adults === 1) out.push("a=1");
  if (p.walkKm !== defaults.walkKm && p.walkKm !== null) out.push(`walk=${p.walkKm}`);
  if (p.split !== defaults.split && p.split) out.push("split=1");
  const d = Object.entries(state.overrides).map(([n, k]) => [Number(n), k] as const).sort((a, b) => a[0] - b[0]);
  if (d.length) out.push(`d=${d.map(([n, k]) => `${n}${k}`).join(",")}`);
  if (state.added.length) out.push(`add=${state.added.map((a) => `${a.day}.${a.slug}`).join(",")}`);
  return out.join("&");
}

/** True when anything differs from the defaults: the Reset link shows. */
export const isChanged = (state: TimelineUrlState, defaults: Profile = DEFAULT_PROFILE): boolean => serialiseTimelineUrl(state, defaults) !== "";
