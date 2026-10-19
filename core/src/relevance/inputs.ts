// Loads the files derive reads: relevance records, cached signals, catalogue points, towns, the hub matrix and the
// suitability sidecars (for family effort, on-site time and access). Offline: no network, only files.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { deriveEffort } from "../suitability/derive.ts";
import { loadMap } from "../suitability/map.ts";
import type { SuitabilityDoc } from "../schema/suitability.ts";
import type { RelevanceDoc } from "../schema/relevance.ts";
import type { AccessLoad } from "./fit.ts";
import type { DeriveInput, HubMatrix, PlaceFacts, Town } from "./derive.ts";
import { relevanceFiles } from "./refs.ts";
import { isAllowedHub } from "./hubs.ts";
import { loadSignalsFor } from "../validate/relevance.ts";

export interface PointsFile {
  schema: "relevance-points/1";
  points: Record<string, { lat: number; lon: number; coord_src: string; point_source?: string; on_site_min?: number; access_legal_public?: boolean; external_access?: AccessLoad }>;
  towns: Town[];
  trips?: Record<string, { window?: { from: string; to: string }; base?: { lat: number; lon: number }; detour_min?: Record<string, number> }>;
}

const readJson = <T>(path: string): T | null => {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
};

/** a point copied from another ref reads `trailhead "X" at <ref>` in point_source (points.ts) */
function aliasOf(src: string): { aliasOf?: string } {
  const m = /^trailhead ".*" at (.+)$/.exec(src);
  return m ? { aliasOf: m[1]! } : {};
}

export class HouseholdHubError extends Error {
  readonly code = "E_REL_HOUSEHOLD";
}

/** A hub that is not marked public is a household origin; day-trip fit refuses it. */
export function assertPublicHubs(m: HubMatrix): void {
  for (const h of m.hubs) {
    if (h.public !== true || !isAllowedHub(h.id)) throw new HouseholdHubError(`E_REL_HOUSEHOLD: hub "${h.id}" is not a public hub on the allowlist (core/src/relevance/hubs.ts: Toronto City Hall). Day-trip fit uses public hubs only; remove it.`);
  }
}

export function loadHubMatrix(root: string): HubMatrix | null {
  const m = readJson<HubMatrix>(join(root, "data", "relevance", "inputs", "hub-matrix.json"));
  if (m) assertPublicHubs(m);
  return m;
}

export function loadRelevanceDocs(root: string, trip?: string | null): { file: string; doc: RelevanceDoc }[] {
  return relevanceFiles(root, trip).map((file) => ({ file, doc: JSON.parse(readFileSync(file, "utf8")) as RelevanceDoc }));
}

/** On-site upper bound, family effort and a coarse access load from the suitability record of each ref. */
function suitabilityFacts(root: string): Record<string, { onSiteMin?: number; familyEffort?: number | null; externalAccess?: AccessLoad; accessSeasonVia?: string[] }> {
  const out: Record<string, { onSiteMin?: number; familyEffort?: number | null; externalAccess?: AccessLoad; accessSeasonVia?: string[] }> = {};
  const base = join(root, "data", "suitability");
  if (!existsSync(base)) return out;
  const map = loadMap(root);
  for (const trip of readdirSync(base)) {
    let names: string[] = [];
    try {
      names = readdirSync(join(base, trip)).filter((n) => n.endsWith(".json"));
    } catch {
      continue;
    }
    for (const n of names) {
      let doc: SuitabilityDoc;
      try {
        doc = JSON.parse(readFileSync(join(base, trip, n), "utf8")) as SuitabilityDoc;
      } catch {
        continue;
      }
      for (const r of doc.records ?? []) {
        const b = r.suitability as { on_site_min?: { state: string; v: [number, number] | null }; access_season?: { state: string; v: { via: string }[] | null } };
        const e = out[r.ref] ?? {};
        try {
          e.familyEffort = deriveEffort({ kind: r.kind, subkind: r.subkind, block: r.suitability, ext: r.ext }, map).family_effort;
        } catch {
          /* leave null */
        }
        if (b.on_site_min?.state === "value" && b.on_site_min.v) e.onSiteMin = b.on_site_min.v[1];
        const via = b.access_season?.state === "value" ? (b.access_season.v ?? []).map((a) => a.via) : [];
        if (via.some((x) => x === "shuttle" || x === "lift" || x === "boat")) e.externalAccess = "plan";
        if (via.length) e.accessSeasonVia = [...new Set([...(e.accessSeasonVia ?? []), ...via])];
        out[r.ref] = e;
      }
    }
  }
  return out;
}

export interface Loaded {
  input: DeriveInput;
  /** records by trip, for writing derived/<trip>.json */
  trips: Map<string, string[]>;
}

export function loadDeriveInput(root: string, window?: { from: string; to: string } | null, today?: string): Loaded {
  const docs = loadRelevanceDocs(root);
  const records = docs.flatMap((d) => d.doc.records);
  const meta: NonNullable<DeriveInput["meta"]> = {};
  for (const d of docs) {
    const reads = Object.fromEntries(d.doc.sources.map((x) => [x.id, x.read]));
    for (const r of d.doc.records) meta[r.ref] = { researched: d.doc.researched, reads };
  }
  const trips = new Map<string, string[]>();
  for (const d of docs) trips.set(d.doc.trip, [...(trips.get(d.doc.trip) ?? []), ...d.doc.records.map((r) => r.ref)]);
  const pts = readJson<PointsFile>(join(root, "data", "relevance", "inputs", "points.json"));
  const suit = suitabilityFacts(root);
  const facts: Record<string, PlaceFacts> = {};
  for (const d of docs) {
    const tripCtx = pts?.trips?.[d.doc.trip];
    for (const r of d.doc.records) {
      const p = pts?.points[r.ref];
      const s = suit[r.ref];
      facts[r.ref] = {
        ...(p ? { point: { lat: p.lat, lon: p.lon } } : {}),
        ...(p?.point_source ? aliasOf(p.point_source) : {}),
        onSiteMin: p?.on_site_min ?? s?.onSiteMin ?? null,
        tripDetourMin: tripCtx?.detour_min?.[r.ref] ?? null,
        ...(tripCtx?.base ? { base: tripCtx.base } : {}),
        externalAccess: p?.external_access ?? s?.externalAccess ?? "easy",
        accessLegalPublic: p?.access_legal_public === true,
        familyEffort: s?.familyEffort ?? null,
        ...(s?.accessSeasonVia?.length ? { accessSeasonVia: s.accessSeasonVia } : {}),
      };
    }
  }
  return {
    input: { records, facts, signals: loadSignalsFor(root), towns: pts?.towns ?? [], matrix: loadHubMatrix(root), window: window ?? null, meta, ...(today ? { today } : {}) },
    trips,
  };
}
