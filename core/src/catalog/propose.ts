// Step 5 of the flywheel (plan 0A.2): merged records become a proposal. `auto` follows data/catalog/policy.json:
//   - a new row with an official or operator source, no possible duplicate and every required field: auto, landing as
//     review_status proposed and confidence stated (never verified);
//   - a new price snapshot and a new link: auto; a price move over 20 percent is auto and carries a question;
//   - filling a null field from an operator source or better: auto;
//   - anything else (changing a stored fact, a duplicate, a conflict, a retired row): the owner reviews it.
// Running the same sidecars again after they were applied gives an empty proposal.
import { createHash } from "node:crypto";
import { tableOf } from "../schema/index.ts";
import { OpError } from "../ops/types.ts";
import { toText } from "../store/index.ts";
import type { Store } from "../store/index.ts";
import { CatalogData, ENTITIES, bestEvidence, loadCatalog, loadDeps, loadLocations, rankOf, ruleOn, same, urlKey } from "./common.ts";
import type { Deps, Entity, Evidence, Row } from "./common.ts";
import { LIST_FIELDS, SENSITIVE, fieldEvidenceOf, mergeFields } from "./merge.ts";
import type { FieldChange } from "./merge.ts";
import { matchRecord } from "./match.ts";
import type { MatchResult } from "./match.ts";
import { normaliseSidecar } from "./normalise.ts";
import type { NormRecord } from "./normalise.ts";
import { catalogProposal } from "./proposal.ts";
import type { CatalogChange, CatalogProposal } from "./proposal.ts";

/** the fields a new row must carry before policy lets it in without a look */
export const REQUIRED: Record<Entity, string[]> = {
  trails: ["name", "area_id", "km", "house_grade"],
  activities: ["name", "area_id", "type"],
  stays: ["name", "area_id", "kind", "lat", "lon"],
  eateries: ["name", "area_id", "lat", "lon"],
  offers: ["name", "area_id", "subject_entity", "subject_id", "category", "provider"],
  offer_prices: ["offer_id", "amount", "currency", "per"],
  legs: ["from_id", "to_id", "mode", "basis"],
  area_guides: ["summary"],
};

const present = (row: Row, f: string): boolean => row[f] !== undefined && row[f] !== null && row[f] !== "";

export function missingFields(entity: Entity, row: Row): string[] {
  const miss = REQUIRED[entity].filter((f) => !present(row, f));
  if (entity === "legs" && !present(row, "km") && !present(row, "minutes")) miss.push("km or minutes");
  return miss;
}

export interface ProposeOptions {
  today: string;
  now: string;
  actorId: string;
}

export interface ProposeResult {
  /** null when the sidecar changes nothing */
  proposal: CatalogProposal | null;
  warnings: { code: string; message: string; field?: string }[];
  unknownTags: string[];
  /** places and items the pipeline does not write */
  skipped: Record<string, number>;
}

const evSrc = (ids: string[], map: Map<string, Evidence>): CatalogChange["sources"] =>
  ids.filter((i) => map.has(i)).map((i) => ({ id: i, ...map.get(i)! }) as CatalogChange["sources"][number]);

/** is the evidence strong enough for policy rule `min_source_kind`? */
function strongEnough(deps: Deps, ev: Evidence[], ruleId: string): { ok: boolean; best: string } {
  const rule = (deps.policy.rules as Row[]).find((r) => r.id === ruleId);
  const min = rule?.min_source_kind ?? "operator";
  const best = bestEvidence(deps.rank, ev);
  return { ok: !!best && rankOf(deps.rank, best.kind) <= rankOf(deps.rank, min), best: best?.kind ?? "none" };
}

function fieldDoc(c: FieldChange): CatalogChange["fields"][number] {
  return { field: c.field, kind: c.kind, before: c.before ?? null, after: c.after ?? null, incoming: c.incoming ?? null, ...(c.against ? { against: c.against } : {}) };
}

export interface Pool {
  data: CatalogData;
  deps: Deps;
}

function metaEvidence(pool: Pool, entity: Entity, row: Row) {
  const found = pool.data.findRow(entity, row.id);
  const sources = (found?.file.doc.sources ?? []) as Row[];
  return { evidenceOf: (r: Row, f: string) => fieldEvidenceOf(pool.deps.rank, r, f, sources), rank: pool.deps.rank };
}

