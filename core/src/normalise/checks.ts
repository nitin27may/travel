// What a document looks like AFTER the rules: the findings the normaliser reports but does not change (S3, S6, S7).
//   - the keep and meta passes of core/src/validate/keep.ts (E_NOTE_LONG, E_SUMMARY_LONG, W_QUOTE_LONG, E_META_*), by code;
//   - E_KEEP_UNKNOWN: a capture record key outside the keep rule;
//   - W_KEEP_UNREAD: trip-level keys no adapter reads (tripLevel.ts);
//   - the privacy detector on every record or row, with `meta` and `notes_private` (private keys of served bodies) taken out,
//     because those two are checked by the meta pass instead;
//   - S3 conflicts: every Val.conflicts is counted and kept; a shown value whose basis is weaker than a losing reading's is reported.
import { privacyHits } from "../privacy/detect.ts";
import { keepFindings, unknownRecordKeys } from "../validate/keep.ts";
import { Sink, eachVal, isObj, seg, type Obj } from "./common.ts";
import { unreadKeys } from "./tripLevel.ts";
import type { Family } from "./types.ts";

const STRONG = new Set(["official_rule", "official_grade", "official_info", "operator_rule", "operator_info"]);

const withoutOwn = (o: Obj): Obj => {
  const { meta: _m, notes_private: _n, ...rest } = o;
  return rest;
};

/** Runs every post-rule check on `doc` (already normalised) and reports to `sink`. */
export function checkDocument(doc: Obj, family: Family, root: string | null, sink: Sink): void {
  for (const f of keepFindings(doc, root)) sink.find(f.code, f.warning ? "warn" : "error", f.path, f.message);

  if (family === "capture" && Array.isArray(doc.records)) {
    doc.records.forEach((r, i) => {
      if (!isObj(r)) return;
      for (const k of unknownRecordKeys(r)) sink.find("E_KEEP_UNKNOWN", "error", `/records/${i}/${seg(k)}`, `"${k}" is not a registry property, a capture/1 schema key or a reserved meta key (spec 2)`);
    });
  }

  if (family === "windows" || family === "base-plans" || family === "seasons") unreadKeys(doc, family, sink);

  // privacy, per row so a hit names the row
  const rows: [string, Obj][] = [];
  if (Array.isArray(doc.records)) doc.records.forEach((r, i) => isObj(r) && rows.push([`/records/${i}`, r]));
  else if (isObj(doc.points)) for (const [ref, r] of Object.entries(doc.points)) isObj(r) && rows.push([`/points/${seg(ref)}`, r]);
  else if (Array.isArray(doc.operators)) doc.operators.forEach((r, i) => isObj(r) && rows.push([`/operators/${i}`, r]));
  else {
    // trip-level and track files: the document without its envelope key `trip` (a trip id is the file's own name)
    const { trip: _t, ...rest } = withoutOwn(doc);
    rows.push(["", rest]);
  }
  for (const [at, row] of rows) {
    for (const h of privacyHits(withoutOwn(row), 3)) {
      // the planning-note rule also reads a business's street address; text already in a source file is a warning, any other hit is an error
      const soft = h.why === "a household planning note";
      sink.find(soft ? "W_NORM_PRIVACY" : "E_NORM_PRIVACY", soft ? "warn" : "error", `${at}${h.where.replace(/^\$/, "")}`, `the privacy detector: ${h.why}`);
    }
  }

  // S3: conflicts are kept; the shown value is the official or operator reading
  eachVal(doc, "", (val, path) => {
    if (!Array.isArray(val.conflicts) || val.conflicts.length === 0) return;
    sink.find("I_NORM_CONFLICT_KEPT", "info", path, `${val.conflicts.length} losing reading(s) kept in Val.conflicts`);
    const shown = typeof val.basis === "string" ? val.basis : null;
    const loser = val.conflicts.some((c) => isObj(c) && typeof c.basis === "string" && STRONG.has(c.basis));
    if (loser && shown !== null && !STRONG.has(shown)) sink.find("W_NORM_CONFLICT_SHOWN", "warn", path, `the shown value's basis (${shown}) is weaker than a losing reading's; S3 shows the official or operator reading (research README 7)`);
  });
}
