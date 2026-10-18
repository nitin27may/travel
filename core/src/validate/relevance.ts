// Validator for relevance/1 files (E_REL_* and W_REL_*). Structure comes from the Zod schema; this file adds the rules a
// schema cannot hold (relevance.md sections 2.2 and 5): link-only sources, copied ratings, the draw note, derived fields
// typed by hand, inherited designations, household data, the class vocabulary and the confirmed QID.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { tableOf } from "../schema/index.ts";
import type { RelevanceDoc, RelevanceRecord } from "../schema/relevance.ts";
import { RefResolver } from "../relevance/refs.ts";
import { THRESHOLDS, tierIdx } from "../relevance/fit.ts";
import { staleFields } from "../relevance/stale.ts";
import { suggestFor } from "../relevance/suggest.ts";
import { REL_MESSAGES as M } from "./messages.ts";
import { isObj } from "./rows.ts";
import type { Ctx, Row } from "./rows.ts";

export interface RelOptions {
  /** ISO date used for staleness; default RELEVANCE_TODAY or the real date */
  today?: string;
}

/** Hosts whose ratings, counts and ranks are never data (R6). Same set as suitability K10, plus Yelp. */
const LINK_ONLY_HOSTS: [RegExp, string][] = [
  [/(^|\.)alltrails\.com$/, "AllTrails"],
  [/(^|\.)komoot\.[a-z.]+$/, "Komoot"],
  [/(^|\.)gaiagps\.com$/, "Gaia GPS"],
  [/(^|\.)outdooractive\.com$/, "Outdooractive"],
  [/(^|\.)wikiloc\.com$/, "Wikiloc"],
  [/(^|\.)trailforks\.com$/, "Trailforks"],
  [/(^|\.)strava\.com$/, "Strava"],
  [/(^|\.)hikingproject\.com$/, "Hiking Project"],
  [/(^|\.)fatmap\.com$/, "FATMAP"],
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)tripadvisor\.[a-z.]+$/, "Tripadvisor"],
  [/(^|\.)yelp\.[a-z.]+$/, "Yelp"],
  [/(^|\.)booking\.com$/, "Booking.com"],
  [/(^|\.)(viator|getyourguide|expedia|airbnb)\.[a-z.]+$/, "a booking site"],
];

const RATING_PATTERNS: RegExp[] = [
  /\b\d(?:\.\d)?\s*\/\s*(?:5|10)\b/,
  /\b\d(?:\.\d)?\s*(?:out of\s*(?:5|10)|stars?)\b/i,
  /\b\d[\d,]*\+?\s+(?:reviews?|ratings?|votes?|check-?ins?)\b/i,
  /#\s?\d+\s+(?:of|in|out of)\s+\d+/i,
  /\branked\s+#?\s*\d+\b/i,
  /\brated\s+\d(?:\.\d)?\b/i,
];
/** keys whose strings are ids, dates or enums, never prose */
const NON_PROSE = new Set(["ref", "same_place_as", "class_key", "easy_way", "kind", "subkind", "src", "from", "to", "id", "type", "state", "basis", "wikidata", "on", "read", "unit", "scope", "list", "reach", "field", "by"]);

/** Fields a person must not type: they are computed. */
const DERIVED_KEYS = [
  "draw_suggested", "effective_draw", "role", "fit", "fits", "badge", "badges", "substitutes", "similar_osm_25km", "far_pointer", "pair_with",
  "plan_b", "detour_min", "from_hubs", "access_load", "flags", "role_in_trip", "context_fit",
];
const HOUSEHOLD_KEYS = /^(origin|home|household|home_address|private_origin|start_address|address|home_lat|home_lon|party|kids|children|ages)$/i;
/** Prose about the household: where we live, how many we are, how old the children are (5 rule 7). */
const HOUSEHOLD_TEXT = new RegExp(
  [
    "\\b(my home|our home|home address|household origin|private origin|home ?town|hometown)\\b",
    "\\bwe (live|stay|are based|are from)\\b",
    "\\b(i|we) live\\b",
    "\\b(family|party|group) of \\d+\\b",
    "\\b(our|my) (\\d+|one|two|three|four|five|six|seven|eight|nine|ten)[- ]?(year|yr)s?[- ]?old\\b",
    "\\b(our|my) (kids?|children|son|daughter|toddler|baby|boys?|girls?|twins?)\\b",
    "\\b(kids?|children|boys?|girls?|sons?|daughters?) (aged|age|ages)\\s+\\d",
    "\\bour (\\d+) (kids|children)\\b",
  ].join("|"),
  "i",
);

