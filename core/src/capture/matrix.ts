// The property matrix (property-display-matrix 3.2, 4, 10): the registry joined to the resolved type marks, the freshness classes and
// the API read models' exposure, as one deterministic document, plus the rule checks K1 to K12 over the same inputs.
//
// Pure: no file reads here except `loadMatrixInputs`, so a test feeds planted rows to any check. generate.ts is the one writer of the
// output (`property-matrix.json` and `.md` in data/schema/generated); `capture.ts build --check` reports the checks through generate.ts.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLACE_ROW_KEYS, placeDetail, placeRow } from "../schema/api/place.ts";
import { tripDetail, tripRow } from "../schema/api/trip.ts";
import { ENVELOPE_EXPOSURE, READ_MODELS } from "../schema/exposure.ts";
import type { EnvelopeExposure, ReadModel } from "../schema/exposure.ts";
import { PROPERTIES, exposureProblems, homeOf } from "../schema/capture/properties.ts";
import type { Mark, PropertyDef, RecordLayer } from "../schema/capture/properties.ts";
import type { TypesFile } from "../schema/capture/typesFile.ts";
import { resolveNode } from "./resolve.ts";
import { loadTypes, splitMarkKey } from "./tree.ts";

export const MATRIX_JSON = "data/schema/generated/property-matrix.json";
export const MATRIX_MD = "data/schema/generated/property-matrix.md";
export const ALLOW_PATH = "data/schema/property-matrix-allow.json";
export const FRESHNESS_PATH = "data/schema/freshness.json";
export const MATRIX_SCHEMA = "property-matrix/1";

export const RULES = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "K9", "K10", "K11", "K12"] as const;
export type Rule = (typeof RULES)[number];
/** The rules whose breaks may sit on the allow list (K1, K2, K10 and K11 hold today; K8, a read-model key with no privacy row, is a privacy gap: none of these is ever allowed). */
export const ALLOWABLE: readonly Rule[] = ["K3", "K4", "K5", "K6", "K7", "K9", "K12"];

export interface Problem { rule: Rule; key: string; detail: string }
export const problemId = (p: Pick<Problem, "rule" | "key">): string => `${p.rule} ${p.key}`;

/** The marks of one type id, per layer (the resolver's output reduced to what the matrix reads). */
export interface TypeMarks {
  id: string;
  label: string;
  records: RecordLayer[];
  layers: Partial<Record<RecordLayer, { offer_class: string | null; base: Record<string, Mark> }>>;
  suitability: Record<string, string>;
  sources: string[];
}

/** A mark as authored on a node or a layer rule, before the resolver drops it (K9). */
export interface RawMark { from: string; layer: RecordLayer | null; records: RecordLayer[]; key: string; mark: Mark }

export interface Freshness { classes: { id: string; fields: string[]; stale_after_days: number | null }[] }

export interface MatrixInputs {
  props: readonly PropertyDef[];
  types: TypeMarks[];
  rawMarks: RawMark[];
  freshness: Freshness;
  envelope: Readonly<Record<ReadModel, Readonly<Record<string, EnvelopeExposure>>>>;
  shapeKeys: Readonly<Record<ReadModel, readonly string[]>>;
  rowKeys: readonly string[];
}

// ---- inputs -------------------------------------------------------------------------------------------------------------------

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const readJson = <T>(root: string, rel: string): T => JSON.parse(readFileSync(existsSync(join(root, rel)) ? join(root, rel) : join(REPO, rel), "utf8")) as T;

