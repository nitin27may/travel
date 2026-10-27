// The record rules of S1 and S4 for capture/1, suitability/1 and relevance/1 documents (spec 4.1):
//   units to SI (the source's form in meta.original), currency ISO 4217 with the price year, dates ISO 8601, names as signed and
//   other languages in `names`, `origin` to `meta.origin` (RIS-C), the Estimate flag from a note that says "estimate" (S4).
//
// Every rule is conservative: it changes a value only when the change is unambiguous, and reports a finding (never a guess) when it
// is not. A row the run changes gets a `meta` block started (schema_version 1, run_id), never overwritten.
import { privacyHits } from "../privacy/detect.ts";

/** Capture rows are internal: their real ids are dated refs, which only public output must not hold (public-ref-aliases 6.1). */
const INTERNAL = { datedFolders: false } as const;
import { PROPERTY_BY_KEY } from "../schema/capture/properties.ts";
import { metaFindings } from "../validate/rowMeta.ts";
import { Sink, eachVal, isObj, seg, setMetaKey, startMeta, type Obj } from "./common.ts";
import { normaliseDate, DATE_KEYS } from "./dates.ts";
import { normaliseCurrency } from "./currency.ts";
import { convertText, type Converted } from "./units.ts";

// ---- estimate (S4) ----
const ESTIMATE = /\bestimat(?:e|es|ed|ion)\b/i;
/** "not an estimate", "not part of this estimate", "no estimate": the note denies it. Checked within a short span before the word. */
const DENIED = /\b(?:not|no|never|without|isn't|is not|neither)\b[^.;:]{0,30}\bestimat/i;

/** True when a Val's note says the value is an estimate, in the sense of S4: our own inference, flagged by the word and not denied. */
export function noteSaysEstimate(val: Obj): boolean {
  return val.state === "value" && val.basis === "our_inference" && val.estimate === undefined && typeof val.note === "string" && ESTIMATE.test(val.note) && !DENIED.test(val.note);
}

// ---- names and languages (S1) ----
const LANG_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
/** BCP 47 case: language lower, script (4 letters) Title, region (2 letters or 3 digits) UPPER, the rest lower. */
export function canonicalLanguage(tag: string): string | null {
  const t = tag.trim().replace(/_/g, "-");
  if (!LANG_TAG.test(t)) return null;
  return t
    .split("-")
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.length === 4 && /^[A-Za-z]+$/.test(p) ? p[0]!.toUpperCase() + p.slice(1).toLowerCase() : p.length === 2 || /^\d{3}$/.test(p) ? p.toUpperCase() : p.toLowerCase()))
    .join("-");
}

/** A name as signed: trimmed, one space between words, NFC. Case and punctuation are never touched. */
export const signedName = (s: string): string => s.normalize("NFC").replace(/\s+/g, " ").trim();

// ---- the record walker ----
const UNIT_TARGET_SUFFIX: Readonly<Record<string, string>> = { _km: "km", _m: "m", _cm: "cm", _kg: "kg", _c: "c", _min: "min" };

/** The unit a property key is stored in: the registry's, else the key's suffix. */
function targetUnit(key: string): string | null {
  const reg = PROPERTY_BY_KEY.get(key)?.unit;
  if (reg) return reg === "°C" ? "c" : reg;
  for (const [suf, u] of Object.entries(UNIT_TARGET_SUFFIX)) if (key.endsWith(suf)) return u;
  return null;
}

const OTHER_KEYS = new Set(["meta"]);

/**
 * Applies the record rules to `rec` (one record of `records[]`) in place. `path` is its JSON pointer. `kind` decides which rules apply:
 * `origin` and `names` are capture rules. Returns true when the record changed.
 */
