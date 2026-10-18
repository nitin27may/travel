// Plain-English messages with an example of a valid value (plan 4.7 style).
import type { Table } from "../schema/meta.ts";

const EXAMPLES: Record<string, string> = {
  text: '"Laguna de los Tres"',
  int: "3",
  real: "21.5",
  bool: "true",
  json: "[]",
  date: '"2027-03-05"',
  datetime: '"2027-03-05T09:30:00-03:00"',
  month: "9",
  hhmm: '"07:15"',
  offset: "-88",
  tz: '"America/Argentina/Buenos_Aires"',
  pdate: '"2026-10" (a year, a month or a day)',
};

export function columnType(t: Table, col: string): string {
  const m = t.shape[col]?.meta() as Record<string, unknown> | undefined;
  return String(m?.["x-type"] ?? "text");
}

export function exampleFor(t: Table, col: string): string {
  return EXAMPLES[columnType(t, col)] ?? '"..."';
}

const show = (v: unknown): string => {
  const s = JSON.stringify(v);
  return s === undefined ? "undefined" : s.length > 60 ? `${s.slice(0, 57)}...` : s;
};

export interface ZodLikeIssue {
  code: string;
  path: PropertyKey[];
  message: string;
  expected?: string;
  values?: unknown[];
  keys?: string[];
  format?: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
}

/** One sentence naming the field, what is wrong, and a valid example. */
export function describeZodIssue(t: Table, issue: ZodLikeIssue, row: unknown): string {
  const [col, ...rest] = issue.path;
  const field = col === undefined ? "the row" : `"${String(col)}"${rest.length ? ` (inside ${rest.join(".")})` : ""}`;
  const got = col !== undefined && row && typeof row === "object" ? show((row as Record<string, unknown>)[String(col)]) : "";
  const example = col !== undefined && typeof col === "string" ? exampleFor(t, col) : "";
  switch (issue.code) {
    case "invalid_value":
      return `${field} must be one of ${(issue.values ?? []).map((v) => JSON.stringify(v)).join(", ")}, got ${got}.`;
    case "invalid_type": {
      if (rest.length > 0) return `${field} must be a ${issue.expected}, got ${got}.`;
      const moneyHint =
        typeof col === "string" && col.endsWith("_amount") && got.startsWith("{")
          ? " Money is two columns, <name>_amount (a number) and <name>_currency (like \"CAD\"), never an object."
          : "";
      return `${field} must be a ${issue.expected}, got ${got}. Example: ${example}.${moneyHint}`;
    }
    case "invalid_format":
      return `${field} is not in the expected format, got ${got}. Example: ${example}.`;
    case "too_small":
    case "too_big": {
      const bound = issue.code === "too_small" ? `at least ${String(issue.minimum)}` : `at most ${String(issue.maximum)}`;
      return `${field} must be ${bound}, got ${got}. Example: ${example}.`;
    }
    case "unrecognized_keys":
      return `unknown column${(issue.keys ?? []).length > 1 ? "s" : ""} ${(issue.keys ?? []).map((k) => `"${k}"`).join(", ")}. Remove ${(issue.keys ?? []).length > 1 ? "them" : "it"} or check the spelling against data/schema/generated/schema.json.`;
    default:
      return `${field}: ${issue.message}. Example: ${example}.`;
  }
}

export function describeMissing(t: Table, col: string): string {
  const m = t.shape[col]?.meta() as Record<string, unknown> | undefined;
  const nullable = t.shape[col]!.safeParse(null).success;
  const type = String(m?.["x-type"] ?? "text");
  return `column "${col}" is missing. ${nullable ? "Add it with null when there is no value, or a value like " : "Add it with a value like "}${EXAMPLES[type] ?? '"..."'}.`;
}