export function typeMarksOf(file: TypesFile): TypeMarks[] {
  const out: TypeMarks[] = [];
  for (const n of file.nodes) {
    if (n.level !== "type" && n.level !== "subtype") continue;
    const r = resolveNode(n.id, file);
    if (!r || r.records.length === 0) continue;
    const layers: TypeMarks["layers"] = {};
    for (const l of r.records) layers[l] = { offer_class: r.layers[l]!.offer_class, base: r.layers[l]!.base };
    out.push({ id: r.id, label: r.label, records: r.records, layers, suitability: r.suitability, sources: r.sources });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

export function rawMarksOf(file: TypesFile): RawMark[] {
  const out: RawMark[] = [];
  const layerOf = (s: string): RecordLayer | null => (/^(place|route|offer|event)/.exec(s)?.[1] as RecordLayer | undefined) ?? null;
  for (const n of file.nodes) {
    const r = resolveNode(n.id, file);
    const records = (r?.records ?? []) as RecordLayer[];
    for (const [k, mark] of Object.entries(n.marks ?? {})) {
      const { layer, prop } = splitMarkKey(k);
      out.push({ from: n.id, layer: layer as RecordLayer | null, records, key: prop, mark });
    }
  }
  for (const [rule, body] of Object.entries(file.layers)) {
    const layer = layerOf(rule);
    if (!layer) continue;
    for (const m of ["R", "A"] as const) for (const key of body[m] ?? []) out.push({ from: `layers.${rule}`, layer, records: [layer], key, mark: m });
  }
  return out;
}

export function loadMatrixInputs(root: string, file: TypesFile = loadTypes(root)): MatrixInputs {
  return {
    props: PROPERTIES,
    types: typeMarksOf(file),
    rawMarks: rawMarksOf(file),
    freshness: readJson<Freshness>(root, FRESHNESS_PATH),
    envelope: ENVELOPE_EXPOSURE,
    shapeKeys: {
      placeRow: Object.keys(placeRow.shape), placeDetail: Object.keys(placeDetail.shape), tripRow: Object.keys(tripRow.shape), tripDetail: Object.keys(tripDetail.shape),
    },
    rowKeys: PLACE_ROW_KEYS as readonly string[],
  };
}

// ---- the checks ---------------------------------------------------------------------------------------------------------------

const freshKeys = (f: Freshness): Set<string> => new Set(f.classes.flatMap((c) => c.fields));
const examples = (ids: string[]): string => `${ids.length} type(s), e.g. ${ids.slice(0, 2).join(", ")}`;

/** K1, K2, K10, K11: the registry's own exposure rules (core/src/schema/capture/properties.ts `exposureProblems`), reused as they are. */
export function checkExposure(props: readonly PropertyDef[]): Problem[] {
  const out: Problem[] = [];
  for (const line of exposureProblems(props)) {
    const m = /^(.+?): (K1|K2|K10|K11) (.*)$/.exec(line);
    if (m) out.push({ rule: m[2] as Rule, key: m[1]!, detail: m[3]! });
  }
  return out;
}

/** K3: a property marked R or R? on a type has a home (or derived) on that layer, unless the row is `reserved`. */
export function checkK3(props: readonly PropertyDef[], types: readonly TypeMarks[]): Problem[] {
  const byKey = new Map(props.map((p) => [p.key, p]));
  const bad = new Map<string, string[]>();
  for (const t of types) for (const l of t.records) for (const [k, m] of Object.entries(t.layers[l]?.base ?? {})) {
    const p = byKey.get(k);
    if (!p || (m !== "R" && m !== "R?") || p.reserved) continue;
    if (homeOf(p, l).in === "none") bad.set(k, [...(bad.get(k) ?? []), t.id]);
  }
  return [...bad].map(([key, ids]) => ({ rule: "K3" as const, key, detail: `marked R or R? on ${examples([...new Set(ids)])} but has no home` }));
}

/** K4: every `rest!` property and every money (K5 keep) property is in a freshness class. */
export function checkK4(props: readonly PropertyDef[], freshness: Freshness): Problem[] {
  const keys = freshKeys(freshness);
  return props.filter((p) => (p.display.includes("rest!") || p.keep.includes("money")) && !keys.has(p.key)).map((p) => ({ rule: "K4" as const, key: p.key, detail: `${p.display.includes("rest!") ? "rest! display" : "money"} property in no freshness class` }));
}

/** K5: every filter band and every `row:` list exposure names a PlaceRow key. */
export function checkK5(props: readonly PropertyDef[], rowKeys: readonly string[]): Problem[] {
  const rows = new Set(rowKeys);
  const out: Problem[] = [];
  for (const p of props) {
    if (p.filter?.band && !rows.has(p.filter.band)) out.push({ rule: "K5", key: p.key, detail: `filter band "${p.filter.band}" is not a PlaceRow key` });
    for (const l of p.expose.list) if (l.startsWith("row:") && !rows.has(l.slice(4))) out.push({ rule: "K5", key: p.key, detail: `list row "${l.slice(4)}" is not a PlaceRow key` });
  }
  return out;
}

const NEEDS_UNIT = new Set(["number", "range", "limit"]);
const NUMERIC = new Set(["number", "range", "limit", "duration"]);
/** key suffix -> the unit a numeric property with that suffix must carry */
const SUFFIX_UNIT: Record<string, string> = { _m: "m", _km: "km", _min: "min", _kg: "kg", _cm: "cm", _c: "°C", _pct: "%" };

/** K6: number, range and limit values carry a unit (or "rule"); a key with a unit suffix is numeric and its unit matches the suffix. */
export function checkK6(props: readonly PropertyDef[]): Problem[] {
  const out: Problem[] = [];
  for (const p of props) {
    const suffix = Object.keys(SUFFIX_UNIT).find((s) => p.key.endsWith(s));
    if (NEEDS_UNIT.has(p.value) && !p.unit) out.push({ rule: "K6", key: p.key, detail: `${p.value} value with no unit` });
    if (!suffix) continue;
    const want = SUFFIX_UNIT[suffix]!;
    if (!NUMERIC.has(p.value)) out.push({ rule: "K6", key: p.key, detail: `key ends ${suffix} (numeric) but the value type is ${p.value}` });
    else if (p.unit && p.unit !== want && p.value !== "duration") out.push({ rule: "K6", key: p.key, detail: `unit "${p.unit}" does not match the ${suffix} suffix (${want})` });
  }
  return out;
}

const humanised = (path: string): string => { const s = path.split(".").slice(1).join(" ").replace(/_/g, " "); return s[0]!.toUpperCase() + s.slice(1); };

/** K7: a property shown at rest!, rest or card has an authored label (an `ext.` path whose label is just the humanised key is not: reword it, the registry does not record which labels were authored). */
export function checkK7(props: readonly PropertyDef[]): Problem[] {
  return props
    .filter((p) => p.display.some((d) => d === "rest!" || d === "rest" || d === "card") && (p.label.trim() === "" || (p.key.startsWith("ext.") && p.label === humanised(p.key))))
    .map((p) => ({ rule: "K7" as const, key: p.key, detail: "no authored label" }));
}

/** K8: every key of the public read models has an exposure row with a privacy and an MCP exposure, and every row has a key. */
export function checkK8(envelope: MatrixInputs["envelope"], shapeKeys: MatrixInputs["shapeKeys"]): Problem[] {
  const out: Problem[] = [];
  for (const m of READ_MODELS) {
    const rows = envelope[m] ?? {};
    for (const k of shapeKeys[m] ?? []) if (!rows[k] || !rows[k]!.privacy || !rows[k]!.mcp) out.push({ rule: "K8", key: `${m}.${k}`, detail: "read-model key with no exposure row" });
    for (const k of Object.keys(rows)) if (!(shapeKeys[m] ?? []).includes(k)) out.push({ rule: "K8", key: `${m}.${k}`, detail: "exposure row for a key the read model does not have" });
  }
  return out;
}

/** K9: a node or layer rule marks (R, R? or A) a property on a layer the property's `layers` excludes: the resolver drops it silently. */
export function checkK9(props: readonly PropertyDef[], raw: readonly RawMark[]): Problem[] {
  const byKey = new Map(props.map((p) => [p.key, p]));
  const seen = new Set<string>();
  const out: Problem[] = [];
  for (const r of raw) {
    const p = byKey.get(r.key);
    if (!p || !p.layers || r.mark === "N" || p.home.in === "suitability") continue;
    const lay = r.layer ? [r.layer] : r.records;
    if (lay.length === 0 || lay.some((l) => p.layers!.includes(l))) continue; // alive on at least one layer it applies to
    const id = `${r.from}:${r.key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ rule: "K9", key: id, detail: `marks ${r.key} ${r.mark} on ${lay.join("/")}, but the property exists only on ${p.layers.join("/")}` });
  }
  return out;
}

/** Surfaces that appeared after a release: a property deprecated before that release must not be on them (K12). */
export const SURFACE_ADDED_IN: Readonly<Record<string, string>> = { mcp: "v0.19" };
const versionOf = (v: string): number[] | null => { const m = /^v(\d+)\.(\d+)(?:\.(\d+))?$/.exec(v); return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null; };
const before = (a: number[], b: number[]): boolean => { for (let i = 0; i < 3; i++) if (a[i]! !== b[i]!) return a[i]! < b[i]!; return false; };

/** K12: a deprecated property names its release (vX.Y) and is absent from every surface added after that release. */
export function checkK12(props: readonly PropertyDef[], added: Readonly<Record<string, string>> = SURFACE_ADDED_IN): Problem[] {
  const out: Problem[] = [];
  for (const p of props) {
    if (!p.deprecated) continue;
    const rel = versionOf(p.deprecated);
    if (!rel) { out.push({ rule: "K12", key: p.key, detail: `deprecated "${p.deprecated}" is not a release (vX.Y)` }); continue; }
    for (const [surface, since] of Object.entries(added)) {
      const sv = versionOf(since)!;
      const e = p.expose as unknown as Record<string, unknown>;
      const on = Array.isArray(e[surface]) ? (e[surface] as unknown[]).length > 0 : e[surface] !== "none" && e[surface] !== "no" && e[surface] !== undefined;
      if (on && before(rel, sv)) out.push({ rule: "K12", key: p.key, detail: `deprecated in ${p.deprecated}, still on ${surface} (added ${since})` });
    }
  }
  return out;
}

/** Every rule over one set of inputs, sorted by rule then key. */
export function matrixProblems(i: MatrixInputs): Problem[] {
  const all = [
    ...checkExposure(i.props), ...checkK3(i.props, i.types), ...checkK4(i.props, i.freshness), ...checkK5(i.props, i.rowKeys), ...checkK6(i.props),
    ...checkK7(i.props), ...checkK8(i.envelope, i.shapeKeys), ...checkK9(i.props, i.rawMarks), ...checkK12(i.props),
  ];
  const order = (r: Rule): number => RULES.indexOf(r);
  return all.sort((a, b) => order(a.rule) - order(b.rule) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

// ---- the allow list -----------------------------------------------------------------------------------------------------------

export interface AllowEntry { rule: Rule; key: string; reason: string }
export interface AllowFile { schema: "property-matrix-allow/1"; note: string; entries: AllowEntry[] }

export function loadAllow(root: string): AllowFile {
  return readJson<AllowFile>(root, ALLOW_PATH);
}

export interface Judged {
  /** breaks not on the list: they fail the build */
  fresh: Problem[];
  /** breaks on the list: tolerated until FA-4 */
  allowed: Problem[];
  /** list entries that no longer break, or are not allowable: they fail the build until removed */
  stale: AllowEntry[];
}

/** The allow list only shrinks: a new break fails, an entry that no longer breaks fails (so it gets removed). */
export function judge(problems: readonly Problem[], allow: AllowFile): Judged {
  const listed = new Map(allow.entries.map((e) => [problemId(e), e]));
  const fresh: Problem[] = [];
  const allowed: Problem[] = [];
  const hit = new Set<string>();
  for (const p of problems) {
    const id = problemId(p);
    if ((ALLOWABLE as readonly string[]).includes(p.rule) && listed.has(id)) { allowed.push(p); hit.add(id); } else fresh.push(p);
  }
  const stale = allow.entries.filter((e) => !hit.has(problemId(e)) || !(ALLOWABLE as readonly string[]).includes(e.rule));
  return { fresh, allowed, stale };
}

// ---- the matrix ---------------------------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const one = (x: unknown): string => JSON.stringify(x);

/** The main types of the page snapshot (section 3.1, 7): the md table columns. */
export const SNAPSHOT_TYPES: readonly { code: string; id: string; layer: RecordLayer }[] = [
  { code: "NP", id: "nature.protected.national_park", layer: "place" }, { code: "PP", id: "nature.protected.state_provincial_park", layer: "place" },
  { code: "Trail", id: "nature.trail.hike", layer: "route" }, { code: "Lake", id: "water.body.lake", layer: "place" },
  { code: "View", id: "nature.viewpoint.viewpoint", layer: "place" }, { code: "CampP", id: "stay.camp.campground", layer: "place" },
  { code: "CampO", id: "stay.camp.campground", layer: "offer" }, { code: "Drive", id: "wheels.drive.scenic_drive", layer: "route" },
  { code: "Pass", id: "access.pass.park_pass", layer: "offer" }, { code: "Permit", id: "access.pass.backcountry_permit", layer: "offer" },
  { code: "Tour", id: "culture.tour.guided_tour", layer: "offer" }, { code: "Rental", id: "water.paddle.canoe.rental", layer: "offer" },
  { code: "HotelP", id: "stay.room.hotel", layer: "place" }, { code: "HotelO", id: "stay.room.hotel", layer: "offer" },
  { code: "Event", id: "event.natural.larch", layer: "event" },
];

function markOf(t: TypeMarks | undefined, layer: RecordLayer, key: string): string {
  if (!t) return "";
  const rl = t.layers[layer];
  if (!rl) return "";
  const m = rl.base[key];
  if (m) return m;
  const s = t.suitability[key];
  return s === "R" ? "R" : s === "A" ? "A" : s === "op" ? "Ro" : "";
}

export interface Matrix { json: string; md: string; problems: Problem[]; counts: { properties: number; types: number; envelope: number } }

/** The matrix document. `header` is the Generated line the writer puts in both files. */
export function buildMatrix(i: MatrixInputs, header: string, updated: string): Matrix {
  const fresh = new Map<string, string>();
  for (const c of i.freshness.classes) for (const f of c.fields) fresh.set(f, c.id);
  const strongest = (key: string): { R: number; "R?": number; A: number } => {
    const n = { R: 0, "R?": 0, A: 0 };
    for (const t of i.types) {
      const ms = new Set<string>();
      for (const l of t.records) ms.add(markOf(t, l, key));
      const best = ["R", "Ro", "R?", "A"].find((m) => ms.has(m));
      if (best === "R") n.R++; else if (best === "Ro" || best === "R?") n["R?"]++; else if (best === "A") n.A++;
    }
    return n;
  };
  const props = i.props.map((p, order) => {
    const n = strongest(p.key);
    const required = n.R > 0 ? "required" : n["R?"] > 0 ? "conditional" : n.A > 0 ? "optional" : "never asked";
    return {
      key: p.key, group: p.group, label: p.label, value: p.value, unit: p.unit ?? null, home: p.home, ...(p.homeByLayer ? { home_by_layer: p.homeByLayer } : {}),
      layers: p.layers ?? "all", required, types: n, lanes: p.lanes ?? "type", freshness: fresh.get(p.key) ?? "none", keep: p.keep, privacy: p.privacy, expose: p.expose,
      display: { levels: p.display, section: p.section, order, label: p.label, unit: p.unit ?? null, gap: p.gap, ...(p.filter ? { filter: p.filter.control, band: p.filter.band ?? null } : {}) },
      ...(p.deprecated ? { deprecated: p.deprecated } : {}), ...(p.reserved ? { reserved: p.reserved } : {}), ...(p.pageTask ? { page_task: p.pageTask } : {}),
    } as Obj;
  });

  // marks per type id; a type whose marks equal its nearest listed ancestor's says `inherits`
  const typeEntry = (t: TypeMarks): Obj => {
    const layers: Obj = {};
    for (const l of t.records) layers[l] = { offer_class: t.layers[l]!.offer_class, base: t.layers[l]!.base };
    return { label: t.label, records: t.records, sources: t.sources, layers, suitability: t.suitability };
  };
  const ids = new Set(i.types.map((t) => t.id));
  const typeLines: string[] = [];
  const last = new Map<string, string>();
  for (const t of i.types) {
    const e = typeEntry(t);
    let parent = t.id;
    let inherits: string | null = null;
    while (parent.includes(".")) { parent = parent.slice(0, parent.lastIndexOf(".")); if (ids.has(parent)) { inherits = parent; break; } }
    const body = one({ ...e, label: undefined, sources: undefined });
    const same = inherits !== null && last.get(inherits) === body;
    last.set(t.id, body);
    typeLines.push(`    ${one(t.id)}: ${one(same ? { label: t.label, inherits } : e)}`);
  }

  const envelope: Obj[] = [];
  for (const m of READ_MODELS) for (const [k, e] of Object.entries(i.envelope[m]).sort(([a], [b]) => (a < b ? -1 : 1))) envelope.push({ model: m, key: k, privacy: e.privacy, mcp: e.mcp, ...(e.note ? { note: e.note } : {}) });

  const keysWhere = (f: (p: PropertyDef) => boolean): string[] => i.props.filter(f).map((p) => p.key);
  const surfaces: Obj = {
    page: keysWhere((p) => p.expose.page !== "no"),
    trip: { day: keysWhere((p) => p.expose.trip.includes("day")), book: keysWhere((p) => p.expose.trip.includes("book")), sum: keysWhere((p) => p.expose.trip.includes("sum")) },
    list: { row: keysWhere((p) => p.expose.list.some((l) => l.startsWith("row:"))), facet: keysWhere((p) => p.expose.list.includes("facet")), search: keysWhere((p) => p.expose.list.includes("search")) },
    export: { print: keysWhere((p) => p.expose.export.includes("print")), csv: keysWhere((p) => p.expose.export.includes("csv")), gpx: keysWhere((p) => p.expose.export.includes("gpx")), ics: keysWhere((p) => p.expose.export.includes("ics")) },
    api: { row: keysWhere((p) => p.expose.api === "row"), detail: keysWhere((p) => p.expose.api === "detail") },
    mcp: { public: keysWhere((p) => p.expose.mcp === "public"), private: keysWhere((p) => p.expose.mcp === "private") },
  };

  const json = [
    "{",
    `  "schema": ${one(MATRIX_SCHEMA)},`,
    `  "note": ${one(header)},`,
    `  "updated": ${one(updated)},`,
    `  "rules": ${one(RULES)},`,
    '  "properties": [',
    ...props.map((p, n) => `    ${one(p)}${n < props.length - 1 ? "," : ""}`),
    "  ],",
    '  "types": {',
    typeLines.join(",\n"),
    "  },",
    '  "envelope": [',
    ...envelope.map((e, n) => `    ${one(e)}${n < envelope.length - 1 ? "," : ""}`),
    "  ],",
    `  "surfaces": ${one(surfaces)}`,
    "}",
    "",
  ].join("\n");

  // ---- the md: the property table, the marks snapshot, the read-model keys
  const md: string[] = [];
  md.push("# Property matrix", "", `<!-- ${header} -->`, "");
  md.push(`${i.props.length} properties, ${i.types.length} type ids, ${envelope.length} read-model keys. Rules and families: [property-display-matrix](../../../docs/v2/features/property-display-matrix.md). To change a row, edit the registry (\`core/src/schema/capture/properties.ts\`) or \`data/vocab/types.json\`, then run \`node core/bin/capture.ts build\`.`, "");
  md.push("## Properties", "");
  md.push("Required: R on some type, conditional (R?), optional (A) or never asked. Page is the strongest display level. Lists: row keys, facet, search, rank, sort. Lanes: the property's own order, else the type's.", "");
  md.push("| Key | Value | Unit | Home | Required | Lanes | Fresh | Priv | Page | Trip | List | Export | API | MCP |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const cell = (xs: readonly string[]): string => (xs.length ? xs.join(" ") : "-");
  for (const p of i.props) {
    const e = p.expose;
    md.push(`| \`${p.key}\` | ${p.value} | ${p.unit ?? "-"} | ${p.home.in} | ${(props.find((x) => x.key === p.key)!.required as string)} | ${Array.isArray(p.lanes) ? p.lanes.join("") : "type"} | ${fresh.get(p.key) ?? "-"} | ${p.privacy} | ${e.page} | ${cell(e.trip)} | ${cell(e.list)} | ${cell(e.export)} | ${e.api} | ${e.mcp} |`);
  }
  md.push("", "## Marks per main type", "", "R required, R? required when its condition holds, A applicable, Ro required when operated, blank never asked. Offer columns (CampO, HotelO) are the offer layer of the same type id.", "");
  md.push(`| Property | ${SNAPSHOT_TYPES.map((s) => s.code).join(" | ")} |`, `|---|${SNAPSHOT_TYPES.map(() => "---").join("|")}|`);
  const byId = new Map(i.types.map((t) => [t.id, t]));
  for (const p of i.props) {
    const cells = SNAPSHOT_TYPES.map((s) => markOf(byId.get(s.id), s.layer, p.key));
    if (cells.some((c) => c !== "")) md.push(`| \`${p.key}\` | ${cells.join(" | ")} |`);
  }
  md.push("", "## Read-model keys", "", "| Model | Key | Privacy | MCP |", "|---|---|---|---|");
  for (const e of envelope) md.push(`| ${e.model} | \`${e.key}\` | ${e.privacy} | ${e.mcp} |`);
  md.push("");

  return { json, md: md.join("\n"), problems: matrixProblems(i), counts: { properties: i.props.length, types: i.types.length, envelope: envelope.length } };
}

