// The reference families of the seed (LOCAL-2; spec 2.4): vocab (type_node, tag, relevance_class), geography (area, town), operator,
// source, and the catalogue_meta stamp. Pure: every builder takes a FileSource and returns rows; none opens a database.
//
// A row here is the row as the database holds it, in the shape the engine hashes: every column the seed writes is present (null
// when the JSON has no value), geometry is an EWKT string, a date is `yyyy-mm-dd`. The read-back SQL (`read`) produces the same
// shape, so a row the engine wrote hashes the same when it reads it back (the idempotency rule, spec 6.3).
//
// Mapping choices the spec leaves open are marked DECISION and listed in the build notes.
import { z } from "zod";
import { SEED_COMMIT_KEY, assertSeedTable, rowRefusals, type SeedRefusal, type SeedTableSpec } from "../../../seed/index.ts";
import type { FileSource } from "./files.ts";

export type Row = Record<string, unknown>;

/** One column of a seed table: how it is sent (a jsonb recordset), written, and read back. */
export interface ColumnDef {
  /** column name in the table and key in the row */
  name: string;
  /** the type it has in the recordset (`jsonb_to_recordset ... as x(name type)`) */
  type: string;
  /** SQL that turns the recordset value `x."name"` into the column value; default: the value itself */
  write?: string;
  /** SQL that reads the column back into the row's shape; default: the column itself */
  read?: string;
}

export interface TableData {
  spec: SeedTableSpec;
  columns: readonly ColumnDef[];
  /** columns that identify the row in the recordset (the key) */
  key: readonly string[];
  /** columns the content hash covers; default all columns. catalogue_meta hashes its key only (the value is a stamp) */
  hashColumns?: readonly string[];
  /** rows in apply order (a parent before its children) */
  rows: Row[];
  /** the repository files the rows came from */
  files: string[];
}

export class SeedInputError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SeedInputError";
  }
}

const bad = (file: string, message: string): never => {
  throw new SeedInputError("E_SEED_INPUT", `${file}: ${message}`);
};

function readJson<T>(src: FileSource, file: string, schema: z.ZodType<T>): T {
  let doc: unknown;
  try {
    doc = JSON.parse(src.read(file));
  } catch (err) {
    return bad(file, `cannot read as JSON (${err instanceof SyntaxError ? "syntax error" : "missing file"})`);
  }
  const r = schema.safeParse(doc);
  if (!r.success) {
    const i = r.error.issues[0]!;
    return bad(file, `${i.path.join(".") || "(root)"}: ${i.message}`);
  }
  return r.data;
}

function oneFile(src: FileSource, spec: SeedTableSpec): string {
  const { files, denied } = src.expand(spec.inputs.filter((i) => !i.sections));
  if (denied.length) throw new SeedInputError("E_SEED_DENIED_INPUT", `${spec.table}: input on the deny list: ${denied.join(", ")}`);
  if (files.length !== 1) return bad(spec.inputs[0]!.glob, `expected exactly one file, found ${files.length}`);
  return files[0]!;
}

const text = z.string();
const nullableText = z.string().nullable().optional();

// ---- vocab -------------------------------------------------------------------------------------------------------------------------
const TYPE_LEVELS = ["domain", "category", "type", "subtype"] as const;
const typesFile = z.object({
  schema: z.literal("capture-types/1"),
  nodes: z.array(z.object({
    id: text.min(1), parent: z.string().nullable(), level: z.enum(TYPE_LEVELS), label: text.min(1),
    records: z.array(text).optional(), profile: z.string().optional(),
  }).passthrough()),
});

/** Keys of a type node that have their own column; everything else (marks, links, display, aliases, legacy ids) is the `doc`. */
const TYPE_NODE_COLUMNS = ["id", "parent", "level", "label", "records", "profile"];