/** gap markers for a row, from record-level gaps and the sidecar's GAP facts about it */
function gapsFor(rec: NormRecord, facts: Row[]): { field: string; reason: string }[] {
  const out = [...rec.gaps];
  for (const f of facts) {
    if (f.confidence !== "gap" || !rec.id) continue;
    if (f.subject_ref !== rec.id && !String(f.key).startsWith(`${rec.id}.`)) continue;
    const field = String(f.key).split(".").pop()!;
    if (!out.some((g) => g.field === field)) out.push({ field, reason: f.gap_reason ?? "not found" });
  }
  return out;
}

const pad3 = (n: number): string => `ch-${String(n).padStart(3, "0")}`;

export async function proposeFromSidecar(store: Store, sidecarPath: string, opts: ProposeOptions): Promise<ProposeResult> {
  if (!store.readRef) throw new OpError("E_NO_REFS", "this store cannot read research files");
  const bytes = await store.readRef(sidecarPath);
  if (!bytes) throw new OpError("E_NOT_FOUND", `no sidecar at ${sidecarPath}. Sidecars live under research/ next to their Markdown file.`);
  let sidecar: Row;
  try {
    sidecar = JSON.parse(toText(bytes));
  } catch (e) {
    throw new OpError("E_SCHEMA", `${sidecarPath} is not valid JSON: ${(e as Error).message}`);
  }
  const parsed = tableOf("sidecar", "research_sidecar").schema.safeParse(sidecar);
  if (!parsed.success) {
    const first = parsed.error.issues[0]!;
    throw new OpError("E_SCHEMA", `${sidecarPath} is not a research-sidecar/1: ${first.path.join(".") || "root"}: ${first.message}`);
  }
  const deps = await loadDeps(store);
  const data = await loadCatalog(store);
  const locations = await loadLocations(store);
  const pool: Pool = { data, deps };
  const norm = normaliseSidecar(sidecar, sidecarPath, deps);
  const facts: Row[] = sidecar.facts ?? [];
  const pct: number = deps.policy.price_change_question_pct ?? 20;

  const notes: string[] = [];
  const skipped = { ...norm.skipped };
  const placeCount = norm.records.filter((r) => r.entity === "places").length;
  if (placeCount) {
    skipped.places = placeCount;
    notes.push(`${placeCount} place record(s) skipped: places are written to data/locations by python3 tools/locations.py add.`);
  }
  if (skipped.items) notes.push(`${skipped.items} suggested trip item(s) skipped: items belong to a trip proposal (research.propose).`);

  const changes: CatalogChange[] = [];
  const order = (e: string): number => ENTITIES.indexOf(e as Entity);
  const records = norm.records.filter((r): r is NormRecord & { entity: Entity } => r.entity !== "places").sort((a, b) => order(a.entity) - order(b.entity) || String(a.id).localeCompare(String(b.id)));
  const addedIds = new Map<string, string>(); // "entity:id" -> change_id, for price dependencies
  const priceCount = new Map<string, number>(); // snapshots already proposed per offer, to number them
  let n = 0;
  const nextId = (): string => pad3(++n);

  for (const rec of records) {
    const warnings = rec.warnings.map((w) => `${w.code}${w.field ? ` ${w.field}` : ""}: ${w.message}`);
    const sources = evSrc(rec.src, norm.evidence);
    const ev: Evidence[] = sources.map(({ id: _id, ...e }) => e);
    const fact_keys = facts.filter((f) => rec.id && (f.subject_ref === rec.id || String(f.key).startsWith(`${rec.id}.`))).map((f) => f.key).sort();
    const gaps = gapsFor(rec, facts);

    if (rec.entity === "offer_prices") {
      const c = priceChange(rec, sources, ev, pool, addedIds, deps, pct, nextId, warnings, fact_keys, priceCount);
      if (c) {
        if (c.note) notes.push(c.note);
        if (c.change) changes.push(c.change);
      }
      continue;
    }
    if (!rec.id || !(rec.row.area_id || rec.entity === "legs" || rec.entity === "area_guides")) {
      notes.push(`skipped a ${rec.entity} record "${rec.row.name ?? rec.row.provider ?? "?"}": no id could be built (${warnings.map((w) => w.split(": ")[0]).join(", ") || "no area"}).`);
      continue;
    }
    const existing = data.rows(rec.entity);
    const m = matchRecord(rec, existing);

    if (m.kind === "same") {
      const found = data.findRow(rec.entity, m.id!)!;
      const c = editChange(rec, found.row, sources, ev, gaps, pool, m, warnings, fact_keys, nextId);
      if (c) changes.push(c);
      continue;
    }

    // a new row
    const row: Row = { ...rec.row };
    const miss = missingFields(rec.entity, row);
    const addId = nextId();
    const flags: string[] = [];
    const reasons: string[] = [];
    let auto = true;
    if (!ruleOn(deps.policy, "new-row")) {
      auto = false;
      reasons.push("the new-row rule is off in policy.json");
    }
    const strong = strongEnough(deps, ev, "new-row");
    if (!strong.ok) {
      auto = false;
      reasons.push(`no official or operator source (best: ${strong.best})`);
    }
    if (m.kind === "possible") {
      auto = false;
      flags.push("possible-duplicate");
      reasons.push(`possible duplicate of ${m.id} (${describeMatch(m)})`);
    }
    if (miss.length) {
      auto = false;
      flags.push("incomplete");
      reasons.push(`missing ${miss.join(", ")}`);
    }
    const fields: FieldChange[] = Object.entries(row)
      .filter(([k, v]) => !["id", "area_id"].includes(k) && v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => ({ field: k, kind: "fill" as const, before: null, after: v, incoming: v, evidence: ev }));
    for (const g of gaps) fields.push({ field: g.field, kind: "gap", before: null, after: null, incoming: g.reason, evidence: ev });
    const newExt = externalOf(rec, null, row);
    if (newExt) fields.push({ field: "external", kind: "link", before: null, after: newExt, incoming: newExt, evidence: ev });
    if (rec.confidence !== "stated") flags.push(rec.confidence);
    const change: CatalogChange = {
      change_id: addId, op: "add", entity: rec.entity, id: rec.id, area_id: row.area_id ?? null, before: null, after: row,
      fields: fields.map(fieldDoc), sources, fact_keys, auto, flags, status: "open", match: matchDoc(m),
      duplicate_of: m.kind === "possible" ? m.id : null, excludes: [], depends_on: [], missing: miss, question: null, warnings, applied: null, current: null, name: "",
      reason: auto
        ? `New ${singular(rec.entity)} from ${strong.best} source; lands as proposed, stated.`
        : `Review: ${reasons.join("; ")}.`,
    };
    changes.push(change);
    addedIds.set(`${rec.entity}:${rec.id}`, addId);

    // offer the other reading of a possible duplicate: it is the same row
    if (m.kind === "possible") {
      const cand = data.findRow(rec.entity, m.id!)!;
      const alt = editChange(rec, cand.row, sources, ev, gaps, pool, { ...m, kind: "same" }, warnings, fact_keys, nextId, true);
      if (alt) {
        alt.excludes = [addId];
        alt.flags = [...new Set([...alt.flags, "possible-duplicate", "merge-option"])];
        alt.reason = `Treat as the same row as ${m.id} (${describeMatch(m)}) and merge the research into it.`;
        alt.auto = false;
        change.excludes = [alt.change_id];
        changes.push(alt);
      }
    }
  }

  for (const c of changes) {
    if (c.entity === "offer_prices") c.name = `${c.after.amount} ${c.after.currency} ${c.after.per}, read ${c.after.read}`;
    else if (c.op === "add") c.name = String(c.after.name ?? c.after.provider ?? c.id.split("/").pop());
    else c.name = String(data.findRow(c.entity as Entity, c.id)?.row.name ?? c.id.split("/").pop());
  }
  if (changes.length === 0) return { proposal: null, warnings: norm.warnings, unknownTags: norm.unknownTags, skipped };

  const digest = createHash("sha256").update(JSON.stringify([sidecarPath, changes.map((c) => [c.entity, c.id, c.op, c.after])])).digest("hex").slice(0, 6);
  const proposal: CatalogProposal = {
    schema: "catalog-proposal/1",
    id: `cp-${opts.today}-${norm.lane}-${digest}`,
    created: opts.now,
    actor: opts.actorId,
    source: { sidecar: sidecarPath, lane: norm.lane, researched: norm.researched },
    status: "open",
    notes,
    changes,
  };
  const check = catalogProposal.safeParse(proposal);
  if (!check.success) throw new OpError("E_INTERNAL", `built an invalid proposal: ${check.error.issues[0]!.path.join(".")}: ${check.error.issues[0]!.message}`);
  return { proposal, warnings: norm.warnings, unknownTags: norm.unknownTags, skipped };
}

