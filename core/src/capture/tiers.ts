// The required and enrichment tiers per kind (META-0, capture contract 3.7; EXECUTION-PLAN 6.2). The tiers are not a second list: they
// are the resolved R and A marks of data/vocab/types.json, read through the one completeness engine. Required: a value, or
// searched_none with the date (a soft answer counts). Enrichment: the A marks, filled when sources allow. A gap is never a yes.
//
// The placement keys (area_id, point, near_town) are reported by the placement codes, so the tier check leaves them out.
import { completeness, evalTrigger } from "./engine.ts";
import { ownPointOf, PLACEMENT_KEYS } from "./placementBlock.ts";
import type { PlacementWorld } from "./placementBlock.ts";
import type { World } from "./records.ts";
import { resolveNode, suitMark } from "./resolve.ts";
import type { CaptureRecord } from "../schema/capture/records.ts";
import { PROPERTY_BY_KEY } from "../schema/capture/properties.ts";

/** The record kinds of EXECUTION-PLAN 6.2, decided from the layer and the type. */
export const TIER_KINDS = ["place", "trail", "other_route", "offer", "event", "stay"] as const;
export type TierKind = (typeof TIER_KINDS)[number];

export function kindOf(rec: Pick<CaptureRecord, "type" | "layer">): TierKind {
  if (/^stay(\.|$)/.test(rec.type) && rec.layer !== "route") return "stay";
  if (rec.layer === "route") return /^nature\.(trail|trek)(\.|$)/.test(rec.type) ? "trail" : "other_route";
  return rec.layer as TierKind;
}

const placementKey = (k: string): boolean => (PLACEMENT_KEYS as readonly string[]).includes(k);

export interface RecordTier {
  ref: string;
  type: string;
  layer: string;
  kind: TierKind;
  /** the required keys the contract asks of this record (R, R? whose condition holds, suitability R) */
  required: string[];
  requiredMissing: string[];
  enrichment: string[];
  enrichmentMissing: string[];
}

/** The tier of one record: what it is asked and what it still lacks. null when the record or its type is unknown. */
export function recordTier(world: World, ref: string): RecordTier | null {
  const c = completeness(world, ref);
  const capL = world.cap.get(ref);
  if (!c || !capL) return null;
  const cap = capL.rec;
  const node = resolveNode(cap.type);
  const rl = node?.layers[cap.layer];
  if (!node || !rl) return null;
  const suit = world.suit.get(ref)?.rec;
  const rel = world.rel.get(ref)?.rec;
  const required: string[] = [];
  const enrichment: string[] = [];
  for (const [k, m] of Object.entries(rl.base)) {
    if (placementKey(k)) continue;
    if (m === "R") required.push(k);
    else if (m === "R?" && evalTrigger(world, PROPERTY_BY_KEY.get(k)?.trigger ?? "conditional", ref, node, cap.layer, cap, suit, rel) === true) required.push(k);
    else if (m === "A") enrichment.push(k);
  }
  if (rl.carries_suitability && node.profile) {
    const operated = suit?.operated ?? (node.operated === "always" ? true : node.operated === "never" ? false : node.operated_default ?? false);
    for (const p of Object.keys(node.suitability)) {
      const m = suitMark(node, p, operated);
      if (m === "R") required.push(p);
      else if (m === "A") enrichment.push(p);
    }
  }
  const requiredMissing = [...c.missingBase, ...c.missingSuitability, ...c.conditionalMissing].filter((k) => !placementKey(k));
  const enrichmentMissing = c.missingApplicable.filter((k) => !placementKey(k));
  return { ref, type: cap.type, layer: cap.layer, kind: kindOf(cap), required: [...new Set(required)], requiredMissing: [...new Set(requiredMissing)], enrichment: [...new Set(enrichment)], enrichmentMissing: [...new Set(enrichmentMissing)] };
}

/** The columns of EXECUTION-PLAN 6.4, so a rerun can be laid beside the 20 Oct audit. */
export const MATRIX_COLUMNS = ["records", "area_id", "point", "osm_id", "wikidata", "official", "photos", "season", "where", "operator", "price", "duration", "window", "min_age"] as const;
export type MatrixColumn = (typeof MATRIX_COLUMNS)[number];
/** The rows of 6.4: layers, with the trails split out of the routes. */
export const MATRIX_ROWS = ["place", "route", "route:trails", "offer", "event"] as const;

const answered = (x: unknown): boolean => {
  if (x === undefined || x === null) return false;
  if (Array.isArray(x)) return x.length > 0;
  if (typeof x === "object" && "state" in (x as object)) return (x as { state: string }).state !== "gap";
  return true;
};

/**
 * Which 6.4 columns one record answers, with the 20 Oct audit's definitions so a rerun lines up with it: `point` is the record's own
 * row in a points sidecar (W_PLACE_POINT also accepts a route's start), `osm_id` is `osm_ref`, `wikidata` a filled wikidata link, and
 * `min_age` a stated value. The tier keys below read the contract's homes instead (the relevance QID, for one).
 */
export function matrixCells(pw: PlacementWorld, rec: CaptureRecord): Record<MatrixColumn, boolean> {
  const suit = pw.world.suit.get(rec.ref)?.rec;
  const minAge = suit?.suitability?.min_age as { state?: string } | undefined;
  const filled = (kind: string): boolean => (rec.links ?? []).some((l) => l.kind === kind && l.state === "filled");
  return {
    records: true,
    area_id: !!rec.area_id,
    point: (rec.layer === "place" || rec.layer === "route") && !!ownPointOf(pw, rec.ref),
    osm_id: !!rec.osm_ref,
    wikidata: filled("wikidata"),
    official: filled("official"),
    photos: (rec.photos?.length ?? 0) > 0,
    season: answered(rec.season),
    where: (rec.at?.length ?? 0) + (rec.on?.length ?? 0) + (rec.starts_at?.length ?? 0) > 0,
    operator: !!rec.run_by,
    price: answered(rec.price),
    duration: answered(rec.duration_min),
    window: answered(rec.window),
    min_age: minAge?.state === "value",
  };
}

export interface KeyStat { key: string; asked: number; answered: number; missing: number }
export interface KindTier { kind: TierKind; records: number; complete: number; keys: KeyStat[] }

/** Per kind: how many records each tier key is asked of, answered by and missing from. Sorted by most missing. */
export function kindTiers(tiers: RecordTier[], tier: "required" | "enrichment"): KindTier[] {
  const out: KindTier[] = [];
  for (const kind of TIER_KINDS) {
    const rows = tiers.filter((t) => t.kind === kind);
    if (rows.length === 0) continue;
    const stats = new Map<string, KeyStat>();
    for (const t of rows) {
      const asked = tier === "required" ? t.required : t.enrichment;
      const missing = new Set(tier === "required" ? t.requiredMissing : t.enrichmentMissing);
      for (const k of new Set([...asked, ...missing])) {
        const s = stats.get(k) ?? { key: k, asked: 0, answered: 0, missing: 0 };
        s.asked += 1;
        if (missing.has(k)) s.missing += 1;
        else s.answered += 1;
        stats.set(k, s);
      }
    }
    const complete = rows.filter((t) => (tier === "required" ? t.requiredMissing : t.enrichmentMissing).length === 0).length;
    out.push({ kind, records: rows.length, complete, keys: [...stats.values()].sort((a, b) => b.missing - a.missing || a.key.localeCompare(b.key)) });
  }
  return out;
}