function typeNodes(src: FileSource, spec: SeedTableSpec): TableData {
  const file = oneFile(src, spec);
  const f = readJson(src, file, typesFile);
  const byId = new Map(f.nodes.map((n) => [n.id, n]));
  if (byId.size !== f.nodes.length) bad(file, "duplicate type node id");
  const depth = (id: string, seen = new Set<string>()): number => {
    const n = byId.get(id)!;
    if (n.parent === null) return 0;
    if (!byId.has(n.parent)) return bad(file, `type node ${id} has an unknown parent`);
    if (seen.has(id)) return bad(file, `type node ${id} is in a parent cycle`);
    return 1 + depth(n.parent, new Set(seen).add(id));
  };
  const rows = f.nodes
    .map((n) => ({ n, d: depth(n.id) }))
    .sort((a, b) => a.d - b.d || (a.n.id < b.n.id ? -1 : 1))
    .map(({ n }): Row => ({
      id: n.id, parent_id: n.parent, level: n.level, label: n.label, records: n.records ?? null, profile: n.profile ?? null,
      doc: Object.fromEntries(Object.entries(n).filter(([k]) => !TYPE_NODE_COLUMNS.includes(k))),
    }));
  return {
    spec, key: ["id"], files: [file], rows,
    columns: [
      { name: "id", type: "text" }, { name: "parent_id", type: "text" }, { name: "level", type: "text" }, { name: "label", type: "text" },
      { name: "records", type: "text[]" }, { name: "profile", type: "text" }, { name: "doc", type: "jsonb" },
    ],
  };
}

const tagsFile = z.object({ tags: z.array(z.object({ id: text.min(1) }).passthrough()) });

function tags(src: FileSource, spec: SeedTableSpec): TableData {
  const file = oneFile(src, spec);
  const f = readJson(src, file, tagsFile);
  const rows = uniqueBy(file, "tag id", f.tags, (t) => t.id).map((t): Row => ({ id: t.id, doc: Object.fromEntries(Object.entries(t).filter(([k]) => k !== "id")) }));
  return { spec, key: ["id"], files: [file], rows, columns: [{ name: "id", type: "text" }, { name: "doc", type: "jsonb" }] };
}

const relevanceClassesFile = z.object({ schema: z.literal("relevance-classes/1"), classes: z.array(z.object({ key: text.min(1) }).passthrough()) });

function relevanceClasses(src: FileSource, spec: SeedTableSpec): TableData {
  const file = oneFile(src, spec);
  const f = readJson(src, file, relevanceClassesFile);
  const rows = uniqueBy(file, "relevance class key", f.classes, (c) => c.key).map((c): Row => ({ key: c.key, doc: Object.fromEntries(Object.entries(c).filter(([k]) => k !== "key")) }));
  return { spec, key: ["key"], files: [file], rows, columns: [{ name: "key", type: "text" }, { name: "doc", type: "jsonb" }] };
}

function uniqueBy<T>(file: string, what: string, items: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  for (const i of items) {
    const k = key(i);
    if (seen.has(k)) bad(file, `duplicate ${what} ${k}`);
    seen.add(k);
  }
  return [...items];
}

// ---- geography ---------------------------------------------------------------------------------------------------------------------
const countriesFile = z.record(z.string(), z.object({ a2: z.string().regex(/^[A-Z]{2}$/), a3: z.string().regex(/^[A-Z]{3}$/), name: text.min(1) }));
const locationsAreas = z.object({
  countries: z.array(z.object({ code: z.string().regex(/^[A-Z]{2}$/), a3: z.string().regex(/^[A-Z]{3}$/).optional(), name: text.min(1) })),
  regions: z.array(z.object({ id: text.min(1), country: z.string().regex(/^[A-Z]{2}$/), code: text.min(1), name: text.min(1), iso_3166_2: nullableText })),
  areas: z.array(z.object({ id: text.min(1), region_id: text.min(1), slug: nullableText, name: text.min(1) })),
});

