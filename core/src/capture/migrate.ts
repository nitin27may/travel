// Backlog 3a.12 step 4, SP3: the migration of the lane sidecars to the capture model.
//
// Reads data/suitability, data/relevance, the reviewed assignment of a type to every record (data/capture/type-map.json) and the
// reviewed splits of the 61 records that mix layers (data/capture/splits/<trip>.json), and writes:
//   - data/capture/<trip>/migrated.json   one capture record per ref (type, layer, name, relations) plus the records cut out;
//   - data/capture/operators.json         the operators the offers name in their own sources;
//   - the suitability and relevance lane files that change (a lift's block moves to its ticket offer, the effort of a place's
//     long walk moves to a new route, a payoff's relevance moves to the payoff place).
//
// Rules, from the spec 2.7 and the owner's "no value lost, none invented":
//   - Every value keeps its basis, sources, quote and note byte for byte. A value moves between records of one file, so its src
//     ids keep their meaning; a value is never copied.
//   - A new record carries only identity and relations (and a moved value, when the spec says the layer owns it). A name of a new
//     record comes from a name already in the data. A field no record carried stays absent: it is a gap, not a guess.
//   - A relevance judgement that a deduplicated payoff place already has its own of is kept verbatim in the splits file
//     (`displaced_relevance`) for the reviewer; nothing is dropped.
//   - Lane files are rewritten in their own formatting, so the diff shows only what moved.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import type { CaptureDoc, CaptureOperator, CaptureRecord, OperatorsFile } from "../schema/capture/records.ts";
import type { TypesFile } from "../schema/capture/typesFile.ts";
import type { RelevanceDoc } from "../schema/relevance.ts";
import type { SuitabilityDoc, SuitabilityRecord } from "../schema/suitability.ts";
import { OPERATORS_PATH, TYPE_MAP_PATH, readJson, sidecarFiles } from "./records.ts";
import { resolveNode } from "./resolve.ts";
import { loadTypes, treeOf } from "./tree.ts";

export const MIGRATED_LANE = "C0-migrated";
export const MIGRATION_DATE = "2026-10-18";

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------------------------------------------------------------------------------------------------- reviewed inputs
export interface TypeMapFile {
  schema: "capture-type-map/1";
  reviewed: string;
  note: string;
  overrides: { ref: string; type?: string; name?: string; reason: string; starts_at?: string[] }[];
}
export type PlaceSpec =
  | { mode: "existing"; ref: string; reason?: string }
  | { mode: "new"; ref: string; type: string; name: string; kind?: string };
export interface SplitEntry {
  ref: string;
  how: "trail_payoff" | "offer" | "route" | "viewing_event" | "lift" | "place_walk";
  reason: string;
  route?: { type: string; ref?: string; name?: string };
  place?: PlaceSpec | { type: string } | null;
  offer?: { type: string; class: string };
  at?: PlaceSpec | null;
  at_reason?: string;
  event?: { ref: string; type: string; name: string };
  line?: { type: string };
  ticket?: { ref: string; type: string; class: string };
  top?: { ref: string; type: string; name: string };
  move?: string[];
  displaced_relevance?: Any;
  displaced_sources?: Any[];
}
export interface SplitsFile { schema: "capture-splits/1"; trip: string; reviewed: string; note: string; splits: SplitEntry[] }

export interface MigrationReport {
  trips: Record<string, { refs: number; capture_records: number; created: number }>;
  refs: number;
  capture_records: number;
  created: number;
  split: { total: number; by_how: Record<string, number> };
  created_by_layer: Record<string, number>;
  created_by_type_domain: Record<string, number>;
  by_layer: Record<string, number>;
  relevance_moved: number;
  relevance_displaced: number;
  suitability_moved: number;
  operators: number;
  offers_with_operator: number;
  offers_without_at: number;
}

export interface Write { path: string; text: string }
export interface MigrationPlan { writes: Write[]; report: MigrationReport; capture: Map<string, CaptureDoc>; operators: CaptureOperator[]; problems: string[] }

// ---------------------------------------------------------------------------------------------------- serialisation
/** JSON in the file's own style: two-space indent, and \uXXXX escapes when the original used them (Python ensure_ascii). */
export function serializeLike(original: string, doc: unknown): string {
  let t = JSON.stringify(doc, null, 2) + "\n";
  if (/\\u[0-9a-f]{4}/.test(original)) t = t.replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  return t;
}

