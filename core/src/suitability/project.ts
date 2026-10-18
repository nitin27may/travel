// projectForSchedule(): the adapter between suitability/1 and the trip timeline (spec 6.1).
//
// ScheduleSuitability is the interface of docs/v2/features/trip-timeline.md 3.11 plus the five fields of spec 6.1.
// L3c owns core/src/schedule/, so the type is declared here. Whichever lane merges second makes
// core/src/schedule/suitability.ts `export type { ScheduleSuitability as Suitability } from '../suitability/project.ts'`;
// core/test/suitability/schedule-type.test.ts asserts the two shapes match.
import type { SuitabilityBlock, SuitabilityRecord, SuitabilitySource } from "../schema/suitability.ts";
import { hasEffort, isOperated, loadApplicability, maskNotApplicable, profileOf } from "./applicability.ts";
import type { Applicability } from "./applicability.ts";
import { deriveEffort, ruleValOf, valOf } from "./derive.ts";
import { DEFAULT_MAP } from "./map.ts";
import { mergeBlock } from "./merge.ts";
import type { DifficultyMap } from "./map.ts";
import type { Basis, Grade5, GradeSystem } from "./types.ts";

export type RuleKind = "hard" | "advice";
export type LimitName = "minAge" | "maxAge" | "minHeightCm" | "maxHeightCm" | "minWeightKg" | "maxWeightKg";

export interface ScheduleSuitability {
  minAge: number | null;
  maxAge: number | null;
  minHeightCm: number | null;
  maxHeightCm: number | null;
  minWeightKg: number | null;
  maxWeightKg: number | null;
  rule: RuleKind | null;
  stroller: "yes" | "partly" | "no" | null;
  wheelchair: "yes" | "partly" | "no" | null;
  carrierOk: boolean | null;
  familyEffort: Grade5 | null;
  sourceGrade: { system: GradeSystem; value: string } | null;
  childTime: { byAge: { fromAge: number; minutes: number }[]; source: string } | null;
  adultTime: { min: number; max: number; source: string } | null;
  distanceKm: number | null;
  gainM: number | null;
  lossM: number | null;
  provenance: string;
  // added by spec 6.1
  terrain: Grade5 | null;
  effortKm: number | null;
  exposureUnfenced: boolean;
  ruleByField: Partial<Record<LimitName, RuleKind>>;
  strollerNote: string | null;
}

export interface ProjectOptions {
  /** The file's sources table, used to word the provenance and to date it. */
  sources?: SuitabilitySource[];
  map?: DifficultyMap;
  applicability?: Applicability;
}

type Offer = NonNullable<SuitabilityRecord["offers"]>[number];