/** external ids of a record that the row does not carry yet (kept in field_meta.external); null when there is nothing new */
function externalOf(rec: NormRecord, stored: Row | null, cols: Row): Row | null {
  const ext: Row = { ...(stored?.field_meta?.external ?? {}) };
  let changed = false;
  for (const k of ["wikidata", "osm_relation"]) {
    const v = rec.match[k];
    if (v === undefined || ext[k] !== undefined || cols[k] !== undefined) continue;
    if (k === "osm_relation" && cols.geometry_source === "osm" && String(cols.geometry_source_id) === String(v)) continue;
    ext[k] = v;
    changed = true;
  }
  const url = rec.match.book_url;
  if (typeof url === "string") {
    const have = [cols.book_url, cols.official_url, ...(ext.book_urls ?? [])].filter((u) => typeof u === "string").map(urlKey);
    if (!have.includes(urlKey(url))) {
      ext.book_urls = [...(ext.book_urls ?? []), url];
      changed = true;
    }
  }
  return changed ? ext : null;
}

const singular = (e: string): string => e.replace(/ies$/, "y").replace(/s$/, "");

function describeMatch(m: MatchResult): string {
  return `${m.by}, similarity ${m.similarity}${m.distance_m !== null ? `, ${m.distance_m} m apart` : ""}`;
}