const AREA_DESIGNATIONS = ["unesco_whs", "national_park", "provincial_or_state_park", "conservation_area", "dark_sky", "ramsar"];
/** Only a record that is itself an area may own an area designation. Everything else inherits it as `parent`. */
const AREA_KINDS = ["park", "region", "protected_area"];
const SIGNAL_WORDS = /(designat|wikipedia languages?|wikipedia language (?:counts?|editions?)|\d+ language editions?|language counts?|unesco|\bwhs\b|world heritage|national park|provincial park|state park|conservation|top[- _]?list|tourism board|editorial|headline|official_highlight|land manager|sells? out|sold out|lottery|permit|quota|shuttle)/i;
/** Platform names that must not stand as a publisher or a title either. */
const LINK_ONLY_NAMES = /(alltrails|komoot|gaia ?gps|outdooractive|wikiloc|trailforks|strava|hiking ?project|fatmap|google|tripadvisor|\byelp\b|booking\.com)/i;
const GAP_EXPLAINED = /(over-?scores?|under-?scores?|despite|although|because|judg|sub-feature|roadside|\bgap\b|signals?)/i;


type AnyVal = { v: unknown; state: string; basis: string | null; src: string[]; read?: string; note?: string; tried?: string[]; on?: string; conflicts?: { src: string[] }[] };
const isVal = (x: unknown): x is AnyVal => isObj(x) && "v" in x && "state" in x && "src" in x;

function describeIssue(issue: z.core.$ZodIssue): string {
  const path = "/" + issue.path.join("/");
  const field = String(issue.path[issue.path.length - 1] ?? "the file");
  switch (issue.code) {
    case "invalid_value":
      return `${path}: "${field}" must be one of ${(issue.values ?? []).map((v) => JSON.stringify(v)).join(", ")}. Example: ${JSON.stringify(issue.values?.[0] ?? "...")}.`;
    case "invalid_type":
      return `${path}: "${field}" must be a ${issue.expected}. Example: use the shape in data/relevance/README.md.`;
    case "unrecognized_keys":
      return `${path}: unknown key${issue.keys.length > 1 ? "s" : ""} ${issue.keys.map((k) => `"${k}"`).join(", ")}. Remove ${issue.keys.length > 1 ? "them" : "it"} or check the spelling against data/schema/generated/schema.json.`;
    case "invalid_format":
      return `${path}: "${field}" is not in the expected format. Example: a date is "2026-10-18", a draw_peak day is "09-20", a class is "lake/glacial-turquoise".`;
    case "too_big":
      return `${path}: "${field}" is too long or has too many items. Keep "why" and "unique_because" to 120 characters and editorial to 3 mentions.`;
    default:
      return `${path}: "${field}" ${issue.message}. Example: see data/relevance/README.md.`;
  }
}

const daysBetween = (a: string, b: string): number => Math.floor((Date.parse(b) - Date.parse(a)) / 86400000);

function* walkStrings(x: unknown, path: string, key = ""): Generator<[string, string]> {
  if (typeof x === "string") {
    if (!NON_PROSE.has(key)) yield [path, x];
  } else if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) yield* walkStrings(x[i], `${path}/${i}`, key);
  } else if (isObj(x)) {
    for (const [k, v] of Object.entries(x)) yield* walkStrings(v, `${path}/${k}`, k);
  }
}

function loadClasses(root: string): Set<string> | null {
  const p = join(root, "data", "vocab", "relevance-classes.json");
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, "utf8")) as { classes?: { key: string }[] };
    return new Set((j.classes ?? []).map((c) => c.key));
  } catch {
    return null;
  }
}

