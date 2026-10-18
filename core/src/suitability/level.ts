// suit_level (draft, usable_partial, usable, complete): Usable counts only the R fields of the record's profile (plus `op`
// fields when it is operated), Complete adds the A fields. N is outside the total (suitability-applicability.md A9, 5.4, 6.4).
// CF: a record that would be usable or complete drops to usable_partial ("usable, partly unverified") when too many of its
// R fields are soft (`searched_none` or `none_stated`) or when a safety-critical R field is soft (suitability.md 4.1).
import type { SuitabilityRecord } from "../schema/suitability.ts";
import { answerOf, applicablePaths, isValLike, isOperated, isPresent, loadApplicability, markOf, notApplicablePaths, profileOf, requiredPaths, valueAt } from "./applicability.ts";
import type { Applicability, Located } from "./applicability.ts";
import { mergeBlock } from "./merge.ts";
import { LIMIT_FIELDS } from "./types.ts";

export type SuitLevel = "draft" | "usable_partial" | "usable" | "complete";

/** usable_partial needs at least this many R fields, and more than this share of them soft. */
export const PARTIAL_MIN_R = 6;
export const PARTIAL_GAP_SHARE = 0.4;

/** What the level needs of a record: its kind and block, and (optionally) the subkind, operated flag, offers and extension. */
export type RecordLike = Pick<SuitabilityRecord, "kind" | "suitability"> & Partial<Pick<SuitabilityRecord, "subkind" | "ext" | "offers" | "operated">>;

export interface RecordCheck {
  located: Located | null;
  operated: boolean;
  level: SuitLevel;
  /** R paths no unit answers */
  missingRequired: string[];
  /** A paths no unit answers */
  missingApplicable: string[];
  /** R paths that are answered but only softly (`searched_none` or `none_stated`) in every unit that answers them */
  softRequired: string[];
  /** the safety-critical R paths that are soft, or (operated) an age_band that rests on our judgement */
  softSafety: string[];
  /** R or A paths whose state is not_applicable with no note (E_SUIT_NA_EXEMPT) */
  badExempt: { path: string; ptr: string }[];
  /** N paths that hold a value (W_SUIT_NA_FIELD) */
  naPresent: { path: string; ptr: string }[];
}

type Obj = Record<string, unknown>;

/** JSON pointer of a path under a record (or one of its offers). */
export function pointerOf(path: string, base: string): string {
  if (path.startsWith("ext.")) return `${base.replace(/\/suitability$/, "")}/ext/${path.split(".")[2]}`;
  return `${base}/${path.split(".").join("/")}`;
}

type Strength = "firm" | "soft" | "exempt" | "open";

/** Hard limits, water safety and exposure; and, for an operated product, who set the age band. */
export function isSafetyCritical(path: string, operated: boolean): boolean {
  const last = path.split(".").pop()!;
  return (LIMIT_FIELDS as readonly string[]).includes(last) || path === "exposure" || path.startsWith("water_safety.") || (operated && path === "age_band");
}

/** A Val of state `value` whose basis is our judgement or the community, not the operator. */
function ownJudgement(x: unknown): boolean {
  return isValLike(x) && x.state === "value" && (((x as { basis?: string | null }).basis ?? null) === "our_inference" || (x as { basis?: string | null }).basis === "community");
}

/** firm: a value or no_limit; soft: only searched_none or none_stated; exempt: not applicable with a note; open: unanswered. */
function strengthOf(x: unknown): Strength {
  if (x === undefined || x === null) return "open";
  if (isValLike(x)) {
    if (x.state === "value" || x.state === "no_limit") return "firm";
    if (x.state === "searched_none" || x.state === "none_stated") return "soft";
    if (x.state === "not_applicable") return typeof x.note === "string" && x.note.trim().length > 0 ? "exempt" : "open";
    return "open";
  }
  if (typeof x === "object" && !Array.isArray(x)) {
    const subs = Object.values(x as Record<string, unknown>).filter(isValLike).map(strengthOf);
    return subs.length === 0 ? "firm" : strongest(subs);
  }
  return "firm";
}
function strongest(list: Strength[]): Strength {
  for (const want of ["firm", "soft", "exempt"] as const) if (list.includes(want)) return want;
  return "open";
}

