// suit_level (draft, usable, complete): Usable counts only the R fields of the record's profile (plus `op` fields when it
// is operated), Complete adds the A fields. N is outside the total (suitability-applicability.md A9, 5.4, 6.4).
import type { SuitabilityRecord } from "../schema/suitability.ts";
import { answerOf, applicablePaths, isOperated, isPresent, loadApplicability, markOf, notApplicablePaths, profileOf, requiredPaths, valueAt } from "./applicability.ts";
import type { Applicability, Located } from "./applicability.ts";
import { mergeBlock } from "./merge.ts";

export type SuitLevel = "draft" | "usable" | "complete";

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

export function checkRecord(rec: RecordLike, app: Applicability = loadApplicability()): RecordCheck {
  const located = profileOf(rec, app);
  if (!located) return { located: null, operated: false, level: "draft", missingRequired: [], missingApplicable: [], badExempt: [], naPresent: [] };
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

  const level: SuitLevel = missingRequired.length > 0 ? "draft" : missingApplicable.length > 0 ? "usable" : "complete";
  return { located, operated, level, missingRequired, missingApplicable, badExempt, naPresent };
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
