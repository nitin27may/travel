// Validator for suitability/1 files (E_SUIT_* and W_SUIT_*). Structure comes from the Zod schema; this file adds the
// rules a schema cannot hold: bases of hard limits, sources, units, ranges, grades, refs, computed fields.
import { z } from "zod";
import { tableOf } from "../schema/index.ts";
import { deriveEffort, projectFlat } from "../suitability/derive.ts";
import { gradesOf, loadMap } from "../suitability/map.ts";
import type { DifficultyMap } from "../suitability/map.ts";
import { loadApplicability } from "../suitability/applicability.ts";
import { RefResolver } from "../suitability/refs.ts";
import { LIMIT_FIELDS, RULE_BASES, SECOND_RULE_FIELDS } from "../suitability/types.ts";
import type { SuitabilityDoc, SuitabilityRecord } from "../schema/suitability.ts";
import { SUIT_MESSAGES as M } from "./messages.ts";
import { checkApplicability } from "./suitabilityApplicability.ts";
import { err, isObj } from "./rows.ts";
import type { Ctx, Row } from "./rows.ts";

export interface SuitOptions {
  /** ISO date used for staleness; default SUITABILITY_TODAY or the real date */
  today?: string;
}

/** Hosts whose figures are never a source (K10, spec 3.4). Trailforks is allowed as `community` only. */
const LINK_ONLY_HOSTS: [RegExp, string][] = [
  [/(^|\.)alltrails\.com$/, "AllTrails"],
  [/(^|\.)komoot\.[a-z.]+$/, "Komoot"],
  [/(^|\.)gaiagps\.com$/, "Gaia GPS"],
  [/(^|\.)outdooractive\.com$/, "Outdooractive"],
  [/(^|\.)wikiloc\.com$/, "Wikiloc"],
  [/(^|\.)strava\.com$/, "Strava"],
  [/(^|\.)hikingproject\.com$/, "Hiking Project"],
  [/(^|\.)mtbproject\.com$/, "MTB Project"],
  [/(^|\.)fatmap\.com$/, "FATMAP"],
  [/(^|\.)maps\.me$/, "maps.me"],
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)tripadvisor\.[a-z.]+$/, "Tripadvisor"],
  [/(^|\.)booking\.com$/, "Booking.com"],
  [/(^|\.)(viator|getyourguide|expedia|airbnb)\.[a-z.]+$/, "a booking site"],
];
const TRAILFORKS = /(^|\.)trailforks\.com$/;