// suitability/1: what is wrong, then an example of a fix.
export const SUIT_MESSAGES = {
  schema: (path: string, what: string): string => `${path || "the file"}: ${what}`,
  ref: (ref: string, why: string): string =>
    `ref "${ref}" does not resolve: ${why}. Refs are place/<slug>, legacy/<folder>/<dataset>/<id>, trip/<trip>/<kind>:<name> or offer/<parent ref>#<product>. Example: "place/lago-di-braies".`,
  dupRef: (ref: string, where: string): string =>
    `ref "${ref}" appears more than once (${where}). Keep one record per ref; move the extra values into it. Example: merge the second record's fields into the first and delete it.`,
  srcUnknown: (id: string): string =>
    `src names "${id}", which is not in this file's sources. Add the source to "sources" or remove the id. Example: "src-0001".`,
  srcMissing: (field: string): string =>
    `"${field}" has a value but no source. A value without src must be basis "our_inference" with a note that names the method. Example: {"basis": "our_inference", "src": [], "note": "Naismith from 7.4 km and 385 m"}.`,
  srcRead: (id: string): string =>
    `source "${id}" has no read date. Every source is dated when it was read. Example: "read": "2026-10-18".`,
  linkOnly: (id: string, host: string): string =>
    `source "${id}" is ${host}, a link-only platform: its figures are never a source (K10). Cite the land manager or operator instead and keep the link in the markdown notes. Example: "https://parks.canada.ca/...".`,
  limitBasis: (field: string, basis: string | null): string =>
    `"${field}" rests on ${basis === null ? "no basis" : `"${basis}"`}, but a hard limit may only rest on "operator_rule" or "official_rule". Move the figure to "conflicts" and set state "searched_none" with "on" and "tried". Example: {"v": 8, "state": "value", "basis": "operator_rule", "src": ["src-0001"]}.`,
  groupMinBasis: (basis: string | null): string =>
    `"group_min" rests on ${basis === null ? "no basis" : `"${basis}"`}, but a group minimum is a land manager's rule: use "official_rule". Example: {"v": {"n": 4}, "state": "value", "basis": "official_rule", "src": ["src-0001"]}.`,
  searchedNone: (field: string, lacks: string): string =>
    `"${field}" is searched_none but has no ${lacks}. Say when you looked and what you tried. Example: {"state": "searched_none", "on": "2026-10-18", "tried": ["operator terms page", "booking FAQ"]}.`,
  unit: (field: string): string =>
    `"${field}" has a quote in lb, in, ft or mi but no note with the conversion. Add one. Example: "note": "44 in = 112 cm".`,
  range: (field: string, detail: string): string =>
    `"${field}" runs backwards: ${detail}. Check which end each figure is. Example: min_weight_kg 22.7 with max_weight_kg 113.`,
  grade: (system: string, value: string, allowed: string[]): string =>
    `"${value}" is not a grade of "${system}". The grades are ${allowed.map((a) => JSON.stringify(a)).join(", ")}. If the source uses another word, keep the word under system "local". Example: {"system": "local", "value": "easy"}.`,
  typedEffort: (key: string): string =>
    `"${key}" is typed in the file, but terrain, band, effort_km and family_effort are computed from the grade and the drivers. Remove it. Example: keep "source_grade" and "drivers" only.`,
  stepFree: (): string =>
    `wheelchair "step_free" needs basis "official_info": an accessible entrance with one step is "partial". Example: {"v": "partial", "state": "value", "basis": "official_info", "src": ["src-0001"]}.`,
  flatDrift: (diff: string): string =>
    `the flat catalogue copy differs from what derive computes (${diff}). Run: node core/bin/suitability.ts derive --write. Example: "flat": {"min_age": null, "house_grade": 3}.`,
  stale: (field: string, read: string, days: number): string =>
    `"${field}" was read on ${read}, more than ${days} days ago. Re-read the source before it counts. Example: set "read" to today's date after checking.`,
  conflict: (field: string, n: number): string =>
    `"${field}" keeps ${n} conflicting figure${n === 1 ? "" : "s"}. A person or the next lane decides; nothing is averaged.`,
  community: (field: string): string =>
    `"${field}" rests on community reports alone. Fine for shade, signal and stroller; confirm anything that gates a child.`,
  marginal: (field: string): string =>
    `"${field}" was converted from imperial units. The household check treats a figure within 1 kg or 2 cm as marginal; confirm with the operator.`,
  flatMissing: (): string =>
    `the record has no flat catalogue copy. Run: node core/bin/suitability.ts derive --write. Example: "flat": {"min_age": null, "house_grade": 3}.`,
};