/**
 * The suitability slice of the completeness engine (capture contract 5.3). `located` is the contract's marks for the record's type
 * (core/src/capture/engine.ts passes the resolved node); without it the marks come from the applicability file, which the
 * generator writes from the same contract, so both paths count the same cells.
 */
export function checkRecord(rec: RecordLike, app: Applicability = loadApplicability(), given?: Located | null): RecordCheck {
  const located = given === undefined ? profileOf(rec, app) : given;
  if (!located) return { located: null, operated: false, level: "draft", missingRequired: [], missingApplicable: [], softRequired: [], softSafety: [], badExempt: [], naPresent: [] };
  const { profile } = located;
  const operated = isOperated(profile, rec.operated);

  // units: each offer over the record, or the record alone
  const units: { block: Obj; ext: Obj | undefined }[] = (rec.offers && rec.offers.length > 0
    ? rec.offers.map((o) => ({ block: mergeBlock(rec.suitability, o) as unknown as Obj, ext: (o.ext ?? rec.ext) as unknown as Obj | undefined }))
    : [{ block: rec.suitability as unknown as Obj, ext: rec.ext as unknown as Obj | undefined }]);

  const open = (path: string): boolean => units.some((u) => {
    const a = answerOf(valueAt(u.block, u.ext, path));
    return a === "open" || a === "bad_exempt";
  });
  const missingRequired = requiredPaths(profile, operated).filter(open);
  const missingApplicable = applicablePaths(profile, operated).filter(open);

  const badExempt: RecordCheck["badExempt"] = [];
  const naPresent: RecordCheck["naPresent"] = [];
  const own: { base: string; block: Obj; ext: Obj | undefined }[] = [{ base: "/suitability", block: rec.suitability as unknown as Obj, ext: rec.ext as unknown as Obj | undefined }];
  (rec.offers ?? []).forEach((o, j) => own.push({ base: `/offers/${j}/suitability`, block: o.suitability as unknown as Obj, ext: o.ext as unknown as Obj | undefined }));
  const asked = [...requiredPaths(profile, operated), ...applicablePaths(profile, operated)];
  const na = notApplicablePaths(profile, operated);
  for (const u of own) {
    for (const path of asked) if (answerOf(valueAt(u.block, u.ext, path)) === "bad_exempt") badExempt.push({ path, ptr: pointerOf(path, u.base) });
    for (const path of na) if (isPresent(valueAt(u.block, u.ext, path))) naPresent.push({ path, ptr: pointerOf(path, u.base) });
  }

  const required = requiredPaths(profile, operated);
  const stateOf = (path: string): Strength => strongest(units.map((u) => strengthOf(valueAt(u.block, u.ext, path))));
  const softRequired = required.filter((p) => stateOf(p) === "soft");
  const softSafety = required.filter((p) => isSafetyCritical(p, operated) && (stateOf(p) === "soft" || (p === "age_band" && operated && units.every((u) => ownJudgement(valueAt(u.block, u.ext, p))))));
  const counted = required.filter((p) => stateOf(p) !== "exempt");
  const partial = softSafety.length > 0 || (counted.length >= PARTIAL_MIN_R && softRequired.length / counted.length > PARTIAL_GAP_SHARE);

  const level: SuitLevel = missingRequired.length > 0 ? "draft" : partial ? "usable_partial" : missingApplicable.length > 0 ? "usable" : "complete";
  return { located, operated, level, missingRequired, missingApplicable, softRequired, softSafety, badExempt, naPresent };
}

export function suitLevel(rec: RecordLike, app?: Applicability): SuitLevel {
  return checkRecord(rec, app).level;
}

/** The paths a lane researches for a record: the profile's R, A and N lists. */
export function fieldsOf(rec: { kind: string; subkind?: string; operated?: boolean }, app: Applicability = loadApplicability()): { profile: string; operated: boolean; R: string[]; A: string[]; N: string[] } | null {
  const located = profileOf(rec, app);
  if (!located) return null;
  const operated = isOperated(located.profile, rec.operated);
  const all = Object.keys(located.profile.fields);
  const by = (m: "R" | "A" | "N"): string[] => all.filter((p) => markOf(located.profile, p, operated) === m);
  return { profile: located.name, operated, R: by("R"), A: by("A"), N: by("N") };
}