// ---------------------------------------------------------------------------------------------------- helpers
const slug = (s: string): string => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const isMigratedFile = (p: string): boolean => /(^|\/)migrated[^/]*\.json$/.test(p);

interface SuitFile { path: string; trip: string; text: string; doc: SuitabilityDoc }
interface RelFile { path: string; trip: string; text: string; doc: RelevanceDoc }

function loadSuit(root: string): SuitFile[] {
  return sidecarFiles(root, "suitability").map((path) => {
    const text = readFileSync(path, "utf8");
    return { path, trip: basename(dirname(path)), text, doc: JSON.parse(text) as SuitabilityDoc };
  });
}
function loadRel(root: string): RelFile[] {
  return sidecarFiles(root, "relevance").map((path) => {
    const text = readFileSync(path, "utf8");
    return { path, trip: basename(dirname(path)), text, doc: JSON.parse(text) as RelevanceDoc };
  });
}

/** Names already in the data: the reviewed kind-map, then the scope. */
function namesOf(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const km = readJson<{ entries: { ref: string; name?: string }[] }>(join(root, "data", "suitability", "kind-map.json"));
  for (const e of km?.entries ?? []) if (e.name) out.set(e.ref, e.name);
  const sc = readJson<{ items: { ref: string; name: string }[] }>(join(root, "data", "suitability", "scope.json"));
  for (const i of sc?.items ?? []) if (!out.has(i.ref)) out.set(i.ref, i.name);
  return out;
}

function loadSplits(root: string): Map<string, SplitsFile> {
  const out = new Map<string, SplitsFile>();
  const dir = join(root, "data", "capture", "splits");
  if (!existsSync(dir)) return out;
  // sorted by file name so the report is stable
  for (const n of readdirSyncSorted(dir)) {
    const f = readJson<SplitsFile>(join(dir, n));
    if (f) out.set(f.trip, f);
  }
  return out;
}
import { readdirSync } from "node:fs";
const readdirSyncSorted = (d: string): string[] => readdirSync(d).filter((n) => n.endsWith(".json")).sort();

/** The layer a legacy record takes by default: trails and drives are routes, activities are offers, everything else is a place. */
function defaultLayer(kind: string, allowed: string[]): CaptureRecord["layer"] {
  const want = kind === "trail" || kind === "drive" ? "route" : kind === "activity" ? "offer" : "place";
  if (allowed.includes(want)) return want;
  return (allowed[0] ?? "place") as CaptureRecord["layer"];
}