/** The ltree path of an area id: `-` becomes `_` and `/` becomes `.` (NEON-MIGRATIONS 0003). */
export const areaPath = (id: string): string => id.replace(/-/g, "_").replace(/\//g, ".");

const AREA_ID_RE = /^[A-Za-z0-9/-]+$/;

function areas(src: FileSource, spec: SeedTableSpec): TableData {
  const countriesPath = spec.inputs.find((i) => !i.sections)!;
  const locationsPath = spec.inputs.find((i) => i.sections)!;
  const cFile = oneFile(src, { ...spec, inputs: [countriesPath] });
  const lFile = oneFile(src, { ...spec, inputs: [{ glob: locationsPath.glob }] });
  const countries = readJson(src, cFile, countriesFile);
  // Only the public chain is read from the locations store: the three sections named in the contract, nothing else is parsed.
  const sectionsOnly = (() => {
    const whole = JSON.parse(src.read(lFile)) as Record<string, unknown>;
    return Object.fromEntries((locationsPath.sections ?? []).map((k) => [k, whole[k]]));
  })();
  const chain = (() => {
    const r = locationsAreas.safeParse(sectionsOnly);
    if (!r.success) return bad(lFile, `${r.error.issues[0]!.path.join(".")}: ${r.error.issues[0]!.message}`);
    return r.data;
  })();

  const rows: Row[] = [];
  const ids = new Set<string>();
  const add = (row: Row, file: string): void => {
    const id = row.id as string;
    if (!AREA_ID_RE.test(id)) bad(file, `area id ${id} has characters an ltree path cannot hold`);
    if (ids.has(id)) bad(file, `duplicate area id ${id}`);
    ids.add(id);
    rows.push({ slug: null, iso_code: null, iso_a3: null, wikidata_qid: null, tz: null, ...row, path: areaPath(id) });
  };
  // DECISION: a country's area id is its ISO 3166-1 alpha-2 code; the countries file (249) is the base, the locations store adds none that it lacks.
  const names = new Map<string, { a3: string | null; name: string }>();
  for (const c of Object.values(countries)) names.set(c.a2, { a3: c.a3, name: c.name });
  for (const c of chain.countries) if (!names.has(c.code)) names.set(c.code, { a3: c.a3 ?? null, name: c.name });
  for (const [code, c] of [...names].sort(([a], [b]) => (a < b ? -1 : 1))) {
    add({ id: code, parent_id: null, level: "country", name: c.name, iso_code: code, iso_a3: c.a3 }, cFile);
  }
  for (const r of [...chain.regions].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!names.has(r.country)) bad(lFile, `region ${r.id} names an unknown country ${r.country}`);
    add({ id: r.id, parent_id: r.country, level: "region", name: r.name, iso_code: r.iso_3166_2 ?? null }, lFile);
  }
  const regionIds = new Set(chain.regions.map((r) => r.id));
  for (const a of [...chain.areas].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    if (!regionIds.has(a.region_id)) bad(lFile, `area ${a.id} names an unknown region ${a.region_id}`);
    add({ id: a.id, parent_id: a.region_id, level: "area", name: a.name, slug: a.slug ?? null }, lFile);
  }
  return {
    spec, key: ["id"], files: [cFile, lFile], rows,
    columns: [
      { name: "id", type: "text" }, { name: "parent_id", type: "text" }, { name: "path", type: "text", write: `x."path"::ltree`, read: `"path"::text` },
      { name: "level", type: "text" }, { name: "name", type: "text" }, { name: "slug", type: "text" }, { name: "iso_code", type: "text" },
      { name: "iso_a3", type: "text" }, { name: "wikidata_qid", type: "text" }, { name: "tz", type: "text" },
    ],
  };
}

const townsFile = z.object({
  schema: z.literal("towns-part/1"),
  cc: z.string().regex(/^[a-z]{2}$/),
  admin1: z.record(z.string(), z.string()),
  rows: z.array(z.tuple([text.min(1), text.min(1), z.number(), z.number(), z.number().int(), z.string(), z.string(), z.number().int()])),
});
const townsManifest = z.object({ schema: z.literal("towns-manifest/1"), source: z.object({ licence: z.object({ id: text.min(1) }) }) });

