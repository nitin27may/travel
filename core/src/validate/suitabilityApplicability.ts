// S0b: the applicability rules of suitability/1 records (E_SUIT_SUBKIND, E_SUIT_EXT_KIND, E_SUIT_NA_EXEMPT,
// W_SUIT_NA_FIELD, W_SUIT_BELOW_USABLE, W_SUIT_OPERATED_DEFAULT). Kept apart from validate/suitability.ts so a later
// lane can add its own rules beside it. E_SUIT_PROFILE_MAP is a rule of the applicability file: validate/applicability.ts.
import * as Enums from "../schema/enums.ts";
import type { SuitabilityRecord } from "../schema/suitability.ts";
import { profileOf, subkindsOfKind } from "../suitability/applicability.ts";
import type { Applicability } from "../suitability/applicability.ts";
import { checkRecord } from "../suitability/level.ts";
import { SUIT_APPLICABILITY_MESSAGES as M } from "./messages.ts";

type Emit = (code: string, path: string, message: string) => void;

/** How many unanswered R paths a W_SUIT_BELOW_USABLE message names before it says "+n more". */
const NAMED = 6;

export function checkApplicability(r: SuitabilityRecord, base: string, app: Applicability, E: Emit, W: Emit): void {
  const allowed = subkindsOfKind(app, r.kind);
  if (!r.subkind) {
    E("E_SUIT_SUBKIND", `${base}/subkind`, M.subkindMissing(r.kind, allowed));
    return;
  }
  if (!(Enums.SUIT_SUBKIND as readonly string[]).includes(r.subkind)) {
    E("E_SUIT_SUBKIND", `${base}/subkind`, M.subkindUnknown(r.subkind));
    return;
  }
  const located = profileOf(r, app);
  if (!located) {
    E("E_SUIT_SUBKIND", `${base}/subkind`, M.subkindKind(r.kind, r.subkind, allowed));
    return;
  }
  const { name, profile } = located;

  // the extension, on the record and on each offer
  const exts: [string, { kind: string } | undefined][] = [[`${base}/ext/kind`, r.ext], ...(r.offers ?? []).map((o, j): [string, { kind: string } | undefined] => [`${base}/offers/${j}/ext/kind`, o.ext])];
  for (const [path, x] of exts) if (x && x.kind !== profile.ext) E("E_SUIT_EXT_KIND", path, M.extKind(x.kind, name, profile.ext));

  if (r.operated !== undefined && profile.operated !== "flag") W("W_SUIT_OPERATED_DEFAULT", `${base}/operated`, M.operatedDefault(name, profile.operated));

  const rc = checkRecord(r, app);
  for (const x of rc.badExempt) E("E_SUIT_NA_EXEMPT", `${base}${x.ptr}`, M.naExempt(x.path, name));
  for (const x of rc.naPresent) W("W_SUIT_NA_FIELD", `${base}${x.ptr}`, M.naField(x.path, name));
  if (rc.missingRequired.length > 0) W("W_SUIT_BELOW_USABLE", base, M.belowUsable(name, rc.missingRequired.slice(0, NAMED), rc.missingRequired.length));
}