function matchDoc(m: MatchResult): CatalogChange["match"] {
  return { kind: m.kind, by: m.by, similarity: m.similarity, distance_m: m.distance_m, candidates: m.candidates };
}

/** an edit of an existing row from a matched record, or null when nothing would change */
function editChange(rec: NormRecord & { entity: Entity }, row: Row, sources: CatalogChange["sources"], ev: Evidence[], gaps: { field: string; reason: string }[], pool: Pool, m: MatchResult, warnings: string[], fact_keys: string[], nextId: () => string, force = false): CatalogChange | null {
  const ctx = metaEvidence(pool, rec.entity, row);
  const changes = mergeFields(row, rec.row, ev, ctx);
  // external ids that have no column of their own are kept in field_meta.external
  const ext = externalOf(rec, row, row);
  if (ext) changes.push({ field: "external", kind: "link", before: row.field_meta?.external ?? null, after: ext, incoming: ext, evidence: ev });
  for (const g of gaps) {
    if (row[g.field] === null || row[g.field] === undefined || row[g.field] === "") {
      const have = row.field_meta?.[g.field];
      if (!(have?.confidence === "gap" && have?.gap_reason === g.reason)) changes.push({ field: g.field, kind: "gap", before: null, after: null, incoming: g.reason, evidence: ev });
    }
  }
  if (changes.length === 0) return null;

  const flags: string[] = [];
  const reasons: string[] = [];
  let auto = !force;
  const deps = pool.deps;
  const strong = strongEnough(deps, ev, "fill-null-field");
  for (const c of changes) {
    switch (c.kind) {
      case "fill":
        if (!ruleOn(deps.policy, "fill-null-field") || !strong.ok) {
          auto = false;
          reasons.push(`filling ${c.field} needs an operator source or better (best: ${strong.best})`);
        }
        break;
      case "link":
        if (!ruleOn(deps.policy, "new-link")) {
          auto = false;
          reasons.push(`the new-link rule is off`);
        }
        break;
      case "corroborate":
      case "gap":
        break;
      case "replace":
        auto = false;
        reasons.push(`${c.field} would change from ${show(c.before)} to ${show(c.after)}`);
        break;
      case "alternative":
        auto = false;
        reasons.push(`${c.field}: ${show(c.incoming)} is older or weaker than ${show(c.before)}; kept as an alternative`);
        break;
      case "conflict":
        auto = false;
        flags.push("conflict");
        reasons.push(`${c.field}: ${show(c.incoming)} disagrees with ${show(c.before)} at equal strength`);
        break;
    }
    if (SENSITIVE.has(c.field) && c.kind !== "fill" && c.kind !== "corroborate") flags.push("sensitive");
  }
  if (row.review_status === "retired") {
    auto = false;
    flags.push("retired");
    reasons.push("the row is retired");
  }
  if (!(flags.includes("conflict") || flags.includes("sensitive") || flags.includes("retired")) && changes.every((c) => ["alternative", "corroborate", "gap", "link", "fill"].includes(c.kind))) flags.push("low");
  const before: Row = {};
  const after: Row = {};
  for (const c of changes) {
    if (c.kind === "fill" || c.kind === "link" || c.kind === "replace") {
      before[c.field] = c.before ?? null;
      after[c.field] = c.after;
    }
  }
  return {
    change_id: nextId(), op: "edit", entity: rec.entity, id: row.id, area_id: row.area_id ?? null, before, after,
    fields: changes.map(fieldDoc), sources, fact_keys, auto, flags: [...new Set(flags)], status: "open", match: matchDoc(m),
    duplicate_of: null, excludes: [], depends_on: [], missing: [], question: null, warnings, applied: null, name: "",
    current: { review_status: row.review_status, confidence: row.confidence, last_verified: row.last_verified ?? null },
    reason: auto ? `Fills ${changes.filter((c) => c.kind === "fill" || c.kind === "link").map((c) => c.field).join(", ") || "provenance only"} from a ${strong.best} source.` : `Review: ${reasons.join("; ")}.`,
  };
}

