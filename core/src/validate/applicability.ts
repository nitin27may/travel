// S0b: the rules of data/schema/suitability-applicability.json that the table schema cannot hold. All E_SUIT_PROFILE_MAP:
// the profile list is complete, every field path of the schema is stated for every profile (N is explicit), every
// (kind, subkind) pair maps to exactly one profile, and a profile's extension agrees with the paths it asks for.
import * as Enums from "../schema/enums.ts";
import { APPLICABILITY_PATHS, EXT_KINDS } from "../suitability/paths.ts";
import { SUIT_APPLICABILITY_MESSAGES as M } from "./messages.ts";
import { err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";

type Row = Record<string, unknown>;

const list = (xs: string[], max = 6): string => xs.slice(0, max).join(", ") + (xs.length > max ? `, +${xs.length - max} more` : "");

export function validateApplicabilityRules(doc: Row, ctx: Ctx): void {
  const E = (path: string, what: string): void => err(ctx, "E_SUIT_PROFILE_MAP", path, M.profileMap(what));
  const profiles = isObj(doc.profiles) ? (doc.profiles as Record<string, Row>) : {};
  const names = Object.keys(profiles);

  const missing = (Enums.SUIT_PROFILE as readonly string[]).filter((p) => !names.includes(p));
  const unknown = names.filter((p) => !(Enums.SUIT_PROFILE as readonly string[]).includes(p));
  if (missing.length) E("/profiles", `profiles missing from the file: ${list(missing)}. Every profile of SUIT_PROFILE needs a row. Add them with every field path.`);
  if (unknown.length) E("/profiles", `unknown profile${unknown.length > 1 ? "s" : ""}: ${list(unknown)}. Remove ${unknown.length > 1 ? "them" : "it"}, or add the name to SUIT_PROFILE in core/src/schema/enums.ts.`);

  // each (kind, subkind) pair maps to exactly one profile; every subkind is claimed
  const claims = new Map<string, string[]>();
  for (const [name, p] of Object.entries(profiles)) {
    const match = Array.isArray(p.match) ? (p.match as { kind: string; subkind: string }[]) : [];
    for (const m of match) claims.set(`${m.kind}/${m.subkind}`, [...(claims.get(`${m.kind}/${m.subkind}`) ?? []), name]);
  }
  for (const [pair, who] of claims) if (who.length > 1) E("/profiles", `the pair ${pair} maps to ${who.length} profiles (${who.join(", ")}). A pair maps to exactly one profile. Remove it from all but one.`);
  const claimedSubkinds = new Set([...claims.keys()].map((k) => k.split("/")[1]!));
  const orphan = (Enums.SUIT_SUBKIND as readonly string[]).filter((s) => !claimedSubkinds.has(s));
  if (orphan.length) E("/profiles", `subkind${orphan.length > 1 ? "s" : ""} ${list(orphan)} map to no profile. Add each to the "match" list of one profile.`);

  for (const [name, p] of Object.entries(profiles)) {
    const base = `/profiles/${name}`;
    const fields = isObj(p.fields) ? (p.fields as Record<string, string>) : {};
    const have = Object.keys(fields);
    const lacks = APPLICABILITY_PATHS.filter((x) => !have.includes(x));
    const extra = have.filter((x) => !APPLICABILITY_PATHS.includes(x));
    if (lacks.length) E(`${base}/fields`, `profile "${name}" does not state ${lacks.length} field path${lacks.length > 1 ? "s" : ""}: ${list(lacks)}. Every profile lists every path, so N is explicit. Add them as "N" unless the spec says otherwise.`);
    if (extra.length) E(`${base}/fields`, `profile "${name}" lists path${extra.length > 1 ? "s" : ""} the schema does not have: ${list(extra)}. Remove them, or add the field to core/src/schema/suitability.ts.`);

    // the only extension: the one kind whose paths the profile asks for
    const used = [...new Set(have.filter((x) => x.startsWith("ext.") && fields[x] !== "N").map((x) => x.split(".")[1]!))];
    if (used.length > 1) E(`${base}/ext`, `profile "${name}" asks for fields of more than one extension (${used.join(", ")}). A record has one ext block, so a profile has one extension. Mark the others N.`);
    const want = used[0] ?? null;
    if ((p.ext ?? null) !== want) E(`${base}/ext`, `profile "${name}" says ext ${JSON.stringify(p.ext ?? null)} but its field marks use ${JSON.stringify(want)}. Make them agree.`);
    if (typeof p.ext === "string" && !EXT_KINDS.includes(p.ext)) E(`${base}/ext`, `profile "${name}" names ext "${p.ext}", which is not an extension of suitability/1. The extensions are ${list(EXT_KINDS, 20)}.`);

    // operated: a profile that is never operated asks for no participation field
    if (p.operated === "never") {
      const asks = have.filter((x) => x.startsWith("participation.") && fields[x] !== "N");
      if (asks.length) E(`${base}/operated`, `profile "${name}" is never operated but asks for ${list(asks)}. Mark them N, or set operated to "flag" or "always".`);
    }
  }

  const labels = isObj(doc.f_labels) ? Object.keys(doc.f_labels as Row) : [];
  const stray = labels.filter((x) => !APPLICABILITY_PATHS.includes(x));
  if (stray.length) E("/f_labels", `f_labels names path${stray.length > 1 ? "s" : ""} the schema does not have: ${list(stray)}. Remove them.`);
}