const TYPED_EFFORT_KEYS = ["family_effort", "terrain", "terrain_basis", "effort_km", "band"];
const FRESH_DAYS = { limit: 365, grade: 1095, season: 365, facility: 730 };
const UNIT_RE = /\d\s*(lbs?|pounds?|in|inch(?:es)?|"|ft|feet|foot|mi|miles?)(?![a-z])/i;

type AnyVal = {
  v: unknown;
  state: string;
  basis: string | null;
  src: string[];
  read?: string;
  quote?: string;
  note?: string;
  tried?: string[];
  on?: string;
  conflicts?: { v: unknown; basis: string; src: string[] }[];
};

const isVal = (x: unknown): x is AnyVal => isObj(x) && "v" in x && "state" in x && "src" in x;

function describeIssue(issue: z.core.$ZodIssue): string {
  const path = "/" + issue.path.join("/");
  const field = String(issue.path[issue.path.length - 1] ?? "the file");
  switch (issue.code) {
    case "invalid_value":
      return `${path}: "${field}" must be one of ${(issue.values ?? []).map((v) => JSON.stringify(v)).join(", ")}. Example: ${JSON.stringify(issue.values?.[0] ?? "...")}.`;
    case "invalid_type":
      return `${path}: "${field}" must be a ${issue.expected}. Example: use the shape in data/suitability/README.md.`;
    case "unrecognized_keys":
      return `${path}: unknown key${issue.keys.length > 1 ? "s" : ""} ${issue.keys.map((k) => `"${k}"`).join(", ")}. Remove ${issue.keys.length > 1 ? "them" : "it"} or check the spelling against data/schema/generated/schema.json.`;
    case "invalid_format":
      return `${path}: "${field}" is not in the expected format. Example: a date is "2026-10-18".`;
    default:
      return `${path}: "${field}" ${issue.message}. Example: see data/suitability/README.md.`;
  }
}

function daysBetween(a: string, b: string): number {
  return Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function validateSuitability(doc: unknown, ctx: Ctx, opts: SuitOptions = {}): void {
  const root = ctx.refs.root;
  const E = (code: string, path: string, message: string): void => err(ctx, code, path, message);
  const W = (code: string, path: string, message: string): void => void ctx.warnings.push({ code, path, message });
  if (!isObj(doc)) {
    E("E_SUIT_SCHEMA", "", "the file must be one JSON object with schema, trip, lane, researched, agent, model, sources and records.");
    ctx.schemaBroken = true;
    return;
  }

  // family_effort and its computed siblings are never typed: report them, then parse without them
  const clone = structuredClone(doc) as Row;
  const recs0 = Array.isArray(clone.records) ? (clone.records as unknown[]) : [];
  recs0.forEach((r, i) => {
    if (!isObj(r)) return;
    const blocks: [string, unknown][] = [[`/records/${i}/suitability`, r.suitability]];
    if (Array.isArray(r.offers)) r.offers.forEach((o, j) => isObj(o) && blocks.push([`/records/${i}/offers/${j}/suitability`, o.suitability]));
    for (const [p, b] of blocks) {
      const eff = isObj(b) ? b.effort : undefined;
      if (!isObj(eff)) continue;
      for (const k of TYPED_EFFORT_KEYS) {
        if (k in eff) {
          E("E_SUIT_TYPED_EFFORT", `${p}/effort/${k}`, M.typedEffort(k));
          delete eff[k];
        }
      }
    }
  });

  const t = tableOf("sidecar", "suitability");
  const parsed = t.schema.safeParse(clone);
  let broken = false;
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const p = issue.path;
      if (p[0] === "sources" && typeof p[1] === "number" && p[2] === "read") {
        E("E_SUIT_SRC_READ", "/" + p.slice(0, 3).join("/"), M.srcRead(String((clone.sources as Row[])?.[p[1]]?.id ?? p[1])));
      } else {
        E("E_SUIT_SCHEMA", "/" + p.join("/"), describeIssue(issue));
        broken = true;
      }
    }
  }
  if (broken) {
    ctx.schemaBroken = true;
    return;
  }
  if (!parsed.success) return; // only src-read problems remain; the rest of the file cannot be trusted without dates

  const d = parsed.data as unknown as SuitabilityDoc;
  const map: DifficultyMap = loadMap(root);
  const app = loadApplicability(root);
  const today = opts.today ?? process.env.SUITABILITY_TODAY ?? new Date().toISOString().slice(0, 10);

  // ---- sources ----
  const ids = new Set<string>();
  d.sources.forEach((s, i) => {
    if (ids.has(s.id)) E("E_SUIT_SRC", `/sources/${i}/id`, `source id "${s.id}" appears twice. Give each source its own id. Example: "src-0002".`);
    ids.add(s.id);
    let host = "";
    try {
      host = new URL(s.url).hostname.toLowerCase();
    } catch {
      /* a repo path (kind computed) has no host */
    }
    const hit = LINK_ONLY_HOSTS.find(([re]) => re.test(host));
    if (hit) E("E_SUIT_LINK_ONLY_SRC", `/sources/${i}/url`, M.linkOnly(s.id, hit[1]));
  });
  const trailforksIds = new Set(d.sources.filter((s) => { try { return TRAILFORKS.test(new URL(s.url).hostname.toLowerCase()); } catch { return false; } }).map((s) => s.id));
  const readOfSrc = new Map(d.sources.map((s) => [s.id, s.read]));

  // ---- refs ----
  const resolver = new RefResolver(root);
  const seenRef = new Map<string, number>();
  d.records.forEach((r, i) => {
    const why = resolver.why(r.ref);
    if (why) E("E_SUIT_REF", `/records/${i}/ref`, M.ref(r.ref, why));
    const first = seenRef.get(r.ref);
    if (first !== undefined) E("E_SUIT_DUP_REF", `/records/${i}/ref`, M.dupRef(r.ref, `records ${first} and ${i} of this file`));
    else seenRef.set(r.ref, i);
  });

  // ---- values ----
  const checkVal = (v: AnyVal, path: string, field: string, limit: "rule" | "group" | null, cls: keyof typeof FRESH_DAYS | null): void => {
    // state against v and basis
    if (v.state === "value") {
      if (v.v === null) E("E_SUIT_SCHEMA", path, M.schema(path, `"${field}" has state "value" but v is null. Give v, or use another state. Example: {"v": 8, "state": "value"}.`));
      if (v.basis === null) E("E_SUIT_SCHEMA", `${path}/basis`, M.schema(`${path}/basis`, `"${field}" has a value but no basis. Say what it rests on. Example: "basis": "operator_rule".`));
    } else if (v.v !== null) {
      E("E_SUIT_SCHEMA", path, M.schema(path, `"${field}" has state "${v.state}" so v must be null. Move the figure to "conflicts" or set state "value". Example: {"v": null, "state": "searched_none"}.`));
    }
    if (v.state === "no_limit") {
      if (v.basis === null) E("E_SUIT_SCHEMA", `${path}/basis`, M.schema(`${path}/basis`, `"${field}" is no_limit but names no basis: whose statement is it? Example: "basis": "operator_rule".`));
      if (!v.quote && !(v.note && v.note.length > 0)) E("E_SUIT_SCHEMA", `${path}/quote`, M.schema(`${path}/quote`, `"${field}" is no_limit, which says the source affirms there is no limit. Give the words in "quote" (or the reason in "note"). Example: "quote": "All children are welcome."`));
    }
    if (v.state === "none_stated" && v.basis === null) E("E_SUIT_SCHEMA", `${path}/basis`, M.schema(`${path}/basis`, `"${field}" is none_stated but names no basis: whose statement is it? Example: "basis": "operator_rule".`));
    if (v.state === "searched_none") {
      if (!v.on) E("E_SUIT_SEARCHED_NONE", path, M.searchedNone(field, '"on" date'));
      else if (!v.tried || v.tried.length === 0) E("E_SUIT_SEARCHED_NONE", path, M.searchedNone(field, '"tried" list'));
    }
    // sources
    const checkSrc = (list: string[], p: string): void => {
      for (const id of list) if (!ids.has(id)) E("E_SUIT_SRC", p, M.srcUnknown(id));
    };
    checkSrc(v.src, `${path}/src`);
    (v.conflicts ?? []).forEach((c, k) => checkSrc(c.src, `${path}/conflicts/${k}/src`));
    const asserts = v.state === "value" || v.state === "none_stated" || v.state === "no_limit";
    if (asserts && v.basis !== null && v.src.length === 0 && !(v.basis === "our_inference" && v.note && v.note.length > 0)) E("E_SUIT_SRC", path, M.srcMissing(field));
    if (asserts && v.basis !== "community" && v.src.some((id) => trailforksIds.has(id))) {
      E("E_SUIT_LINK_ONLY_SRC", `${path}/src`, M.linkOnly(v.src.find((id) => trailforksIds.has(id))!, "Trailforks (community basis only)"));
    }
    // hard limits
    if (limit && asserts) {
      const ok = limit === "group" ? v.basis === "official_rule" : v.basis !== null && (RULE_BASES as readonly string[]).includes(v.basis);
      if (!ok) E("E_SUIT_LIMIT_BASIS", `${path}/basis`, limit === "group" ? M.groupMinBasis(v.basis) : M.limitBasis(field, v.basis));
    }
    // units
    if (v.quote && UNIT_RE.test(v.quote) && !(v.note && v.note.trim().length > 0)) E("E_SUIT_UNIT", `${path}/quote`, M.unit(field));
    if (v.quote && UNIT_RE.test(v.quote) && (field.includes("weight") || field.includes("height"))) W("W_SUIT_MARGINAL_CONVERSION", path, M.marginal(field));
    // advisories
    if (v.conflicts && v.conflicts.length > 0) W("W_SUIT_CONFLICT", path, M.conflict(field, v.conflicts.length));
    if (asserts && v.basis === "community") W("W_SUIT_COMMUNITY_ONLY", path, M.community(field));
    if (cls && asserts && v.src.length > 0 && v.basis !== "our_inference") {
      const reads = [v.read, ...v.src.map((id) => readOfSrc.get(id))].filter((x): x is string => !!x).sort();
      const latest = reads[reads.length - 1];
      if (latest && daysBetween(latest, today) > FRESH_DAYS[cls]) W("W_SUIT_STALE", path, M.stale(field, latest, FRESH_DAYS[cls]));
    }
  };

  const rangeErr = (path: string, field: string, detail: string): void => E("E_SUIT_RANGE", path, M.range(field, detail));
  const num = (x: unknown): number | null => (isVal(x) && x.state === "value" && typeof x.v === "number" ? x.v : null);

  const checkBlock = (b: Row, base: string): void => {
    const FACILITY = ["toilets", "water", "food", "shade", "bail_out", "signal"];
    const GRADE_CLASS = ["altitude_m"];
    for (const [k, x] of Object.entries(b)) {
      if (isVal(x)) {
        const limit = (LIMIT_FIELDS as readonly string[]).includes(k) ? (k === "group_min" ? "group" : "rule") : null;
        const cls = limit ? "limit" : k === "access_season" ? "season" : FACILITY.includes(k) ? "facility" : GRADE_CLASS.includes(k) ? "grade" : null;
        checkVal(x, `${base}/${k}`, k, limit, cls);
      }
    }
    const eff = b.effort;
    if (isObj(eff)) {
      const sg = eff.source_grade;
      if (isVal(sg)) {
        checkVal(sg, `${base}/effort/source_grade`, "source_grade", null, "grade");
        if (sg.state === "value" && isObj(sg.v)) {
          const allowed = gradesOf(map, sg.v.system as never);
          if (allowed && !allowed.includes(String(sg.v.value))) E("E_SUIT_GRADE", `${base}/effort/source_grade`, M.grade(String(sg.v.system), String(sg.v.value), allowed));
        }
      }
      const dr = eff.drivers;
      if (isObj(dr)) for (const [k, x] of Object.entries(dr)) if (isVal(x)) checkVal(x, `${base}/effort/drivers/${k}`, k, null, k === "distance_km" || k === "gain_m" || k === "loss_m" ? "grade" : null);
    }
    const ws = b.water_safety;
    if (isObj(ws)) {
      for (const [k, x] of Object.entries(ws)) {
        if (!isVal(x)) continue;
        checkVal(x, `${base}/water_safety/${k}`, k, null, null);
        if ((SECOND_RULE_FIELDS as readonly string[]).includes(k) && (x.state === "value" || x.state === "none_stated" || x.state === "no_limit") && !(x.basis !== null && (RULE_BASES as readonly string[]).includes(x.basis))) E("E_SUIT_LIMIT_BASIS", `${base}/water_safety/${k}/basis`, M.limitBasis(k, x.basis));
        if (k === "class" && x.state === "value" && isObj(x.v)) {
          const allowed = gradesOf(map, x.v.system as never);
          if (allowed && !allowed.includes(String(x.v.value))) E("E_SUIT_GRADE", `${base}/water_safety/class`, M.grade(String(x.v.system), String(x.v.value), allowed));
        }
      }
    }
    const part = b.participation;
    if (isObj(part)) {
      for (const [k, x] of Object.entries(part)) {
        if (!isVal(x)) continue;
        checkVal(x, `${base}/participation/${k}`, k, null, null);
        if ((SECOND_RULE_FIELDS as readonly string[]).includes(k) && (x.state === "value" || x.state === "none_stated" || x.state === "no_limit") && !(x.basis !== null && (RULE_BASES as readonly string[]).includes(x.basis))) E("E_SUIT_LIMIT_BASIS", `${base}/participation/${k}/basis`, M.limitBasis(k, x.basis));
      }
    }
    const ad = b.access_detail;
    if (isObj(ad)) for (const [k, x] of Object.entries(ad)) if (isVal(x)) checkVal(x, `${base}/access_detail/${k}`, k, null, null);
    // wheelchair
    const wc = b.wheelchair;
    if (isVal(wc) && wc.state === "value" && wc.v === "step_free" && wc.basis !== "official_info") E("E_SUIT_STEP_FREE", `${base}/wheelchair`, M.stepFree());
    // ranges
    for (const [lo, hi] of [["min_age", "max_age"], ["min_height_cm", "max_height_cm"], ["min_weight_kg", "max_weight_kg"]] as const) {
      const a = num(b[lo]);
      const c = num(b[hi]);
      if (a !== null && c !== null && a > c) rangeErr(`${base}/${lo}`, lo, `${lo} ${a} is above ${hi} ${c}`);
    }
    const band = b.age_band;
    if (isVal(band) && band.state === "value" && isObj(band.v) && typeof band.v.to === "number" && (band.v.from as number) > band.v.to) rangeErr(`${base}/age_band`, "age_band", `from ${String(band.v.from)} is above to ${band.v.to}`);
    for (const k of ["adult_time_min", "on_site_min"]) {
      const x = b[k];
      if (isVal(x) && x.state === "value" && Array.isArray(x.v) && (x.v[0] as number) > (x.v[1] as number)) rangeErr(`${base}/${k}`, k, `${String(x.v[0])} is above ${String(x.v[1])}`);
    }
    const ct = b.child_time_min;
    if (isVal(ct) && ct.state === "value" && Array.isArray(ct.v)) {
      (ct.v as { from_age: number; to_age: number | null; range: [number, number] }[]).forEach((c, k) => {
        if (c.range[0] > c.range[1]) rangeErr(`${base}/child_time_min/v/${k}`, "child_time_min", `${c.range[0]} is above ${c.range[1]}`);
        if (c.to_age !== null && c.from_age > c.to_age) rangeErr(`${base}/child_time_min/v/${k}`, "child_time_min", `from_age ${c.from_age} is above to_age ${c.to_age}`);
      });
    }
  };

  const checkExt = (x: Row | undefined, base: string): void => {
    if (!x) return;
    for (const [k, v] of Object.entries(x)) {
      if (!isVal(v)) continue;
      checkVal(v, `${base}/${k}`, k, null, null);
      if ((SECOND_RULE_FIELDS as readonly string[]).includes(k) && (v.state === "value" || v.state === "none_stated" || v.state === "no_limit") && !(v.basis !== null && (RULE_BASES as readonly string[]).includes(v.basis))) E("E_SUIT_LIMIT_BASIS", `${base}/${k}/basis`, M.limitBasis(k, v.basis));
    }
  };

  d.records.forEach((r: SuitabilityRecord, i) => {
    const base = `/records/${i}`;
    checkBlock(r.suitability as unknown as Row, `${base}/suitability`);
    checkExt(r.ext as unknown as Row | undefined, `${base}/ext`);
    (r.offers ?? []).forEach((o, j) => {
      checkBlock(o.suitability as unknown as Row, `${base}/offers/${j}/suitability`);
      checkExt(o.ext as unknown as Row | undefined, `${base}/offers/${j}/ext`);
    });
    (r.hints ?? []).forEach((h, j) => h.src.forEach((id) => { if (!ids.has(id)) E("E_SUIT_SRC", `${base}/hints/${j}/src`, M.srcUnknown(id)); }));
    // the flat copy
    if (r.flat === undefined) W("W_SUIT_FLAT_MISSING", `${base}/flat`, M.flatMissing());
    else {
      const want = projectFlat(r, map, app);
      const diff = (Object.keys(want) as (keyof typeof want)[]).filter((k) => want[k] !== r.flat![k]).map((k) => `${k}: file ${JSON.stringify(r.flat![k])}, computed ${JSON.stringify(want[k])}`);
      if (diff.length) E("E_SUIT_FLAT_DRIFT", `${base}/flat`, M.flatDrift(diff.join("; ")));
    }
    // S0b: subkind, extension, not-applicable fields, suit_level (own module)
    checkApplicability(r, base, app, E, W);
    // computing must not throw on a valid record
    deriveEffort({ kind: r.kind, subkind: r.subkind, block: r.suitability, ext: r.ext }, map);
  });
}