const show = (v: unknown): string => (typeof v === "string" ? JSON.stringify(v) : Array.isArray(v) ? `[${v.join(", ")}]` : String(v));

interface PriceOut {
  change?: CatalogChange;
  note?: string;
}

function priceChange(rec: NormRecord, sources: CatalogChange["sources"], ev: Evidence[], pool: Pool, addedIds: Map<string, string>, deps: Deps, pct: number, nextId: () => string, warnings: string[], fact_keys: string[], priceCount: Map<string, number>): PriceOut | null {
  const row = { ...rec.row };
  const offerId = row.offer_id as string | undefined;
  const miss = missingFields("offer_prices", row);
  if (!offerId || miss.length) return { note: `skipped a price: missing ${miss.join(", ") || "offer_id"}.` };
  const offer = pool.data.findRow("offers", offerId);
  const dep = addedIds.get(`offers:${offerId}`);
  if (!offer && !dep) return { note: `skipped a price for ${offerId}: the offer is not in the catalog and this sidecar does not add it.` };
  const prices = (offer?.file.doc.offer_prices ?? []) as Row[];
  const same4 = (p: Row): boolean => p.offer_id === offerId && p.currency === row.currency && p.per === row.per && (p.age_from ?? null) === (row.age_from ?? null) && (p.age_to ?? null) === (row.age_to ?? null);
  if (prices.some((p) => same4(p) && p.amount === row.amount && p.read === row.read)) return null;
  const earlier = prices.filter((p) => same4(p) && p.read < row.read).sort((a, b) => b.read.localeCompare(a.read))[0];
  const flags: string[] = [];
  let question: string | null = null;
  let auto = ruleOn(deps.policy, "new-price-snapshot");
  const reasons: string[] = auto ? [] : ["the new-price-snapshot rule is off"];
  if (earlier && earlier.amount > 0) {
    const move = ((row.amount - earlier.amount) / earlier.amount) * 100;
    if (Math.abs(move) > pct) {
      flags.push("price-jump");
      question = `Price moved ${move > 0 ? "up" : "down"} ${Math.abs(Math.round(move))} percent (${earlier.amount} to ${row.amount} ${row.currency}, read ${earlier.read} and ${row.read}). Ask on any trip that uses ${offerId}.`;
      if (!ruleOn(deps.policy, "price-change-over-20pct")) auto = false;
    }
  }
  const ids = prices.filter((p) => p.offer_id === offerId).map((p) => Number(String(p.id).split("#")[1]));
  const n = (ids.length ? Math.max(...ids) : 0) + 1 + (priceCount.get(offerId) ?? 0);
  priceCount.set(offerId, (priceCount.get(offerId) ?? 0) + 1);
  return {
    change: {
      change_id: nextId(), op: "add", entity: "offer_prices", id: `${offerId}#${n}`, area_id: offer?.row.area_id ?? null, before: null, after: row,
      fields: Object.entries(row).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0)).map(([k, v]) => fieldDoc({ field: k, kind: "fill", before: null, after: v, incoming: v, evidence: ev })),
      sources, fact_keys, auto, flags, status: "open", match: null, duplicate_of: null, excludes: [], depends_on: dep ? [dep] : [], missing: [], question, warnings, applied: null, current: null, name: "",
      reason: auto ? `New price snapshot (${row.amount} ${row.currency} ${row.per}, read ${row.read}); snapshots append.` : `Review: ${reasons.join("; ")}.`,
    },
  };
}

export { LIST_FIELDS, same };