/** The row layout of a towns part: id, name, lat, lon, population, admin1, ascii, geonames_id (the manifest's `row`). */
function towns(src: FileSource, spec: SeedTableSpec, areaIds: ReadonlySet<string>): TableData {
  const { files, denied } = src.expand(spec.inputs);
  if (denied.length) throw new SeedInputError("E_SEED_DENIED_INPUT", `town: input on the deny list: ${denied.join(", ")}`);
  const manifestFile = files.find((f) => f.endsWith("/manifest.json"));
  if (!manifestFile) return bad(spec.inputs[0]!.glob, "no manifest.json (the GeoNames licence)");
  const licence = readJson(src, manifestFile, townsManifest).source.licence.id;
  const rows: Row[] = [];
  const parts: string[] = [];
  const seenId = new Set<string>();
  const seenGeo = new Set<number>();
  for (const file of files.filter((f) => f !== manifestFile)) {
    const part = readJson(src, file, townsFile);
    parts.push(file);
    const cc = part.cc.toUpperCase();
    for (const [id, name, lat, lon, pop, admin1, ascii, geonamesId] of part.rows) {
      if (seenId.has(id)) bad(file, `duplicate town id ${id}`);
      if (seenGeo.has(geonamesId)) bad(file, `duplicate geonames id ${geonamesId}`);
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) bad(file, `town ${id} has a coordinate out of range`);
      seenId.add(id);
      seenGeo.add(geonamesId);
      // DECISION: region_id points at the area `CC/ADMIN1` when the locations chain has it, else null; admin1 keeps the GeoNames code.
      const region = `${cc}/${admin1.toUpperCase()}`;
      rows.push({
        id, cc, admin1: admin1 || null, region_id: areaIds.has(region) ? region : null, name, ascii: ascii || null,
        point: `SRID=4326;POINT(${lon} ${lat})`, pop, geonames_id: geonamesId, wikidata_qid: null, is_base: false, is_hub: false, licence,
      });
    }
  }
  rows.sort((a, b) => ((a.id as string) < (b.id as string) ? -1 : 1));
  return {
    spec, key: ["id"], files: [manifestFile, ...parts], rows,
    columns: [
      { name: "id", type: "text" }, { name: "cc", type: "text" }, { name: "admin1", type: "text" }, { name: "region_id", type: "text" },
      { name: "name", type: "text" }, { name: "ascii", type: "text" },
      { name: "point", type: "text", write: `x."point"::geography`, read: `ST_AsText("point", 7)` },
      { name: "pop", type: "int" }, { name: "geonames_id", type: "int" }, { name: "wikidata_qid", type: "text" },
      { name: "is_base", type: "boolean" }, { name: "is_hub", type: "boolean" }, { name: "licence", type: "text" },
    ],
  };
}

// ---- operator, source ---------------------------------------------------------------------------------------------------------------
const operatorsFile = z.object({
  schema: z.literal("capture-operators/1"),
  operators: z.array(z.object({ ref: z.string().regex(/^operator\/[a-z0-9-]+$/), name: text.min(1), url: nullableText })),
});

function operators(src: FileSource, spec: SeedTableSpec): TableData {
  const file = oneFile(src, spec);
  const f = readJson(src, file, operatorsFile);
  // DECISION: the operator's doc stays empty. `derived_from` names suitability files and belongs to the evidence tier (RIS-L).
  const rows = uniqueBy(file, "operator ref", f.operators, (o) => o.ref).map((o): Row => ({
    ref: o.ref, name: o.name, url: o.url ?? null, terms_url: null, waiver_url: null, phone: null, licence: null, doc: {},
  })).sort((a, b) => ((a.ref as string) < (b.ref as string) ? -1 : 1));
  return {
    spec, key: ["ref"], files: [file], rows,
    columns: ["ref", "name", "url", "terms_url", "waiver_url", "phone", "licence"].map((name) => ({ name, type: "text" })).concat([{ name: "doc", type: "jsonb" }]),
  };
}