const OPERATOR_BASES = new Set(["operator_rule", "operator_info"]);
/** Counts the sources behind operator-stated values of a record, so the most cited one names the operator. */
function operatorSources(rec: Any): Map<string, number> {
  const n = new Map<string, number>();
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return void x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const o = x as Any;
    if (Array.isArray(o.src) && "state" in o && "v" in o) {
      if (o.state === "value" && OPERATOR_BASES.has(o.basis)) for (const s of o.src as string[]) n.set(s, (n.get(s) ?? 0) + 1);
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(rec);
  return n;
}

// ---------------------------------------------------------------------------------------------------- the value ledger
/**
 * Every leaf of a lane record, as "path=value", where the path is relative to the record. A record's identity (`ref`, `kind`,
 * `subkind`) and the computed flat copy are left out: they are what the migration is allowed to change. Moving a block between
 * records of one file, renaming a ref or cutting a record out leaves the multiset of leaves unchanged; losing, altering or
 * inventing a value changes it. That is the invariant the migration test pins.
 */
export function leavesOf(rec: Any): string[] {
  const out: string[] = [];
  const walk = (x: unknown, path: string): void => {
    if (Array.isArray(x)) {
      if (x.length === 0) out.push(`${path}=[]`);
      x.forEach((y) => walk(y, path + "[]"));
    } else if (x !== null && typeof x === "object") {
      const keys = Object.keys(x as Any);
      if (keys.length === 0) out.push(`${path}={}`);
      for (const k of keys) walk((x as Any)[k], path ? `${path}.${k}` : k);
    } else out.push(`${path}=${JSON.stringify(x)}`);
  };
  for (const [k, v] of Object.entries(rec)) {
    if (k === "ref" || k === "kind" || k === "subkind" || k === "flat") continue;
    walk(v, k);
  }
  return out;
}
export interface LedgerPart { records: number; leaves: number; sha1: string }
export interface Ledger { schema: "capture-migration-ledger/1"; note: string; computed: string; suitability: LedgerPart; relevance: LedgerPart; /** the point of every ref in data/relevance/inputs/points.json before the migration: lat, lon */ points: Record<string, [number, number]> }
const sha1 = (xs: string[]): string => createHash("sha1").update([...xs].sort().join("\n")).digest("hex");

/** The ledger of the lane files now on disk. `extraRelevance` adds the judgements kept outside them (the displaced ones in the splits files). */
export function ledgerOf(root: string, extraRelevance: Any[] = []): Ledger {
  const part = (recs: Any[]): LedgerPart => {
    const leaves = recs.flatMap(leavesOf);
    return { records: recs.length, leaves: leaves.length, sha1: sha1(leaves) };
  };
  const suitRecs: Any[] = [];
  for (const f of sidecarFiles(root, "suitability")) suitRecs.push(...(JSON.parse(readFileSync(f, "utf8")) as Any).records);
  const relRecs: Any[] = [...extraRelevance];
  for (const f of sidecarFiles(root, "relevance")) relRecs.push(...(JSON.parse(readFileSync(f, "utf8")) as Any).records);
  // a record that exists in a lane file and in migrated.json is two records (their values differ); count both
  return {
    schema: "capture-migration-ledger/1",
    note: "The multiset of every value leaf of the suitability and relevance lane files, without ref, kind, subkind and the computed flat copy, taken before the capture migration. The migration moves blocks between records and renames refs; it must not change this.",
    computed: MIGRATION_DATE,
    suitability: part(suitRecs),
    relevance: part(relRecs),
    points: Object.fromEntries(Object.entries(readJson<{ points: Record<string, { lat: number; lon: number }> }>(join(root, "data", "relevance", "inputs", "points.json"))?.points ?? {}).map(([k, v]) => [k, [v.lat, v.lon] as [number, number]])),
  };
}
export const LEDGER_PATH = "data/capture/migration-ledger.json";

/** The relevance judgements the splits files keep because the payoff place already had its own. */
export function displacedRelevance(root: string): Any[] {
  return [...loadSplits(root).values()].flatMap((f) => f.splits.flatMap((s) => (s.displaced_relevance ? [s.displaced_relevance] : [])));
}

// ---------------------------------------------------------------------------------------------------- the plan
export function planMigration(root: string, file: TypesFile = loadTypes(root)): MigrationPlan {
  const tree = treeOf(file);
  const problems: string[] = [];
  const names = namesOf(root);
  const typeMap = readJson<TypeMapFile>(join(root, TYPE_MAP_PATH));
  const overrides = new Map((typeMap?.overrides ?? []).map((o) => [o.ref, o]));
  const splitsByTrip = loadSplits(root);
  const suit = loadSuit(root);
  const rel = loadRel(root);

  // 1. every distinct ref, in file order; a lane file supersedes a migrated file for the same ref
  const primary = new Map<string, { rec: SuitabilityRecord; file: SuitFile }>();
  const order = new Map<string, string[]>(); // trip -> refs in first-seen order
  for (const f of suit) {
    for (const rec of f.doc.records) {
      const had = primary.get(rec.ref);
      if (!had || (isMigratedFile(had.file.path) && !isMigratedFile(f.path))) primary.set(rec.ref, { rec, file: f });
      const list = order.get(f.trip) ?? [];
      if (!list.includes(rec.ref)) list.push(rec.ref);
      order.set(f.trip, list);
    }
  }

  const capture = new Map<string, CaptureDoc>();
  const created: CaptureRecord[] = [];
  const report: MigrationReport = {
    trips: {}, refs: 0, capture_records: 0, created: 0, split: { total: 0, by_how: {} }, created_by_layer: {}, created_by_type_domain: {},
    by_layer: {}, relevance_moved: 0, relevance_displaced: 0, suitability_moved: 0, operators: 0, offers_with_operator: 0, offers_without_at: 0,
  };
  const out = new Map<string, Any>(); // path -> working copy of the document to write
  const textOf = new Map<string, string>();
  const workSuit = new Map(suit.map((f) => [f.path, structuredClone(f.doc) as unknown as Any]));
  const workRel = new Map(rel.map((f) => [f.path, structuredClone(f.doc) as unknown as Any]));
  for (const f of suit) textOf.set(f.path, f.text);
  for (const f of rel) textOf.set(f.path, f.text);
  const changed = new Set<string>();

  const relFilesOf = (trip: string): RelFile[] => rel.filter((f) => f.trip === trip);
  const suitFilesOf = (trip: string): SuitFile[] => suit.filter((f) => f.trip === trip);

  const nodeOf = (type: string): ReturnType<typeof resolveNode> => resolveNode(type, file);
  const checkType = (ref: string, type: string, layer: string): void => {
    const n = nodeOf(type);
    if (!n) problems.push(`${ref}: type ${type} is not in types.json`);
    else if (!n.records.includes(layer as never)) problems.push(`${ref}: type ${type} cannot be a ${layer} (allowed: ${n.records.join(", ")})`);
  };

  for (const [trip, refs] of order) {
    const records = new Map<string, CaptureRecord>(); // ref -> record
    const ordered: string[] = [];
    const push = (r: CaptureRecord, after?: string): void => {
      records.set(r.ref, r);
      if (!after) return void ordered.push(r.ref);
      // a cut-out record follows its origin and the records already cut out of it
      let at = ordered.indexOf(after);
      if (at < 0) return void ordered.push(r.ref);
      while (ordered[at + 1] !== undefined && records.get(ordered[at + 1]!)?.origin?.from === after) at++;
      ordered.splice(at + 1, 0, r.ref);
    };

    // 2. one capture record per ref from the reviewed type map
    for (const ref of refs) {
      const p = primary.get(ref)!;
      const ov = overrides.get(ref);
      const legacy = tree.legacy.get(`${p.rec.kind}/${p.rec.subkind}`);
      const type = ov?.type ?? legacy;
      if (!type) {
        problems.push(`${ref}: no type for ${p.rec.kind}/${p.rec.subkind}`);
        continue;
      }
      const node = nodeOf(type);
      const layer = defaultLayer(p.rec.kind, node?.records ?? []);
      const name = ov?.name ?? names.get(ref);
      if (!name) problems.push(`${ref}: no name in kind-map.json, scope.json or the type map`);
      checkType(ref, type, layer);
      push({ ref, type, layer, ...(name ? { name } : {}), ...(ov?.starts_at ? { starts_at: ov.starts_at } : {}) });
    }

    // 3. the splits
    const createdBefore = created.length;
    const splits = splitsByTrip.get(trip)?.splits ?? [];
    for (const s of splits) {
      report.split.total++;
      report.split.by_how[s.how] = (report.split.by_how[s.how] ?? 0) + 1;
      const base = records.get(s.ref);
      if (!base) {
        problems.push(`splits: ${s.ref} is not a record of ${trip}`);
        continue;
      }
      const make = (r: CaptureRecord, after: string, reason: string): CaptureRecord => {
        const rec: CaptureRecord = { ...r, origin: { from: s.ref, reason } };
        checkType(rec.ref, rec.type, rec.layer);
        push(rec, after);
        created.push(rec);
        return rec;
      };
      const placeRef = (p: PlaceSpec | null | undefined, why: string): string | null => {
        if (!p) return null;
        if (p.mode === "existing") {
          if (!records.has(p.ref) && ![...capture.values()].some((d) => d.records.some((r) => r.ref === p.ref)) && !primary.has(p.ref)) problems.push(`${s.ref}: place ${p.ref} is not a record`);
          return p.ref;
        }
        if (!records.has(p.ref)) make({ ref: p.ref, type: p.type, layer: "place", name: p.name }, s.ref, why);
        return p.ref;
      };

      switch (s.how) {
        case "trail_payoff": {
          const place = s.place as PlaceSpec;
          base.type = s.route!.type;
          base.layer = "route";
          checkType(s.ref, base.type, "route");
          const pref = placeRef(place, "payoff of the trail");
          if (pref) base.reaches = [pref];
          // the relevance record, judged as the payoff, moves to the payoff place
          for (const rf of relFilesOf(trip)) {
            const doc = workRel.get(rf.path)!;
            const i = (doc.records as Any[]).findIndex((r) => r.ref === s.ref);
            if (i < 0) continue;
            const rec = (doc.records as Any[])[i]!;
            if (place.mode === "new") {
              const moved: Any = { ...rec, ref: place.ref };
              // key order kept: ref, kind, subkind, ...; the kind is the payoff's, so the area-designation check sees a lake or a viewpoint
              moved.kind = place.kind ?? "place";
              delete moved.subkind;
              (doc.records as Any[])[i] = moved;
              report.relevance_moved++;
            } else {
              (doc.records as Any[]).splice(i, 1);
              report.relevance_displaced++;
              if (!s.displaced_relevance) problems.push(`${s.ref}: the displaced relevance record is not kept in the splits file`);
            }
            changed.add(rf.path);
          }
          break;
        }
        case "offer": {
          base.type = s.offer!.type;
          base.layer = "offer";
          base.offer_class = s.offer!.class as never;
          checkType(s.ref, base.type, "offer");
          const pref = placeRef(s.at as PlaceSpec | null | undefined, "the place the offer runs at");
          if (pref) base.at = [pref];
          else report.offers_without_at++;
          break;
        }
        case "route": {
          base.type = s.route!.type;
          base.layer = "route";
          checkType(s.ref, base.type, "route");
          const pref = placeRef(s.place as PlaceSpec | null | undefined, "the place the route belongs to");
          if (pref) base.starts_at = [pref];
          break;
        }
        case "viewing_event": {
          base.type = (s.place as { type: string }).type;
          base.layer = "place";
          checkType(s.ref, base.type, "place");
          make({ ref: s.event!.ref, type: s.event!.type, layer: "event", name: s.event!.name, part_of: [s.ref] }, s.ref, "the dated occurrence at the viewing place");
          break;
        }
        case "lift": {
          const top = s.top!;
          base.type = s.line!.type;
          base.layer = "route";
          checkType(s.ref, base.type, "route");
          make({ ref: top.ref, type: top.type, layer: "place", name: top.name }, s.ref, "the top station of the lift");
          base.reaches = [top.ref];
          make({ ref: s.ticket!.ref, type: s.ticket!.type, layer: "offer", offer_class: s.ticket!.class as never, name: `${base.name ?? s.ref} ticket`, on: [{ ref: s.ref }] }, s.ref, "the ticket offer on the lift line");
          // the suitability block of a lift resolves on its ticket offer: the record moves there, in every file that holds it
          for (const sf of suitFilesOf(trip)) {
            const doc = workSuit.get(sf.path)!;
            for (const rec of doc.records as Any[]) {
              if (rec.ref === s.ref) {
                rec.ref = s.ticket!.ref;
                changed.add(sf.path);
                report.suitability_moved++;
              }
            }
          }
          break;
        }
        case "place_walk": {
          const w = s.route!;
          make({ ref: w.ref!, type: w.type, layer: "route", name: w.name!, reaches: [s.ref] }, s.ref, "the route to the place");
          // the walk's effort and time move to a new suitability record of the same lane file
          for (const sf of suitFilesOf(trip)) {
            if (isMigratedFile(sf.path)) continue;
            const doc = workSuit.get(sf.path)!;
            const rec = (doc.records as Any[]).find((r) => r.ref === s.ref);
            if (!rec) continue;
            const moved: Any = {};
            for (const k of s.move ?? []) {
              if (rec.suitability?.[k] !== undefined) {
                moved[k] = rec.suitability[k];
                delete rec.suitability[k];
              }
            }
            const route: Any = { ref: w.ref, kind: "trail", subkind: "walk", suitability: moved };
            const at = (doc.records as Any[]).indexOf(rec);
            (doc.records as Any[]).splice(at + 1, 0, route);
            changed.add(sf.path);
            report.suitability_moved++;
          }
          break;
        }
      }
    }

    // 4. a walk cut out of a place (S0b) starts at its parent
    for (const ref of refs) {
      const ov = overrides.get(ref);
      const r = records.get(ref)!;
      if (ov?.starts_at && r && !r.starts_at) r.starts_at = ov.starts_at;
    }

    const recs = ordered.map((r) => records.get(r)!).filter(Boolean);
    capture.set(trip, { schema: "capture/1", trip, lane: MIGRATED_LANE, researched: MIGRATION_DATE, agent: "core/bin/capture.ts migrate", model: "none", sources: [], records: recs });
    report.trips[trip] = { refs: refs.length, capture_records: recs.length, created: created.length - createdBefore };
  }

  // 5. operators: the publisher of the operator's own page behind an offer's operator-stated values. Only a source row of kind
  // "operator" names one: a tourist office or a land manager that the lane cites for a rule is not the operator.
  const ops = new Map<string, CaptureOperator>();
  const nameOperator = (rec: Any, ref: string, file: SuitFile): string | null => {
    const counts = operatorSources(rec);
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => file.doc.sources.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x && x.kind === "operator" && /^https?:/.test(x.url));
    const row = rows[0];
    if (!row) return null;
    const u = new URL(row.url);
    const oref = `operator/${slug(row.publisher)}`;
    const derived = { file: relative(root, file.path).split("\\").join("/"), src: row.id, publisher: row.publisher, url: row.url };
    const had = ops.get(oref);
    if (had) had.derived_from = [...(had.derived_from ?? []), derived];
    else ops.set(oref, { ref: oref, name: row.publisher, url: `${u.protocol}//${u.hostname.replace(/^api\./, "")}/`, derived_from: [derived] });
    void ref;
    return oref;
  };
  for (const doc of capture.values()) {
    for (const rec of doc.records) {
      report.by_layer[rec.layer] = (report.by_layer[rec.layer] ?? 0) + 1;
      if (rec.layer !== "offer") continue;
      // the offer's own suitability record: the record itself, or (a lift's ticket) the record that moved to its ref
      const holder = [...suit].reverse().find((f) => (workSuit.get(f.path)!.records as Any[]).some((r) => r.ref === rec.ref) && !isMigratedFile(f.path)) ?? suit.find((f) => (workSuit.get(f.path)!.records as Any[]).some((r) => r.ref === rec.ref));
      if (!holder) continue;
      const srec = (workSuit.get(holder.path)!.records as Any[]).find((r) => r.ref === rec.ref)!;
      const oref = nameOperator(srec, rec.ref, holder);
      if (oref) {
        rec.run_by = oref;
        report.offers_with_operator++;
      }
    }
  }

  const operators = [...ops.values()].sort((a, b) => (a.ref < b.ref ? -1 : 1));
  for (const o of operators) o.derived_from = (o.derived_from ?? []).filter((x, i, a) => a.findIndex((y) => y.file === x.file && y.src === x.src) === i);
  report.operators = operators.length;

  // totals
  for (const t of Object.values(report.trips)) {
    report.refs += t.refs;
    report.capture_records += t.capture_records;
    report.created += t.created;
  }
  for (const r of created) {
    report.created_by_layer[r.layer] = (report.created_by_layer[r.layer] ?? 0) + 1;
    const d = r.type.split(".")[0]!;
    report.created_by_type_domain[d] = (report.created_by_type_domain[d] ?? 0) + 1;
  }

  // 6. the writes
  const writes: Write[] = [];
  for (const [trip, doc] of [...capture].sort(([a], [b]) => (a < b ? -1 : 1))) {
    writes.push({ path: join(root, "data", "capture", trip, "migrated.json"), text: JSON.stringify(doc, null, 2) + "\n" });
  }
  const opsFile: OperatorsFile = { schema: "capture-operators/1", updated: MIGRATION_DATE, operators };
  writes.push({ path: join(root, OPERATORS_PATH), text: JSON.stringify(opsFile, null, 2) + "\n" });
  for (const p of [...changed].sort()) {
    const doc = workSuit.get(p) ?? workRel.get(p)!;
    writes.push({ path: p, text: serializeLike(textOf.get(p)!, doc) });
  }
  writes.push({ path: join(root, LEDGER_PATH), text: JSON.stringify(ledgerOf(root, []), null, 2) + "\n" });
  void out;
  return { writes, report, capture, operators, problems };
}

/** Old ref -> new ref for the suitability records the capture migration renamed (a lift's block moves to its ticket offer). */
export function captureRenames(root: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of loadSplits(root).values()) for (const s of f.splits) if (s.how === "lift" && s.ticket) out.set(s.ref, s.ticket.ref);
  return out;
}
