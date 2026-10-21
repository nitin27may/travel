// The applicability file (data/schema/suitability-applicability.json) as typed data, plus the lookups that read it:
// which profile a record has, and whether a field path is R, A or N for it (research/method/suitability-applicability.md).
//
// Every consumer reads the table through this module: the validator (W_SUIT_NA_FIELD, suit_level), derive (suit_level,
// the family effort), gates (which checks apply), the projections (N fields are skipped) and the lane briefs (`fields`).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import defaultJson from "../../../data/schema/suitability-applicability.json" with { type: "json" };

/** A cell of the file. `op` is R when the record is operated, otherwise N. */
export type Mark = "R" | "A" | "N" | "op";
/** A cell after the `operated` layer is applied. */
export type Resolved = "R" | "A" | "N";
export type OperatedMode = "always" | "never" | "flag";

export interface Profile {
  match: { kind: string; subkind: string }[];
  operated: OperatedMode;
  /** the only `ext.kind` allowed on this profile, or null */
  ext: string | null;
  fields: Record<string, Mark>;
}
export interface Applicability {
  schema_version: number;
  updated: string;
  note: string;
  f_labels: Record<string, string>;
  profiles: Record<string, Profile>;
}

export const DEFAULT_APPLICABILITY = defaultJson as unknown as Applicability;

/** The file under `root`, or the one shipped with the code when the root has none (test roots). */
export function loadApplicability(root?: string): Applicability {
  if (!root) return DEFAULT_APPLICABILITY;
  const p = join(root, "data", "schema", "suitability-applicability.json");
  if (!existsSync(p)) return DEFAULT_APPLICABILITY;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Applicability;
  } catch {
    return DEFAULT_APPLICABILITY;
  }
}

/** profile name -> every (kind, subkind) pair it claims, and the inverse for lookups */
function indexOf(app: Applicability): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const [name, p] of Object.entries(app.profiles)) {
    for (const m of p.match) {
      const key = `${m.kind}/${m.subkind}`;
      idx.set(key, [...(idx.get(key) ?? []), name]);
    }
  }
  return idx;
}
const indexCache = new WeakMap<Applicability, Map<string, string[]>>();
function pairIndex(app: Applicability): Map<string, string[]> {
  let idx = indexCache.get(app);
  if (!idx) {
    idx = indexOf(app);
    indexCache.set(app, idx);
  }
  return idx;
}

/** Profile names that claim a (kind, subkind) pair: none, one, or (a file error) several. */
export function profilesClaiming(app: Applicability, kind: string, subkind: string): string[] {
  return pairIndex(app).get(`${kind}/${subkind}`) ?? [];
}

/** The subkinds a kind accepts, for messages. */
export function subkindsOfKind(app: Applicability, kind: string): string[] {
  const out: string[] = [];
  for (const p of Object.values(app.profiles)) for (const m of p.match) if (m.kind === kind) out.push(m.subkind);
  return out;
}

export interface Located {
  name: string;
  profile: Profile;
}

/** The profile of a (kind, subkind) pair, or null when the record has no valid subkind. */
export function profileOfPair(kind: string, subkind: string | undefined, app: Applicability = DEFAULT_APPLICABILITY): Located | null {
  if (!subkind) return null;
  const hit = profilesClaiming(app, kind, subkind)[0];
  return hit ? { name: hit, profile: app.profiles[hit]! } : null;
}

export function profileOf(rec: { kind: string; subkind?: string }, app: Applicability = DEFAULT_APPLICABILITY): Located | null {
  return profileOfPair(rec.kind, rec.subkind, app);
}

/** True when the operator layer is on: fixed by the profile, or the record's own `operated` flag for a `flag` profile. */
export function isOperated(profile: Profile, flag: boolean | undefined): boolean {
  return profile.operated === "always" ? true : profile.operated === "never" ? false : flag === true;
}

/** R, A or N for a path. The `operated` layer turns `op` into R or N, and every participation cell into N when not operated. */
export function markOf(profile: Profile, path: string, operated: boolean): Resolved {
  const raw = profile.fields[path];
  if (raw === undefined) return "N";
  if (raw === "op") return operated ? "R" : "N";
  if (path.startsWith("participation.") && !operated) return "N";
  return raw;
}

function pathsWhere(profile: Profile, operated: boolean, want: Resolved): string[] {
  return Object.keys(profile.fields).filter((p) => markOf(profile, p, operated) === want);
}
export const requiredPaths = (profile: Profile, operated: boolean): string[] => pathsWhere(profile, operated, "R");
export const applicablePaths = (profile: Profile, operated: boolean): string[] => pathsWhere(profile, operated, "A");
export const notApplicablePaths = (profile: Profile, operated: boolean): string[] => pathsWhere(profile, operated, "N");