export { mergeBlock };

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTH[Number(m[2]) - 1]} ${m[1]}` : iso;
}

const BASIS_LABEL: Record<Basis, string> = {
  operator_rule: "operator rule",
  official_rule: "official rule",
  official_grade: "official grade",
  official_info: "official information",
  community: "community reports",
  our_inference: "our judgement",
};

type AnyVal = { state: string; basis: string | null; src: string[]; read?: string } | undefined;

function readOf(v: AnyVal, sources?: SuitabilitySource[]): string | null {
  if (!v) return null;
  if (v.read) return v.read;
  const reads = (v.src ?? []).map((id) => sources?.find((s) => s.id === id)?.read).filter((r): r is string => !!r).sort();
  return reads.length ? reads[reads.length - 1]! : null;
}

function dated(label: string, v: AnyVal, sources?: SuitabilitySource[]): string {
  const r = readOf(v, sources);
  return r ? `${label}, read ${longDate(r)}` : label;
}

function strollerOf(b: SuitabilityBlock): { value: ScheduleSuitability["stroller"]; note: string | null } {
  const s = valOf(b.stroller);
  if (s === null) return { value: null, note: null };
  if (s === "none") return { value: "no", note: null };
  const ext = b.stroller_extent;
  if (s === "all_terrain") return { value: "partly", note: ext?.part_note ?? "all-terrain stroller only" };
  if (ext?.scope === "whole") return { value: "yes", note: null };
  const note = ext?.part_note ?? (ext?.part_km !== undefined ? `first ${ext.part_km} km` : "extent not stated");
  return { value: "partly", note };
}

export function projectForSchedule(record: SuitabilityRecord, offer?: Offer, opts: ProjectOptions = {}): ScheduleSuitability {
  const map = opts.map ?? DEFAULT_MAP;
  // fields the record's profile marks N are skipped (applicability spec 5.4); a record with no valid subkind is read whole
  const located = profileOf(record, opts.applicability ?? loadApplicability());
  const b = maskNotApplicable(mergeBlock(record.suitability, offer), located, record.operated);
  const ext = offer?.ext ?? record.ext;
  const effort = deriveEffort({ kind: record.kind, subkind: record.subkind, operated: record.operated, block: b, ext }, map);
  const effortApplies = !located || hasEffort(located.profile, isOperated(located.profile, record.operated));
  const ruleByField: Partial<Record<LimitName, RuleKind>> = {};
  const ageKind: RuleKind = b.age_rule === "recommendation" ? "advice" : "hard";
  const limits: [LimitName, number | null, RuleKind][] = [
    ["minAge", ruleValOf(b.min_age), ageKind],
    ["maxAge", ruleValOf(b.max_age), ageKind],
    ["minHeightCm", ruleValOf(b.min_height_cm), "hard"],
    ["maxHeightCm", ruleValOf(b.max_height_cm), "hard"],
    ["minWeightKg", ruleValOf(b.min_weight_kg), "hard"],
    ["maxWeightKg", ruleValOf(b.max_weight_kg), "hard"],
  ];
  for (const [name, value, kind] of limits) if (value !== null) ruleByField[name] = kind;
  const kinds = Object.values(ruleByField);
  const rule: RuleKind | null = kinds.includes("hard") ? "hard" : kinds.includes("advice") ? "advice" : null;
  const stroller = strollerOf(b);
  const w = valOf(b.wheelchair);
  const sources = opts.sources;
  const ct = valOf(b.child_time_min);
  const at = valOf(b.adult_time_min);
  const expo = valOf(b.exposure);

  const parts: string[] = [];
  const ruled = limits.filter(([, v]) => v !== null).map(([n]) => n);
  if (ruled.length) {
    const first = (["min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg"] as const)
      .map((k) => b[k]).find((v) => v && v.state === "value");
    const basis = (first?.basis ?? "operator_rule") as Basis;
    const label = rule === "advice" ? `${BASIS_LABEL[basis]} (advice)` : BASIS_LABEL[basis];
    parts.push(dated(label[0]!.toUpperCase() + label.slice(1), first, sources));
  }
  if (effort.source_grade) {
    const sgv = b.effort?.source_grade;
    parts.push(`${effort.source_grade.system.toUpperCase()} grade ${effort.source_grade.value} (${BASIS_LABEL[(sgv?.basis ?? "official_grade") as Basis]})`);
  }
  if (valOf(b.age_band)) parts.push("recommended ages our judgement");
  const timeBasis = (v: AnyVal): string => (v?.basis === "our_inference" ? "our rule" : v?.basis ? BASIS_LABEL[v.basis as Basis] : "source not recorded");
  if (at) parts.push(`adult time ${timeBasis(b.adult_time_min)}`);
  if (ct) parts.push(`child time ${timeBasis(b.child_time_min)}`);
  else parts.push("child time our rule");

  return {
    minAge: ruleValOf(b.min_age),
    maxAge: ruleValOf(b.max_age),
    minHeightCm: ruleValOf(b.min_height_cm),
    maxHeightCm: ruleValOf(b.max_height_cm),
    minWeightKg: ruleValOf(b.min_weight_kg),
    maxWeightKg: ruleValOf(b.max_weight_kg),
    rule,
    stroller: stroller.value,
    wheelchair: w === "step_free" ? "yes" : w === "partial" ? "partly" : w === "none" ? "no" : null,
    carrierOk: valOf(b.carrier_ok),
    familyEffort: effortApplies ? effort.family_effort : null,
    sourceGrade: effortApplies ? effort.source_grade : null,
    childTime: ct && ct.length
      ? { byAge: ct.map((c) => ({ fromAge: c.from_age, minutes: Math.round((c.range[0] + c.range[1]) / 2) })), source: timeBasis(b.child_time_min) }
      : null,
    adultTime: at ? { min: at[0], max: at[1], source: timeBasis(b.adult_time_min) } : null,
    distanceKm: valOf(b.effort?.drivers?.distance_km),
    gainM: valOf(b.effort?.drivers?.gain_m),
    lossM: valOf(b.effort?.drivers?.loss_m),
    provenance: parts.join("; "),
    terrain: effort.terrain,
    effortKm: effort.effort_km,
    exposureUnfenced: !!expo && (expo.level === "significant" || expo.level === "serious") && expo.fenced === "unfenced",
    ruleByField,
    strollerNote: stroller.note,
  };
}