/** QID -> { languages, views } from the cached signals files, if any. */
export function loadSignalsFor(root: string): Record<string, { languages: number | null; views: number | null }> {
  const out: Record<string, { languages: number | null; views: number | null }> = {};
  const rd = (name: string): Record<string, Row> => {
    const p = join(root, "data", "relevance", "signals", name);
    if (!existsSync(p)) return {};
    try {
      return ((JSON.parse(readFileSync(p, "utf8")) as { items?: Record<string, Row> }).items ?? {}) as Record<string, Row>;
    } catch {
      return {};
    }
  };
  const wd = rd("wikidata.json");
  const pv = rd("pageviews.json");
  for (const q of new Set([...Object.keys(wd), ...Object.keys(pv)])) {
    const langs = (wd[q] as { sitelinks?: { count?: number } } | undefined)?.sitelinks?.count;
    const views = (pv[q] as { max?: number } | undefined)?.max;
    out[q] = { languages: typeof langs === "number" ? langs : null, views: typeof views === "number" ? views : null };
  }
  return out;
}

export function validateRelevance(doc: unknown, ctx: Ctx, opts: RelOptions = {}): void {
  const root = ctx.refs.root;
  const E = (code: string, path: string, message: string): void => void ctx.errors.push({ code, path, message });
  const W = (code: string, path: string, message: string): void => void ctx.warnings.push({ code, path, message });
  if (!isObj(doc)) {
    E("E_REL_SCHEMA", "", "the file must be one JSON object with schema, trip, lane, researched, sources and records.");
    ctx.schemaBroken = true;
    return;
  }

  // typed derived fields and household data are reported first, then removed so the schema parse sees the rest
  const clone = structuredClone(doc) as Row;
  const scrub = (x: unknown, path: string): void => {
    if (Array.isArray(x)) x.forEach((y, i) => scrub(y, `${path}/${i}`));
    else if (isObj(x)) {
      for (const k of Object.keys(x)) {
        if (HOUSEHOLD_KEYS.test(k)) {
          E("E_REL_HOUSEHOLD", `${path}/${k}`, M.household(`"${k}"`));
          delete x[k];
        } else scrub(x[k], `${path}/${k}`);
      }
    }
  };
  const recs0 = Array.isArray(clone.records) ? (clone.records as unknown[]) : [];
  recs0.forEach((r, i) => {
    if (!isObj(r)) return;
    for (const k of DERIVED_KEYS) {
      if (k in r) {
        E("E_REL_TYPED_DERIVED", `/records/${i}/${k}`, M.typedDerived(k));
        delete r[k];
      }
    }
    scrub(r, `/records/${i}`);
  });
  for (const [path, s] of walkStrings(clone, "")) {
    if (!path.endsWith("/quote") && HOUSEHOLD_TEXT.test(s)) E("E_REL_HOUSEHOLD", path, M.household(`"${s.slice(0, 40)}"`));
  }

  const t = tableOf("sidecar", "relevance");
  const parsed = t.schema.safeParse(clone);
  let broken = false;
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const p = issue.path;
      if (p[0] === "sources" && typeof p[1] === "number" && p[2] === "read") {
        E("E_REL_SRC_READ", "/" + p.slice(0, 3).join("/"), M.srcRead(String((clone.sources as Row[])?.[p[1]]?.id ?? p[1])));
      } else if (p[0] === "records" && p[2] === "wikidata" && p[3] === "v") {
        E("E_REL_QID", "/" + p.join("/"), M.qid("the Wikidata item is not of the form Q123"));
      } else {
        E("E_REL_SCHEMA", "/" + p.join("/"), describeIssue(issue));
        broken = true;
      }
    }
  }
  if (broken) {
    ctx.schemaBroken = true;
    return;
  }
  if (!parsed.success) return;

  const d = parsed.data as unknown as RelevanceDoc;
  const today = opts.today ?? process.env.RELEVANCE_TODAY ?? new Date().toISOString().slice(0, 10);
  const classes = loadClasses(root);
  const signals = loadSignalsFor(root);

  // ---- sources ----
  const ids = new Set<string>();
  d.sources.forEach((s, i) => {
    if (ids.has(s.id)) E("E_REL_SRC", `/sources/${i}/id`, `source id "${s.id}" appears twice. Give each source its own id. Example: "src-0002".`);
    ids.add(s.id);
    let host = "";
    try {
      host = new URL(s.url).hostname.toLowerCase();
    } catch {
      /* a repo path has no host */
    }
    const hit = LINK_ONLY_HOSTS.find(([re]) => re.test(host));
    if (hit) E("E_REL_LINK_ONLY_SRC", `/sources/${i}/url`, M.linkOnly(s.id, hit[1]));
    else {
      const named = LINK_ONLY_NAMES.exec(`${s.publisher} ${s.title}`);
      if (named) E("E_REL_LINK_ONLY_SRC", `/sources/${i}/publisher`, M.linkOnly(s.id, named[0]));
    }
  });
  const readOf = new Map(d.sources.map((s) => [s.id, s.read]));

  // ---- refs ----
  const resolver = new RefResolver(root);
  const seen = new Map<string, number>();
  d.records.forEach((r, i) => {
    const why = resolver.why(r.ref);
    if (why) E("E_REL_REF", `/records/${i}/ref`, M.ref(r.ref, why));
    if (r.same_place_as !== undefined) {
      const why2 = r.same_place_as === r.ref ? "it is the record's own ref" : resolver.why(r.same_place_as);
      if (why2) E("E_REL_REF", `/records/${i}/same_place_as`, M.ref(r.same_place_as, why2));
    }
    (r.pairs_with ?? []).forEach((pw, k) => {
      const w = pw.ref === r.ref ? "a place cannot pair with itself" : resolver.why(pw.ref);
      if (w) E("E_REL_REF", `/records/${i}/pairs_with/${k}/ref`, M.ref(pw.ref, w));
      if (pw.src && !ids.has(pw.src)) E("E_REL_SRC", `/records/${i}/pairs_with/${k}/src`, M.srcUnknown(pw.src));
    });
    const first = seen.get(r.ref);
    if (first !== undefined) E("E_REL_DUP_REF", `/records/${i}/ref`, M.dupRef(r.ref, `records ${first} and ${i} of this file`));
    else seen.set(r.ref, i);
  });

  // ---- values ----
  const checkVal = (v: AnyVal, path: string, field: string): void => {
    if (v.state === "value") {
      if (v.v === null) E("E_REL_SCHEMA", path, M.schema(path, `"${field}" has state "value" but v is null. Give v, or use another state. Example: {"v": "regional", "state": "value"}.`));
      if (v.basis === null) E("E_REL_SCHEMA", `${path}/basis`, M.schema(`${path}/basis`, `"${field}" has a value but no basis. Say what it rests on. Example: "basis": "our_inference".`));
    } else if (v.v !== null) {
      E("E_REL_SCHEMA", path, M.schema(path, `"${field}" has state "${v.state}" so v must be null. Move the figure to "conflicts" or set state "value". Example: {"v": null, "state": "searched_none"}.`));
    }
    if (v.state === "none_stated" && v.basis === null) E("E_REL_SCHEMA", `${path}/basis`, M.schema(`${path}/basis`, `"${field}" is none_stated but names no basis. Example: "basis": "official_info".`));
    if (v.state === "searched_none" && (!v.on || !v.tried || v.tried.length === 0)) {
      E("E_REL_SCHEMA", path, M.schema(path, `"${field}" is searched_none without "on" and "tried". Say when you looked and what you tried. Example: {"state": "searched_none", "on": "2026-10-18", "tried": ["Wikidata search by coordinates"]}.`));
    }
    const check = (list: string[], p: string): void => {
      for (const id of list) if (!ids.has(id)) E("E_REL_SRC", p, M.srcUnknown(id));
    };
    check(v.src, `${path}/src`);
    (v.conflicts ?? []).forEach((c, k) => check(c.src, `${path}/conflicts/${k}/src`));
    const asserts = v.state === "value" || v.state === "none_stated";
    if (asserts && v.basis !== null && v.src.length === 0 && !((v.basis === "our_inference" || v.basis === "editorial") && v.note && v.note.length > 0)) {
      E("E_REL_SRC", path, M.srcMissing(field));
    }
  };

  d.records.forEach((r: RelevanceRecord, i) => {
    const base = `/records/${i}`;
    const row = r as unknown as Row;
    for (const k of ["wikidata", "draw", "draw_peak", "standing", "distinction", "easy_payoff", "weather", "access_cost"] as const) {
      const x = row[k];
      if (isVal(x)) checkVal(x, `${base}/${k}`, k);
    }
    const sg = r.signals as unknown as Row;
    for (const k of ["designations", "editorial", "volume"]) {
      const x = sg[k];
      if (isVal(x)) checkVal(x, `${base}/signals/${k}`, k);
    }

    // wikidata
    if (r.wikidata.state === "value") {
      if (!r.wikidata.note || r.wikidata.note.trim() === "") E("E_REL_QID", `${base}/wikidata`, M.qid("the QID has no note saying how a person confirmed it (coordinates and description)"));
    } else if (r.wikidata.state === "gap") W("W_REL_NO_QID", `${base}/wikidata`, "no confirmed Wikidata QID yet, so derive reads no fame signals for this record.");

    // class vocabulary
    if (classes && !classes.has(r.class_key)) E("E_REL_CLASS", `${base}/class_key`, M.cls(r.class_key));

    // draw note
    if (r.draw.state === "value" && !(r.draw.note && SIGNAL_WORDS.test(r.draw.note))) E("E_REL_DRAW_NOTE", `${base}/draw`, M.drawNote());

    // draw_peak must lift the draw
    const peak = r.draw_peak;
    if (peak && peak.state === "value" && peak.v && r.draw.v) {
      if (tierIdx(peak.v.tier) <= tierIdx(r.draw.v)) E("E_REL_RANGE", `${base}/draw_peak`, M.range(`draw_peak tier "${peak.v.tier}" is not above draw "${r.draw.v}"; a seasonal lift must raise the tier`));
      if (peak.v.from === peak.v.to) E("E_REL_RANGE", `${base}/draw_peak`, M.range("draw_peak starts and ends on the same day"));
    }

    // inherited designations: on anything that is not itself an area, an area designation is `parent`
    const des = r.signals.designations;
    if (des.state === "value" && des.v && !AREA_KINDS.includes(r.kind)) {
      des.v.forEach((x, k) => {
        if (x.scope === "own" && AREA_DESIGNATIONS.includes(x.type)) E("E_REL_INHERITED_DESIGNATION", `${base}/signals/designations/v/${k}/scope`, M.inherited(x.name));
      });
    }
    // editorial mentions
    (r.signals.editorial.state === "value" ? (r.signals.editorial.v ?? []) : []).forEach((m, k) => {
      const named = LINK_ONLY_NAMES.exec(`${m.publisher} ${m.title}`);
      if (named) E("E_REL_LINK_ONLY_SRC", `${base}/signals/editorial/v/${k}/publisher`, M.linkOnly(`${m.publisher}`, named[0]));
      if (m.list === "top_list" && !m.reach) W("W_REL_NO_REACH", `${base}/signals/editorial/v/${k}`, "a top_list mention has no reach, so it cannot raise the draw floor. Add reach: regional, national or global.");
    });

    // copied ratings: every prose string of the record
    for (const [p, s] of walkStrings(r, base)) {
      const hit = RATING_PATTERNS.map((re) => re.exec(s)).find((m) => m);
      if (hit) E("E_REL_COPIED_RATING", p, M.copiedRating(p, hit[0]));
    }

    // draw gap against the cached signals, with the same suggestion derive uses (parent QID included)
    if (r.draw.state === "value" && r.draw.v && r.wikidata.state === "value" && r.wikidata.v && signals[r.wikidata.v]) {
      const sug = suggestFor(r, signals, THRESHOLDS);
      if (Math.abs(tierIdx(sug) - tierIdx(r.draw.v)) >= 2 && !(r.draw.note && GAP_EXPLAINED.test(r.draw.note))) {
        W("W_REL_DRAW_GAP", `${base}/draw`, `draw "${r.draw.v}" and draw_suggested "${sug}" differ by 2 or more tiers and the note does not explain why. Say why the signals mislead (over-score or under-score).`);
      }
    }

    // freshness (derive treats these as gaps)
    for (const x of staleFields(r, d.researched, Object.fromEntries(d.sources.map((q) => [q.id, q.read])), today)) {
      const path = x.field === "designations" || x.field === "editorial" ? `${base}/signals/${x.field}` : `${base}/${x.field}`;
      W("W_REL_STALE", path, `"${x.field}" was last read ${x.latest}, more than ${x.limit} days ago. Re-check it; derive treats it as a gap until then.`);
    }
  });
}