// relevance/1 messages, a block of their own.
export const REL_MESSAGES = {
  schema: (path: string, what: string): string => `${path || "the file"}: ${what}`,
  ref: (ref: string, why: string): string =>
    `ref "${ref}" does not resolve: ${why}. Relevance uses the suitability refs: place/<slug>, legacy/<folder>/<dataset>/<id>, trip/<trip>/<kind>:<name>. Example: "place/lago-di-braies".`,
  dupRef: (ref: string, where: string): string =>
    `ref "${ref}" appears more than once (${where}). Keep one relevance record per ref. Example: merge the second record into the first and delete it.`,
  srcUnknown: (id: string): string => `src names "${id}", which is not in this file's sources. Add the source to "sources" or remove the id. Example: "src-0001".`,
  srcMissing: (field: string): string =>
    `"${field}" has a value but no source. A value without src must be basis "our_inference" with a note that names the method. Example: {"basis": "our_inference", "src": [], "note": "Lake Louise 11 km is the same class"}.`,
  srcRead: (id: string): string => `source "${id}" has no read date. Every source is dated when it was read. Example: "read": "2026-10-18".`,
  linkOnly: (id: string, host: string): string =>
    `source "${id}" is ${host}: its ratings, review counts and ranks are never data (R6). Cite the land manager, UNESCO or the tourism board instead, and keep the link in the lane markdown. Example: "https://parks.canada.ca/...".`,
  copiedRating: (where: string, text: string): string =>
    `${where} contains "${text}", which reads as a rating, a review count or a popularity rank. Those are never stored (R6). Say what the place is in your own words. Example: "one of the most photographed lakes in the Rockies".`,
  drawNote: (): string =>
    'draw has a value but its note names no signal. Name one: a designation with its scope, a top-list mention, the land manager calling it a headline, or a booking that sells out. Example: "note": "NPS calls the Narrows one of the park\'s most popular areas (official_highlight)".',
  typedDerived: (key: string): string =>
    `"${key}" is derived by core/src/relevance/derive.ts and must not be typed. Remove it, or use "override" with a reason, by and on. Example: {"field": "role", "value": "highlight", "reason": "...", "by": "nitin", "on": "2026-10-18"}.`,
  inherited: (name: string): string =>
    `designation "${name}" comes from a park-level page, so on a place record it must say scope "parent": inherited status never raises the draw (3.1 rule 3). Example: {"type": "unesco_whs", "name": "${name}", "scope": "parent"}.`,
  household: (what: string): string =>
    `${what} looks like a household origin. Relevance files carry public hubs only (Toronto City Hall), never a home address or a private point. Remove it.`,
  cls: (key: string): string => `class_key "${key}" is not in data/vocab/relevance-classes.json. Pick an existing class, or propose a new one in the lane markdown. Example: "lake/glacial-turquoise".`,
  qid: (what: string): string => `${what}. A confirmed QID looks like "Q1072342" and its note says how it was checked. Example: {"v": "Q1072342", "state": "value", "basis": "our_inference", "src": [], "note": "checked: lake in Alberta, not Q124471170"}.`,
  range: (what: string): string => `${what}. Example: at most 3 editorial mentions, "why" up to 120 characters, draw_peak from "09-20" to "10-15".`,
};
