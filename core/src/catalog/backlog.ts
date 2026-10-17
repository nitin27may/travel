// The research backlog (plan 0A.3): what the catalog is missing, ranked. Items come from GAP markers, stale fields, thin
// types and conflicts; owner-added rows and rows an agent has claimed or finished are kept as they are.
//   priority = max(1, trips_using) * urgency * severity
// The floor of 1 keeps work in areas no trip uses yet above zero, which is where coverage work is needed.
import { sha256hex } from "./common.ts";
import type { CatalogData, Deps, Entity, Row } from "./common.ts";
import { computeCoverage, PROVISIONAL_TARGETS } from "./coverage.ts";
import type { CoverageInput, TypeKey } from "./coverage.ts";
import { findIssues } from "./freshness.ts";
import { SENSITIVE } from "./merge.ts";

const HARD_LIMITS = new Set(["min_age", "max_age", "min_height_cm", "max_height_cm", "min_weight_kg", "max_weight_kg"]);
const STATS = new Set(["hours", "km", "gain_m", "loss_m", "house_grade", "local_grade", "duration_min"]);

/** severity 3 for hard limits, booking windows and prices on must-book offers; 2 for hours and stats; 1 otherwise */
export function severityOf(field: string | null, mustBookPrice: boolean): number {
  if (!field) return 1;
  if (HARD_LIMITS.has(field) || SENSITIVE.has(field) && field !== "house_grade" && field !== "house_basis") return 3;
  if (/^(opens_|sellout_)/.test(field)) return 3;
  if (field === "amount" && mustBookPrice) return 3;
  if (STATS.has(field)) return 2;
  return 1;
}

const LANE_OF_TYPE: Record<TypeKey, string> = {
  sights: "sights", trails: "trails", activities: "adventure", stays: "stays", eateries: "relax-luxury", legs: "logistics", guide: "overview",
};

function laneOfRow(entity: string, row: Row | null): string {
  switch (entity) {
    case "trails": return "trails";
    case "activities": return "adventure";
    case "stays": return "stays";
    case "eateries": return "relax-luxury";
    case "legs": return "logistics";
    case "area_guides": return "overview";
    case "offers": {
      const c = row?.category;
      return c === "lodging" || c === "hut" ? "stays" : c === "flight-intl" || c === "flight-domestic" ? "fares" : c === "tour" || c === "activity" ? "adventure" : "logistics";
    }
    default: return "overview";
  }
}

/** every string in a document, to find which trips mention an id */
function strings(v: unknown, out: Set<string>): void {
  if (typeof v === "string") out.add(v);
  else if (Array.isArray(v)) for (const x of v) strings(x, out);
  else if (v && typeof v === "object") for (const x of Object.values(v)) strings(x, out);
}

interface TripUse {
  slug: string;
  refs: Set<string>;
  /** start of the nearest chosen or booked edition, or null */
  start: string | null;
  mustBook: Set<string>;
}

function tripUse(t: Row): TripUse {
  const refs = new Set<string>();
  strings({ ...t, changelog: undefined, research_refs: undefined }, refs);
  const eds = ((t.editions ?? []) as Row[]).filter((e) => e.status === "chosen" || e.status === "booked").map((e) => e.start as string).filter(Boolean).sort();
  const mustBook = new Set<string>(((t.trip_bookings ?? []) as Row[]).filter((b) => b.priority === "urgent" || b.priority === "must").map((b) => b.offer_id));
  return { slug: t.trip?.slug ?? t.id, refs, start: eds[0] ?? null, mustBook };
}

export interface BacklogInput extends CoverageInput {
  trips: Row[];
  existing: Row[];
}

const daysTo = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

export function buildBacklog(inp: BacklogInput): Row[] {
  const { data, deps, today } = inp;
  const uses = inp.trips.map(tripUse);
  const kept = new Map<string, Row>(inp.existing.map((r) => [r.id, r]));
  const out = new Map<string, Row>();

  const add = (subject: { entity: string | null; id: string | null }, areaId: string | null, reason: string, field: string | null, lane: string, mustBookOffer: string | null): void => {
    const id = "bl-" + sha256hex([subject.entity ?? "", subject.id ?? "", areaId ?? "", reason, field ?? ""].join("|")).slice(0, 12);
    const touching = uses.filter((u) => (subject.id ? u.refs.has(subject.id) : false) || (areaId ? [...u.refs].some((r) => r.startsWith(`${areaId}/`)) : false));
    const startDays = touching.map((u) => (u.start ? daysTo(today, u.start) : null)).filter((d): d is number => d !== null && d >= 0);
    const urgency = startDays.some((d) => d <= 120) ? 3 : startDays.some((d) => d <= 365) ? 2 : 1;
    const must = mustBookOffer ? uses.some((u) => u.mustBook.has(mustBookOffer)) : false;
    const severity = severityOf(field, must);
    const priority = Math.max(1, touching.length) * urgency * severity;
    const prev = kept.get(id);
    out.set(id, {
      id, subject_entity: subject.entity, subject_id: subject.id, area_id: areaId, reason, field, lane, priority,
      status: prev?.status ?? "open", claimed_by: prev?.claimed_by ?? null, created: prev?.created ?? today, done: prev?.done ?? null,
    });
  };

  // GAP markers, conflicts
  for (const entity of ["trails", "activities", "stays", "eateries", "offers", "legs", "area_guides"] as Entity[]) {
    for (const row of data.rows(entity)) {
      if (row.review_status === "retired") continue;
      const area = entity === "area_guides" ? row.id : (row.area_id ?? null);
      for (const [field, m] of Object.entries((row.field_meta ?? {}) as Row)) {
        if (!m || typeof m !== "object") continue;
        if (m.confidence === "gap") add({ entity, id: row.id }, area, "gap", field, laneOfRow(entity, row), null);
        if (m.confidence === "conflict") add({ entity, id: row.id }, area, "conflict", field, laneOfRow(entity, row), null);
      }
      if (row.confidence === "gap") add({ entity, id: row.id }, area, "gap", null, laneOfRow(entity, row), null);
    }
  }
  // stale fields whose class asks for a backlog item
  for (const i of findIssues(data, deps, today)) {
    if (!i.on_stale.includes("backlog")) continue;
    const offerId = i.entity === "offer_prices" ? String(i.id).split("#")[0]! : i.entity === "offers" ? i.id : null;
    const subject = i.entity === "offer_prices" ? { entity: "offers", id: offerId } : { entity: i.entity, id: i.id };
    const offer = offerId ? data.findRow("offers", offerId)?.row ?? null : null;
    add(subject, i.area_id, "stale", i.entity === "offer_prices" ? "amount" : i.field, laneOfRow(subject.entity!, offer), offerId);
  }
  // thin types
  const cov = computeCoverage(inp);
  for (const a of cov.areas.filter((x) => x.level === "area")) {
    for (const key of Object.keys(PROVISIONAL_TARGETS.types) as TypeKey[]) {
      if (a.types[key].score < PROVISIONAL_TARGETS.bands.thin_below) add({ entity: null, id: null }, a.area_id, "low-coverage", key, LANE_OF_TYPE[key], null);
    }
  }
  // rows an owner added, claimed, finished or set aside stay as they are
  for (const r of inp.existing) if (r.reason === "user-request" || r.status !== "open") if (!out.has(r.id)) out.set(r.id, r.status === "open" ? { ...r, priority: Math.max(1, Number(r.priority) || 0) } : r);
  return [...out.values()].sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)));
}
