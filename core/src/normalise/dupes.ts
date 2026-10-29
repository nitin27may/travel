// S2 Dedupe (spec 4.1): candidate pairs of records that may be the same place. The outcome is a person's: an alias row
// (`aliases` on the survivor, `same_place_as`) or a merge recorded in the slug registry (`places.merged`). Nothing here writes.
//
// Candidates, strongest first:
//   osm_ref       two records name the same OSM element in `osm_ref`
//   wikidata      two records carry the same Wikidata QID (a `wikidata` Val, or a point read from that item)
//   osm_element   two points were read from the same OSM element
//   name_near     the same type family and the same name (accents, case and punctuation aside) within 150 m
// A pair is not a candidate when one record already names the other (alias, relation, variant) or the slug registry merged them.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { haversineM } from "../geo/distance.ts";
import { discover } from "./files.ts";
import { isObj, type Obj } from "./common.ts";
import { osmRefOf } from "../schema/capture/records.ts";

export interface DupeCandidate {
  a: string;
  b: string;
  reason: "osm_ref" | "wikidata" | "osm_element" | "name_near";
  detail: string;
  distance_m?: number;
}

export const NEAR_M = 150;
const REL_KEYS = ["reaches", "part_of", "starts_at", "ends_at", "at", "parks_for", "serves", "combo_with", "alternative_to", "aliases"];
const QID = /^Q[1-9]\d*$/;

/** A name for comparison: accents, case, punctuation and spaces aside ("Tea House" and "Teahouse" are one name). */
const fold = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const family = (type: string): string => type.split(".").slice(0, 2).join(".");

function readJson(p: string): Obj | null {
  try {
    const d = JSON.parse(readFileSync(p, "utf8")) as unknown;
    return isObj(d) ? d : null;
  } catch {
    return null;
  }
}

interface P { lat: number; lon: number; approx: boolean; element?: string }

function readPoints(root: string): Map<string, P> {
  const out = new Map<string, P>();
  for (const f of ["data/relevance/inputs/points.json", "data/capture/points.json"]) {
    const d = readJson(join(root, f));
    if (!d || !isObj(d.points)) continue;
    for (const [ref, row] of Object.entries(d.points)) {
      if (!isObj(row) || typeof row.lat !== "number" || typeof row.lon !== "number") continue;
      let element: string | undefined;
      if (isObj(row.point_src) && typeof row.point_src.element === "string") element = row.point_src.element;
      else if (typeof row.point_source === "string") {
        const m = /^(?:OSM\s+)?(node|way|relation)\s+(\d+)\b|^Wikidata\s+(Q[1-9]\d*)\b/.exec(row.point_source);
        if (m) element = m[3] ?? `${m[1]}/${m[2]}`;
      }
      out.set(ref, { lat: row.lat, lon: row.lon, approx: row.approx === true, ...(element ? { element } : {}) });
    }
  }
  return out;
}

/** The pairs of refs a record already relates (symmetric), and the merged keys of the slug registry. */
function related(root: string, recs: Map<string, Obj>): Set<string> {
  const pair = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const out = new Set<string>();
  for (const [ref, rec] of recs) {
    for (const k of REL_KEYS) {
      const v = rec[k];
      if (Array.isArray(v)) for (const x of v) out.add(pair(ref, typeof x === "string" ? x : isObj(x) && typeof x.ref === "string" ? x.ref : ""));
    }
    for (const k of ["variant_of", "run_by"]) if (typeof rec[k] === "string") out.add(pair(ref, rec[k] as string));
    for (const k of ["passes", "on"]) if (Array.isArray(rec[k])) for (const x of rec[k] as unknown[]) if (isObj(x) && typeof x.ref === "string") out.add(pair(ref, x.ref));
  }
  const slugs = readJson(join(root, "data", "catalogue", "slugs.json"));
  const merged = slugs && isObj(slugs.places) && isObj(slugs.places.merged) ? slugs.places.merged : {};
  for (const [from, to] of Object.entries(merged)) if (typeof to === "string") out.add(pair(from, to));
  return out;
}

export function findDuplicates(root: string, opts: { trip?: string } = {}): DupeCandidate[] {
  const recs = new Map<string, Obj>();
  const qids = new Map<string, string>();
  for (const f of discover(root, ["capture"])) {
    const d = readJson(f.abs);
    if (!d || (opts.trip && d.trip !== opts.trip)) continue;
    if (Array.isArray(d.records)) for (const r of d.records) if (isObj(r) && typeof r.ref === "string" && (r.layer === "place" || r.layer === "route")) recs.set(r.ref, r);
  }
  for (const f of discover(root, ["relevance", "suitability"])) {
    const d = readJson(f.abs);
    if (!d || !Array.isArray(d.records)) continue;
    for (const r of d.records) {
      if (!isObj(r) || typeof r.ref !== "string" || !isObj(r.wikidata)) continue;
      if (typeof r.wikidata.v === "string" && QID.test(r.wikidata.v)) qids.set(r.ref, r.wikidata.v);
    }
  }
  const points = readPoints(root);
  const skip = related(root, recs);
  const key = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const out = new Map<string, DupeCandidate>();
  const add = (a: string, b: string, reason: DupeCandidate["reason"], detail: string, distance_m?: number): void => {
    if (a === b || skip.has(key(a, b))) return;
    const k = `${key(a, b)}|${reason}`;
    if (!out.has(k)) out.set(k, { a: a < b ? a : b, b: a < b ? b : a, reason, detail, ...(distance_m !== undefined ? { distance_m } : {}) });
  };
  const group = (reason: DupeCandidate["reason"], pick: (ref: string, rec: Obj) => string | undefined): void => {
    const by = new Map<string, string[]>();
    for (const [ref, rec] of recs) {
      const k = pick(ref, rec);
      if (k) by.set(k, [...(by.get(k) ?? []), ref]);
    }
    for (const [k, refs] of by) for (let i = 0; i < refs.length; i++) for (let j = i + 1; j < refs.length; j++) add(refs[i]!, refs[j]!, reason, k);
  };
  // osm_ref is a bare id or a Val (LT-C); osmRefOf reads both
  group("osm_ref", (_r, rec) => osmRefOf(rec) ?? undefined);
  group("wikidata", (ref) => qids.get(ref) ?? points.get(ref)?.element?.match(QID)?.[0]);
  group("osm_element", (ref) => {
    const e = points.get(ref)?.element;
    return e && !QID.test(e) ? e : undefined;
  });
  // same type family and name, within 150 m (exact points only: an approximate point never counts for a distance)
  const named = [...recs].filter(([ref, rec]) => typeof rec.name === "string" && typeof rec.type === "string" && points.has(ref) && !points.get(ref)!.approx);
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const [ra, a] = named[i]!;
      const [rb, b] = named[j]!;
      if (family(String(a.type)) !== family(String(b.type))) continue;
      const na = fold(String(a.name));
      const nb = fold(String(b.name));
      const same = na === nb || (Math.min(na.length, nb.length) >= 8 && (na.includes(nb) || nb.includes(na)));
      if (!same) continue;
      const d = haversineM(points.get(ra)!, points.get(rb)!);
      if (d <= NEAR_M) add(ra, rb, "name_near", `${family(String(a.type))}; ${String(a.name)}`, Math.round(d));
    }
  }
  return [...out.values()].sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b) || x.reason.localeCompare(y.reason));
}

export const hasDupeInputs = (root: string): boolean => existsSync(join(root, "data", "capture"));