const sourcesFile = z.object({
  schema: z.literal("sources/1"),
  entries: z.array(z.object({
    id: z.string().regex(/^s-[0-9a-f]{10}$/), url: text.min(1), title: text, publisher: text, kind: text.min(1),
    first_read: z.iso.date(), last_read: z.iso.date(), licence_note: text, terms_note: text,
    automated: z.enum(["allowed", "forbidden", "unknown"]),
    recheck: z.object({ cadence_days: z.number().int().min(1), fact_type: text }),
    link: z.object({ status: text.min(1), checked: z.iso.date().nullable() }),
  })),
});

function sources(src: FileSource, spec: SeedTableSpec): TableData {
  const file = oneFile(src, spec);
  const f = readJson(src, file, sourcesFile);
  const entries = uniqueBy(file, "source url", uniqueBy(file, "source id", f.entries, (e) => e.id), (e) => e.url);
  const rows = entries.map((e): Row => ({
    id: e.id, url: e.url, publisher: e.publisher, title: e.title, kind: e.kind, licence: null, first_read: e.first_read, last_read: e.last_read,
    licence_note: e.licence_note, terms_note: e.terms_note,
    // DECISION: the column is a boolean: `allowed` is true, `forbidden` false, `unknown` null (not decided).
    automated: e.automated === "allowed" ? true : e.automated === "forbidden" ? false : null,
    recheck: e.recheck, link_status: e.link.status, http_status: null, final_url: null, link_checked: e.link.checked,
  })).sort((a, b) => ((a.id as string) < (b.id as string) ? -1 : 1));
  const date = (name: string): ColumnDef => ({ name, type: "text", write: `x."${name}"::date`, read: `"${name}"::text` });
  return {
    spec, key: ["id"], files: [file], rows,
    columns: [
      ...["id", "url", "publisher", "title", "kind", "licence"].map((name): ColumnDef => ({ name, type: "text" })),
      date("first_read"), date("last_read"),
      { name: "licence_note", type: "text" }, { name: "terms_note", type: "text" }, { name: "automated", type: "boolean" },
      { name: "recheck", type: "jsonb" }, { name: "link_status", type: "text" }, { name: "http_status", type: "smallint" },
      { name: "final_url", type: "text" }, date("link_checked"),
    ],
  };
}

// ---- the stamp ---------------------------------------------------------------------------------------------------------------------
function meta(spec: SeedTableSpec, commit: string): TableData {
  // The revision key of catalogue_meta needs every family (RIS-L); until then the table holds the commit the last run loaded. The
  // value is a stamp, not content: it is outside the hash, so a commit that changes no data does not make the plan non-empty.
  return {
    spec, key: ["key"], hashColumns: ["key"], files: [],
    rows: [{ key: SEED_COMMIT_KEY, value: commit }],
    columns: [{ name: "key", type: "text" }, { name: "value", type: "text" }],
  };
}

// ---- the whole reference seed -------------------------------------------------------------------------------------------------------
export interface BuiltSeed {
  /** one entry per LOCAL-2 table, in apply order */
  tables: TableData[];
  /** refusals found in the rows (origin refs, owner list keys); the engine stops before it writes when there is one */
  refusals: SeedRefusal[];
}

/** The seed tables LOCAL-2 owns, in apply order, with their builders. */
export function buildReferenceSeed(src: FileSource, commit: string, spec: (table: string) => SeedTableSpec = assertSeedTable): BuiltSeed {
  const built: TableData[] = [];
  built.push(typeNodes(src, spec("type_node")), tags(src, spec("tag")), relevanceClasses(src, spec("relevance_class")));
  const area = areas(src, spec("area"));
  built.push(area);
  built.push(towns(src, spec("town"), new Set(area.rows.map((r) => r.id as string))));
  built.push(operators(src, spec("operator")), sources(src, spec("source")), meta(spec("catalogue_meta"), commit));
  const refusals = built.flatMap((t) => t.rows.flatMap((r) => rowRefusals(t.spec.table, r, 5)));
  return { tables: built, refusals };
}