export function normaliseRecord(rec: Obj, path: string, sink: Sink, kind: "capture" | "suitability" | "relevance"): boolean {
  if (rec.meta !== undefined && !isObj(rec.meta)) {
    sink.find("E_NORM_REFUSED", "error", `${path}/meta`, "meta is not an object; the record is left as it is, fix it by hand");
    return false;
  }
  const before = JSON.stringify(rec);
  const originals: Converted[] = [];
  let originMoved: unknown;

  // names as signed
  if (kind === "capture") {
    if (typeof rec.name === "string") {
      const n = signedName(rec.name);
      if (n !== rec.name && n.length > 0) {
        rec.name = n;
        sink.change("name", `${path}/name`);
      }
    }
    if (isObj(rec.names)) {
      const next: Obj = {};
      let changed = false;
      for (const [lang, value] of Object.entries(rec.names)) {
        const canon = canonicalLanguage(lang);
        if (canon === null) {
          sink.find("W_NORM_LANGUAGE", "warn", `${path}/names/${seg(lang)}`, `"${lang}" is not a language tag; left as written`);
          next[lang] = value;
          continue;
        }
        const v = typeof value === "string" ? signedName(value) : value;
        if (canon in next && next[canon] !== v) {
          sink.find("W_NORM_CONFLICT", "warn", `${path}/names`, `two names map to the language "${canon}" with different text; both left as written (conflicts are kept, never picked)`);
          next[lang] = value;
          continue;
        }
        if (canon !== lang) {
          changed = true;
          sink.change("language", `${path}/names/${seg(lang)}`, `${lang} to ${canon}`);
        }
        if (v !== value) {
          changed = true;
          sink.change("name", `${path}/names/${seg(canon)}`);
        }
        next[canon] = v;
      }
      if (changed) rec.names = next;
    }
  }

  // Vals: dates, units, estimate, price year, currency
  eachVal(rec, path, (val, vpath) => {
    const key = vpath.split("/").pop() ?? "";
    if (typeof val.v === "string" && val.state === "value") {
      const target = targetUnit(key);
      const conv = target ? convertText(val.v, target) : null;
      if (conv) {
        if (originals.length === 0) {
          val.v = conv.value;
          originals.push(conv);
          sink.change("unit", `${vpath}/v`, `${conv.unit} to ${target}`);
        } else sink.find("W_NORM_UNIT", "warn", `${vpath}/v`, "a second converted value in one record: meta.original holds one, so this one is left as written");
      }
    }
    if (noteSaysEstimate(val)) {
      val.estimate = true;
      sink.change("estimate", `${vpath}/estimate`, "note says estimate; basis our_inference");
    }
    if (key === "price" && Array.isArray(val.v)) {
      val.v.forEach((row, i) => {
        if (!isObj(row) || typeof row.currency !== "string") return;
        const c = normaliseCurrency(row.currency);
        if (c.code && c.code !== row.currency) {
          row.currency = c.code;
          sink.change("currency", `${vpath}/v/${i}/currency`);
        } else if (!c.code) sink.find("E_NORM_CURRENCY", "error", `${vpath}/v/${i}/currency`, `"${row.currency}" is not an ISO 4217 code`);
      });
      const rowsMissing = val.v.some((r) => isObj(r) && r.applies_to === undefined);
      if (rowsMissing && val.applies_to === undefined && val.state === "value") {
        const year = typeof val.read === "string" && /^\d{4}-/.test(val.read) ? val.read.slice(0, 4) : null;
        if (year) {
          val.applies_to = year;
          sink.change("price_year", `${vpath}/applies_to`, "the year the price was read");
        } else sink.find("W_NORM_PRICE_YEAR", "warn", vpath, "a price with no year and no read date; add applies_to");
      }
    }
  });

  // other date fields (links[].on, researched ...) at record level
  walkDates(rec, path, sink);

  // origin to meta.origin (capture)
  if (kind === "capture" && "origin" in rec) {
    const o = rec.origin;
    const table = rec.layer === "offer" ? "offer" : "entity";
    const candidate: Obj = isObj(rec.meta) ? { ...rec.meta } : { schema_version: 1 };
    const existing = isObj(candidate.origin) ? candidate.origin : undefined;
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(o)) {
      sink.find("W_NORM_CONFLICT", "warn", `${path}/origin`, "the record has an origin and a meta.origin that differ; both left as they are (conflicts are kept, never picked)");
    } else {
      candidate.origin = o;
      const bad = metaFindings(candidate, `${path}/meta`, { table, propertyKeys: new Set(PROPERTY_BY_KEY.keys()) }).filter((f) => !f.warning);
      const hits = privacyHits({ origin: o }, 1, INTERNAL);
      if (bad.length > 0 || hits.length > 0) {
        const why = [...new Set(bad.map((b) => b.code))].concat(hits.length ? ["PRIVACY"] : []).join(", ");
        sink.find("E_NORM_REFUSED", "error", `${path}/origin`, `origin is not moved into meta: it would fail ${why}. A private-list key (loc: or proto:) is never copied; fix the record by hand`);
      } else {
        delete rec.origin;
        originMoved = o;
        sink.change("origin", `${path}/origin`, "to meta.origin");
      }
    }
  }

  // a changed record gets its meta block started (never overwritten), carrying the source form of a converted unit and the origin
  if (JSON.stringify(rec) === before) return false;
  const m = startMeta(rec, sink.run) as Obj;
  sink.change("meta", `${path}/meta`, "started");
  if (originals.length > 0) {
    const orig = originals[0]!;
    if (!setMetaKey(m, "original", { value: orig.original, unit: orig.unit })) sink.find("W_NORM_CONFLICT", "warn", `${path}/meta/original`, "meta.original already holds a different value; left as it is");
  }
  if (originMoved !== undefined) setMetaKey(m, "origin", originMoved);
  return true;
}

/** Date-like fields below a node (links[].on, searched, researched ...), normalised when unambiguous. */
export function walkDates(x: unknown, at: string, sink: Sink): void {
  if (Array.isArray(x)) x.forEach((y, i) => walkDates(y, `${at}/${i}`, sink));
  else if (isObj(x)) {
    for (const [k, y] of Object.entries(x)) {
      if (OTHER_KEYS.has(k)) continue;
      if (typeof y === "string" && DATE_KEYS.has(k)) {
        const r = normaliseDate(y);
        if (r.iso && r.iso !== y) {
          x[k] = r.iso;
          sink.change("date", `${at}/${seg(k)}`);
        } else if (!r.iso && /\d/.test(y)) sink.find("W_NORM_DATE", "warn", `${at}/${seg(k)}`, `"${k}" is not a date the normaliser can read unambiguously; left as written`);
      } else walkDates(y, `${at}/${seg(k)}`, sink);
    }
  }
}