/** True when the profile asks for the path at all (R or A). */
export const applies = (profile: Profile | undefined, path: string, operated: boolean): boolean =>
  !profile || markOf(profile, path, operated) !== "N";

/** The paths that make up the effort checks, F7. */
export const EFFORT_PATHS = ["effort.source_grade", "effort.drivers.distance_km", "effort.drivers.gain_m"] as const;

/**
 * Whether the profile has a family effort. True when it asks for a published grade (trails, ferrata, mtb), or when its
 * grade is the water class (A10: paddling). A boat records a class as advice only and has no effort.
 */
export function hasEffort(profile: Profile | undefined, operated: boolean): boolean {
  if (!profile) return true;
  return markOf(profile, "effort.source_grade", operated) !== "N" || markOf(profile, "water_safety.class", operated) === "R";
}

/** True for the paddle profiles whose effort grade is `water_safety.class` (A10). */
export const gradeIsWaterClass = (profile: Profile | undefined, operated: boolean): boolean =>
  !!profile && markOf(profile, "effort.source_grade", operated) === "N" && markOf(profile, "water_safety.class", operated) === "R";

// ---- reading a path from a record --------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);

/** The raw value at a path of a block (and its extension). `ext.<kind>.<field>` reads the extension only when its kind matches. */
export function valueAt(block: Obj, ext: Obj | undefined, path: string): unknown {
  if (path.startsWith("ext.")) {
    const [, kind, field] = path.split(".");
    return ext && ext.kind === kind ? ext[field!] : undefined;
  }
  let cur: unknown = block;
  for (const part of path.split(".")) {
    if (!isObj(cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

export const isValLike = (x: unknown): x is { v: unknown; state: string; note?: string } => isObj(x) && "state" in x && "v" in x && "src" in x;

export type Answer = "answered" | "exempt" | "bad_exempt" | "open";

/**
 * Whether a field is answered. A `value`, `no_limit`, `none_stated` or `searched_none` is; a `gap` is not. A `not_applicable` with a
 * note is a per-record exemption (A9) and counts as answered; without a note it is an error and stays open.
 */
export function answerOf(x: unknown): Answer {
  if (x === undefined || x === null) return "open";
  if (isValLike(x)) {
    if (x.state === "value" || x.state === "no_limit" || x.state === "none_stated" || x.state === "searched_none") return "answered";
    if (x.state === "not_applicable") return typeof x.note === "string" && x.note.trim().length > 0 ? "exempt" : "bad_exempt";
    return "open";
  }
  if (typeof x === "string") return x.length > 0 ? "answered" : "open";
  if (Array.isArray(x)) return x.length > 0 ? "answered" : "open";
  if (isObj(x)) {
    const vals = Object.values(x);
    if (vals.length === 0) return "open";
    const subs = vals.filter(isValLike);
    return subs.length === 0 || subs.some((s) => answerOf(s) === "answered" || answerOf(s) === "exempt") ? "answered" : "open";
  }
  return "answered";
}

/** True when a field carries content: anything but absent or a bare `gap`. This is what makes an N field a warning. */
export function isPresent(x: unknown): boolean {
  if (x === undefined || x === null) return false;
  if (isValLike(x)) return x.state !== "gap";
  if (isObj(x)) return Object.values(x).some(isPresent);
  if (Array.isArray(x)) return x.length > 0;
  return true;
}

/** A copy of `obj` without the value at `parts`; an object left empty by the removal is removed too. The input is not changed. */
function without(obj: Obj, parts: string[]): Obj {
  const [head, ...rest] = parts as [string, ...string[]];
  if (!(head in obj)) return obj;
  if (rest.length === 0) {
    const copy = { ...obj };
    delete copy[head];
    return copy;
  }
  const child = obj[head];
  if (!isObj(child)) return obj;
  const next = without(child, rest);
  if (next === child) return obj;
  const copy = { ...obj };
  if (Object.keys(next).length === 0) delete copy[head];
  else copy[head] = next;
  return copy;
}

/**
 * A copy of a block with every field the profile marks N removed, so a projection never reads a field that does not
 * apply to the kind (the flat copy, projectForSchedule and the gates). The input is not changed.
 */
export function maskNotApplicable<B extends Obj>(block: B, located: Located | null, flag: boolean | undefined): B {
  if (!located) return block;
  const operated = isOperated(located.profile, flag);
  let out: Obj = block;
  for (const path of notApplicablePaths(located.profile, operated)) {
    if (!path.startsWith("ext.")) out = without(out, path.split("."));
  }
  return out as B;
}
