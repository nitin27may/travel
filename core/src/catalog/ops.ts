// The catalog operations (plan 0A.2, 5.3): catalog.add, edit, merge, retire, verify, propose, apply, reject, undo and
// backlog.add. They run through their own small runner rather than core/src/ops/run.ts, because that runner is built
// around one trip file and its changelog; a catalog write touches country files, appends catalog_changes rows
// (data/catalog/changes/YYYY-MM.jsonl) and may write a proposal. Same contract otherwise: input validated against the
// catalogue, an actor on every write, nothing written unless every file validates, same bytes for the same input.
//
// Nothing here ever deletes a catalog row (retire keeps it) and nothing here sets "verified" except catalog.verify.
import { join } from "node:path";
import { OPS_BY_NAME } from "../ops/catalogue.ts";
import { OpError } from "../ops/types.ts";
import type { Failure, RunResult, Warning, WriteOk } from "../ops/run.ts";
import { clock } from "../ops/run.ts";
import { tableOf } from "../schema/index.ts";
import { toBytes, toText } from "../store/index.ts";
import type { Store } from "../store/index.ts";
import { validateDoc } from "../validate/index.ts";
import {
  BACKLOG_PATH, CatalogData, FILE_TABLES, FOLDER, blankRow, canon, changesPath, clone, countryOfArea, countryOfRow, emptyFile, ensureSource, filePath,
  hostOf, isEntity, loadCatalog, loadDeps, proposalPath, readJson, ruleOn, same, serializeCatalogFile,
} from "./common.ts";
import type { CatalogFile, Deps, Entity, Evidence, Row } from "./common.ts";
import { applyFieldChanges } from "./merge.ts";
import type { FieldChange } from "./merge.ts";
import { catalogProposal, settle } from "./proposal.ts";
import type { CatalogChange, CatalogProposal } from "./proposal.ts";
import { REQUIRED, proposeFromSidecar } from "./propose.ts";

export const CATALOG_OPS = ["catalog.add", "catalog.edit", "catalog.merge", "catalog.retire", "catalog.verify", "catalog.propose", "catalog.apply", "catalog.reject", "catalog.undo", "backlog.add"] as const;
export const isCatalogOp = (name: string): boolean => (CATALOG_OPS as readonly string[]).includes(name);

export interface CatalogRunOptions {
  now?: string;
  today?: string;
}

export interface CatalogWriteOk extends WriteOk {
  /** operation specific output (catalog.propose returns the proposal here) */
  result?: unknown;
}

const IDENTITY = new Set(["id", "area_id"]);
const PROVENANCE_COLS = new Set(["review_status", "confidence", "verified_by", "last_verified", "contributed_by", "licence", "merged_from", "updated", "sources", "field_meta"]);

/** one run: loads the catalog once, collects every change, commits at the end */
export class Session {
  store: Store;
  deps!: Deps;
  data!: CatalogData;
  actor: { id: string; via: string };
  now: string;
  today: string;
  /** catalog_changes rows added in this run, seq assigned at commit */
  log: Row[] = [];
  dirty = new Set<string>();
  proposals = new Map<string, CatalogProposal>();
  backlog: Row | null = null;
  maxSeq = 0;
  changed: string[] = [];
  result: unknown = undefined;
  warnings: Warning[] = [];

  constructor(store: Store, actor: { id: string; via: string }, now: string, today: string) {
    this.store = store;
    this.actor = actor;
    this.now = now;
    this.today = today;
  }

  async load(): Promise<void> {
    this.deps = await loadDeps(this.store);
    this.data = await loadCatalog(this.store);
    for (const p of await this.store.list("data/catalog/changes/")) {
      for (const line of toText((await this.store.read(p))!).split("\n")) {
        if (line.trim()) this.maxSeq = Math.max(this.maxSeq, Number(JSON.parse(line).seq));
      }
    }
  }

  file(folder: string, cc: string): CatalogFile {
    const path = filePath(folder, cc);
    let f = this.data.files.get(path);
    if (!f) {
      f = { path, folder, cc, doc: emptyFile(folder, cc) };
      this.data.files.set(path, f);
    }
    this.dirty.add(path);
    return f;
  }

  find(entity: Entity, id: string): { row: Row; file: CatalogFile } {
    const hit = this.data.findRow(entity, id);
    if (!hit) throw new OpError("E_NOT_FOUND", `no ${entity} row "${id}" in the catalog. Use search or rows.query to find its id.`);
    this.dirty.add(hit.file.path);
    return hit;
  }

  note(entity: Entity, id: string, op: string, before: Row | null, after: Row | null, reason: string | null, proposalId: string | null, sources: string[]): number {
    const seq = this.maxSeq + this.log.length + 1;
    this.log.push({
      seq, at: this.now, actor_id: this.actor.id, actor_via: this.actor.via, entity: entity === "area_guides" ? "area_guides" : entity, id, op, before, after,
      reason, proposal_id: proposalId, sources,
    });
    this.changed.push(`${entity}:${id}`);
    return seq;
  }

  async commit(): Promise<{ seq: number; rev: string | null }> {
    const root = this.store.refRoot;
    const writes: { path: string; text: string; expect: string | null }[] = [];
    for (const path of [...this.dirty].sort()) {
      const f = this.data.files.get(path);
      if (!f) continue;
      const text = serializeCatalogFile(f.folder, f.doc);
      const before = await this.store.read(path);
      if (before && toText(before) === text) continue;
      const res = validateDoc(JSON.parse(text), "catalog", root, { family: "catalog", entity: f.folder, fileCC: f.cc }, join(root, path));
      if (res.errors.length) {
        const e = res.errors[0]!;
        throw new OpError(e.code, `${path} would be invalid: ${e.path} ${e.message}${res.errors.length > 1 ? ` (and ${res.errors.length - 1} more)` : ""}. Nothing was written.`);
      }
      this.warnings.push(...res.warnings.map((w) => ({ code: w.code, message: w.message, where: `${path}${w.path}` })));
      writes.push({ path, text, expect: before ? await this.store.rev(path) : null });
    }
    if (this.log.length) {
      const path = changesPath(this.now);
      const old = await this.store.read(path);
      const prefix = old ? toText(old) : "";
      writes.push({ path, text: prefix + this.log.map((r) => JSON.stringify(r)).join("\n") + "\n", expect: old ? await this.store.rev(path) : null });
    }
    for (const [path, p] of this.proposals) writes.push({ path, text: JSON.stringify(p, null, 2) + "\n", expect: (await this.store.read(path)) ? await this.store.rev(path) : null });
    if (this.backlog) {
      const check: string[] = [];
      for (const r of this.backlog.backlog as Row[]) {
        const parsed = tableOf("catalog", "backlog").schema.safeParse(r);
        if (!parsed.success) check.push(`${r.id}: ${parsed.error.issues[0]!.path.join(".")} ${parsed.error.issues[0]!.message}`);
      }
      if (check.length) throw new OpError("E_SCHEMA", `backlog.json would be invalid: ${check[0]}. Nothing was written.`);
      writes.push({ path: BACKLOG_PATH, text: serializeBacklog(this.backlog), expect: (await this.store.read(BACKLOG_PATH)) ? await this.store.rev(BACKLOG_PATH) : null });
    }
    for (const w of writes) await this.store.write(w.path, toBytes(w.text), w.expect);
    return { seq: this.maxSeq + this.log.length, rev: null };
  }
}

/** backlog.json: rows sorted by priority then id, one per line */
export function serializeBacklog(doc: Row): string {
  const t = tableOf("catalog", "backlog");
  const rows = (doc.backlog as Row[]).map((r) => {
    const o: Row = {};
    for (const c of Object.keys(t.shape)) if (c in r) o[c] = r[c];
    return o;
  }).sort((a, b) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)));
  const lines = ["{", `"schema_version": 1,`];
  if (rows.length) {
    lines.push(`"backlog": [`);
    rows.forEach((r, i) => lines.push(JSON.stringify(r) + (i < rows.length - 1 ? "," : "")));
    lines.push("]");
  } else lines.push(`"backlog": []`);
  lines.push("}");
  return lines.join("\n") + "\n";
}

export const diffRow = (a: Row, b: Row): { before: Row; after: Row } => {
  const before: Row = {};
  const after: Row = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (canon(a[k]) !== canon(b[k])) {
      before[k] = a[k] ?? null;
      after[k] = b[k] ?? null;
    }
  }
  return { before, after };
};

const addUnique = (list: unknown, ...vals: string[]): string[] => [...new Set([...((list as string[] | undefined) ?? []), ...vals])].sort();

function tableCols(entity: Entity): Set<string> {
  return new Set(Object.keys(tableOf("catalog", entity).shape));
}

// ----------------------------------------------------------------------------- operations
type Handler = (s: Session, input: Row) => Promise<void>;

const HANDLERS: Record<string, Handler> = {
  "catalog.add": async (s, i) => {
    const entity = i.entity as Entity;
    const row = clone(i.row) as Row;
    const cc = countryOfRow(entity, row);
    const f = s.file(FOLDER[entity], cc);
    if (s.data.findRow(entity, row.id)) throw new OpError("E_EXISTS", `${entity} "${row.id}" already exists. Use catalog.edit to change it.`);
    row.review_status = "proposed";
    row.confidence = row.confidence === "inference" || row.confidence === "gap" ? row.confidence : "stated";
    row.verified_by = null;
    row.last_verified = null;
    row.contributed_by = addUnique(row.contributed_by, s.actor.id);
    row.merged_from = row.merged_from ?? [];
    row.updated = s.today;
    (f.doc[entity] as Row[]).push(row);
    s.note(entity, row.id, "add", null, row, i.reason ?? null, null, row.sources ?? []);
  },

  "catalog.edit": async (s, i) => {
    const entity = i.entity as Entity;
    const { row, file } = s.find(entity, i.id);
    const cols = tableCols(entity);
    const old = clone(row);
    if (Object.entries(i.patch as Row).every(([k, v]) => cols.has(k) && same(row[k], v))) throw new OpError("E_NOOP", `the patch changes nothing on ${entity} "${i.id}".`);
    for (const [k, v] of Object.entries(i.patch as Row)) {
      if (!cols.has(k)) throw new OpError("E_SCHEMA", `${entity} has no column "${k}". Columns: ${[...cols].join(", ")}.`);
      if (IDENTITY.has(k) || PROVENANCE_COLS.has(k)) throw new OpError("E_SCHEMA", `"${k}" is not edited directly. Identity never changes, and provenance is set by the operations (verify, merge, retire).`);
      row[k] = v;
    }
    const meta: Row = clone(row.field_meta ?? {});
    let srcId: string | null = null;
    if (i.source) srcId = ensureSource(file.doc, { url: i.source, kind: "community", read: s.today, title: `cited by ${s.actor.id}`, publisher: "" });
    for (const k of Object.keys(i.patch as Row)) meta[k] = { kind: "owner", read: s.today, src: srcId ? [srcId] : [], by: s.actor.id, reason: i.reason };
    row.field_meta = meta;
    if (srcId) row.sources = addUnique(row.sources, srcId);
    row.contributed_by = addUnique(row.contributed_by, s.actor.id);
    row.updated = s.today;
    const d = diffRow(old, row);
    s.note(entity, i.id, "edit", d.before, d.after, i.reason, null, srcId ? [srcId] : []);
  },

  "catalog.merge": async (s, i) => {
    const entity = i.entity as Entity;
    if (i.keep === i.drop) throw new OpError("E_SCHEMA", "keep and drop are the same row.");
    const k = s.find(entity, i.keep);
    const d = s.find(entity, i.drop);
    if (d.row.review_status === "retired") throw new OpError("E_NOOP", `${i.drop} is already retired.`);
    const keepOld = clone(k.row);
    const dropOld = clone(d.row);
    const meta: Row = clone(k.row.field_meta ?? {});
    for (const col of tableCols(entity)) {
      if (IDENTITY.has(col) || PROVENANCE_COLS.has(col)) continue;
      const a = k.row[col];
      const b = d.row[col];
      if (b === null || b === undefined || b === "" || (Array.isArray(b) && b.length === 0)) continue;
      if (a === null || a === undefined || a === "" || (Array.isArray(a) && a.length === 0)) {
        k.row[col] = b;
        meta[col] = { ...(d.row.field_meta?.[col] ?? { kind: "community", read: "0000-00-00", src: [] }), merged_from: i.drop };
      } else if (!same(a, b) && !(Array.isArray(a) && Array.isArray(b) && b.every((x) => a.some((y: unknown) => same(x, y))))) {
        const m: Row = clone(meta[col] ?? {});
        m.alternatives = [...(m.alternatives ?? []), { value: b, kind: d.row.field_meta?.[col]?.kind ?? "community", read: d.row.field_meta?.[col]?.read ?? "0000-00-00", src: [], from: i.drop }];
        meta[col] = m;
      }
    }
    k.row.field_meta = meta;
    k.row.merged_from = addUnique(k.row.merged_from, i.drop, ...((d.row.merged_from as string[]) ?? []));
    k.row.sources = addUnique(k.row.sources, ...((d.row.sources as string[]) ?? []));
    k.row.contributed_by = addUnique(k.row.contributed_by, s.actor.id, ...((d.row.contributed_by as string[]) ?? []));
    k.row.updated = s.today;
    d.row.review_status = "retired";
    d.row.field_meta = { ...(d.row.field_meta ?? {}), merged_into: i.keep };
    d.row.updated = s.today;
    const dk = diffRow(keepOld, k.row);
    s.note(entity, i.keep, "merge", dk.before, dk.after, i.reason, null, []);
    const dd = diffRow(dropOld, d.row);
    s.note(entity, i.drop, "merge", dd.before, dd.after, i.reason, null, []);
  },

  "catalog.retire": async (s, i) => {
    const entity = i.entity as Entity;
    const { row } = s.find(entity, i.id);
    if (row.review_status === "retired") throw new OpError("E_NOOP", `${i.id} is already retired.`);
    const old = clone(row);
    row.review_status = "retired";
    row.updated = s.today;
    const d = diffRow(old, row);
    s.note(entity, i.id, "retire", d.before, d.after, i.reason, null, []);
  },

  "catalog.verify": async (s, i) => {
    const entity = i.entity as Entity;
    const { row, file } = s.find(entity, i.id);
    if (row.review_status === "retired") throw new OpError("E_NOT_ELIGIBLE", `${i.id} is retired; it cannot be verified.`);
    const agent = s.actor.id.startsWith("agent:");
    let by = s.actor.id;
    if (agent || !s.deps.policy.promotion?.owner_verify) {
      const miss = promotionGaps(entity, row, file, s.deps.policy);
      if (miss.length) throw new OpError("E_NOT_ELIGIBLE", `${i.id} is not eligible for the two-official-sources rule: ${miss.join("; ")}. Only the owner can verify it otherwise.`);
      by = "rule:two-official-sources";
    }
    const old = clone(row);
    row.review_status = "verified";
    row.confidence = "verified";
    row.verified_by = by;
    row.last_verified = s.today;
    row.updated = s.today;
    const d = diffRow(old, row);
    s.note(entity, i.id, "verify", d.before, d.after, i.note ?? null, null, []);
  },

  "catalog.propose": async (s, i) => {
    if (!i.sidecar) throw new OpError("E_UNSUPPORTED", "catalog.propose reads a research sidecar: give {sidecar: \"research/...json\"}. Trip based proposals arrive with the editor (P6).");
    const res = await proposeFromSidecar(s.store, i.sidecar, { today: s.today, now: s.now, actorId: s.actor.id });
    if (!res.proposal) {
      s.result = { proposal: null, changes: 0, auto: 0, warnings: res.warnings, unknown_tags: res.unknownTags, skipped: res.skipped };
      return;
    }
    const path = proposalPath(res.proposal.id);
    const existing = await s.store.read(path);
    let proposal = res.proposal;
    let kept = false;
    if (existing) {
      proposal = catalogProposal.parse(JSON.parse(toText(existing)));
      kept = true;
    } else s.proposals.set(path, proposal);
    s.result = {
      proposal_id: proposal.id, path, existing: kept, changes: proposal.changes.length, auto: proposal.changes.filter((c) => c.auto).length,
      warnings: res.warnings, unknown_tags: res.unknownTags, skipped: res.skipped, proposal,
    };
    s.changed.push(proposal.id);
  },

  "catalog.apply": async (s, i) => {
    const { path, proposal } = await loadProposal(s, i.proposal_id);
    const open = proposal.changes.filter((c) => c.status === "open");
    let todo: CatalogChange[];
    if (i.change_ids) {
      const unknown = (i.change_ids as string[]).filter((x) => !proposal.changes.some((c) => c.change_id === x));
      if (unknown.length) throw new OpError("E_NOT_FOUND", `proposal ${proposal.id} has no change ${unknown.join(", ")}. Its changes: ${proposal.changes.map((c) => c.change_id).join(", ")}.`);
      todo = proposal.changes.filter((c) => (i.change_ids as string[]).includes(c.change_id) && c.status === "open");
    } else todo = open.filter((c) => c.auto);
    if (todo.length === 0) throw new OpError("E_NOOP", `proposal ${proposal.id} has no ${i.change_ids ? "open change among those named" : "open auto-accepted change"}. Name change ids to apply the others.`);
    const done = new Set(proposal.changes.filter((c) => c.status === "applied").map((c) => c.change_id));
    for (const c of todo) {
      for (const dep of c.depends_on) if (!done.has(dep) && !todo.some((t) => t.change_id === dep)) {
        throw new OpError("E_DEPENDS", `change ${c.change_id} (${c.entity} ${c.id}) needs ${dep} first. Accept ${dep} too.`);
      }
      const excl = todo.find((t) => c.excludes.includes(t.change_id));
      if (excl) throw new OpError("E_EXCLUSIVE", `changes ${c.change_id} and ${excl.change_id} are alternatives for the same entity; apply one.`);
      const seqs = applyChange(s, proposal, c);
      c.status = "applied";
      c.applied = { at: s.now, actor: s.actor.id, seq: seqs };
      done.add(c.change_id);
      for (const o of proposal.changes) if (c.excludes.includes(o.change_id) && o.status === "open") o.status = "superseded";
    }
    settle(proposal);
    s.proposals.set(path, proposal);
    s.result = { applied: todo.map((c) => c.change_id), status: proposal.status };
  },

  "catalog.reject": async (s, i) => {
    const { path, proposal } = await loadProposal(s, i.proposal_id);
    const ids = i.change_ids as string[] | undefined;
    if (ids) {
      const unknown = ids.filter((x) => !proposal.changes.some((c) => c.change_id === x));
      if (unknown.length) throw new OpError("E_NOT_FOUND", `proposal ${proposal.id} has no change ${unknown.join(", ")}.`);
    }
    const todo = proposal.changes.filter((c) => c.status === "open" && (!ids || ids.includes(c.change_id)));
    if (todo.length === 0) throw new OpError("E_NOOP", `proposal ${proposal.id} has no open change to reject.`);
    for (const c of todo) c.status = "rejected";
    settle(proposal);
    s.proposals.set(path, proposal);
    s.changed.push(...todo.map((c) => c.change_id));
    s.result = { rejected: todo.map((c) => c.change_id), status: proposal.status };
  },

  "catalog.undo": async (s, i) => {
    const { path, proposal } = await loadProposal(s, i.proposal_id);
    const ids = i.change_ids as string[] | undefined;
    // a named change that was rejected is reopened; an applied one is reversed from catalog_changes
    const todo = proposal.changes.filter((c) => (c.status === "applied" || (ids && c.status === "rejected")) && (!ids || ids.includes(c.change_id))).sort((a, b) => b.change_id.localeCompare(a.change_id));
    if (todo.length === 0) throw new OpError("E_NOOP", `proposal ${proposal.id} has no applied change${ids ? " among those named" : ""} to undo.`);
    const rows = await readChanges(s.store);
    for (const c of todo) {
      if (c.status === "rejected") {
        c.status = "open";
        continue;
      }
      for (const seq of [...(c.applied?.seq ?? [])].sort((a, b) => b - a)) {
        const entry = rows.find((r) => r.seq === seq);
        if (!entry) throw new OpError("E_NOT_FOUND", `catalog_changes row ${seq} is missing; cannot undo change ${c.change_id}.`);
        undoEntry(s, entry, `undo of change ${c.change_id} (seq ${seq})`, proposal.id);
      }
      c.status = "open";
      c.applied = null;
      for (const o of proposal.changes) if (o.excludes.includes(c.change_id) && o.status === "superseded") o.status = "open";
    }
    settle(proposal);
    s.proposals.set(path, proposal);
    s.result = { undone: todo.map((c) => c.change_id), status: proposal.status };
  },

  "backlog.add": async (s, i) => {
    const doc = s.backlog ?? (await readJson(s.store, BACKLOG_PATH)) ?? { schema_version: 1, backlog: [] };
    const row = clone(i.row) as Row;
    if ((doc.backlog as Row[]).some((r) => r.id === row.id)) throw new OpError("E_EXISTS", `backlog row ${row.id} exists.`);
    (doc.backlog as Row[]).push(row);
    s.backlog = doc;
    s.changed.push(row.id);
  },
};

async function readChanges(store: Store): Promise<Row[]> {
  const out: Row[] = [];
  for (const p of await store.list("data/catalog/changes/")) {
    for (const line of toText((await store.read(p))!).split("\n")) if (line.trim()) out.push(JSON.parse(line));
  }
  return out.sort((a, b) => a.seq - b.seq);
}

/** reverse one catalog_changes row. An add is undone by retiring the row; a price snapshot (which has no status) is removed. */
function undoEntry(s: Session, entry: Row, reason: string, proposalId: string): void {
  const entity = entry.entity as Entity;
  if (entity === "offer_prices") {
    const offerId = String(entry.id).split("#")[0]!;
    const hit = s.find("offers", offerId);
    const list = hit.file.doc.offer_prices as Row[];
    const at = list.findIndex((r) => r.id === entry.id);
    if (at < 0) throw new OpError("E_STALE_CHANGE", `price ${entry.id} is gone already.`);
    const old = list[at]!;
    list.splice(at, 1);
    s.note(entity, entry.id, "edit", old, null, reason, proposalId, []);
    return;
  }
  const { row } = s.find(entity, entry.id);
  const old = clone(row);
  if (entry.op === "add") {
    row.review_status = "retired";
    row.updated = s.today;
    const d = diffRow(old, row);
    s.note(entity, entry.id, "retire", d.before, d.after, reason, proposalId, []);
    return;
  }
  // an edit, merge, verify or retire: put the changed keys back, provided nothing touched them since
  for (const [k, v] of Object.entries(entry.after as Row)) {
    if (k === "updated") continue;
    if (!same(row[k], v)) throw new OpError("E_STALE_CHANGE", `${entity} ${entry.id} changed since seq ${entry.seq} (${k}); undo that later change first.`);
  }
  for (const [k, v] of Object.entries(entry.before as Row)) row[k] = v;
  row.updated = s.today;
  const d = diffRow(old, row);
  s.note(entity, entry.id, "edit", d.before, d.after, reason, proposalId, []);
}

async function loadProposal(s: Session, id: string): Promise<{ path: string; proposal: CatalogProposal }> {
  const path = proposalPath(id);
  const b = await s.store.read(path);
  if (!b) throw new OpError("E_NOT_FOUND", `no catalog proposal "${id}". Proposals live in data/catalog/proposals/.`);
  const p = catalogProposal.safeParse(JSON.parse(toText(b)));
  if (!p.success) throw new OpError("E_SCHEMA", `${path} is not a catalog-proposal/1: ${p.error.issues[0]!.path.join(".")}: ${p.error.issues[0]!.message}`);
  return { path, proposal: p.data };
}

// ----------------------------------------------------------------------------- apply one change
function evidenceOf(c: CatalogChange): Evidence[] {
  return c.sources.map(({ id: _id, ...e }) => e);
}

function toFieldChanges(c: CatalogChange, ev: Evidence[]): FieldChange[] {
  return c.fields.map((f) => ({ field: f.field, kind: f.kind, before: f.before, after: f.after, incoming: f.incoming, evidence: ev, ...(f.against ? { against: f.against } : {}) }));
}

function applyChange(s: Session, proposal: CatalogProposal, c: CatalogChange): number[] {
  const ev = evidenceOf(c);
  const lane = proposal.source.lane;
  const agent = `agent:${lane}`;

  if (c.entity === "offer_prices") {
    const offerId = String(c.after.offer_id);
    const hit = s.data.findRow("offers", offerId);
    if (!hit) throw new OpError("E_NOT_FOUND", `price ${c.id}: the offer ${offerId} is not in the catalog yet. Accept the change that adds it first.`);
    s.dirty.add(hit.file.path);
    const prices = hit.file.doc.offer_prices as Row[];
    if (prices.some((p) => p.offer_id === offerId && p.amount === c.after.amount && p.currency === c.after.currency && p.per === c.after.per && p.read === c.after.read && (p.age_from ?? null) === (c.after.age_from ?? null) && (p.age_to ?? null) === (c.after.age_to ?? null))) {
      throw new OpError("E_NOOP", `price ${c.id} is already in the catalog.`);
    }
    const nums = prices.filter((p) => p.offer_id === offerId).map((p) => Number(String(p.id).split("#")[1]));
    const id = `${offerId}#${(nums.length ? Math.max(...nums) : 0) + 1}`;
    const src = ev.length ? ensureSource(hit.file.doc, ev.sort((a, b) => a.read.localeCompare(b.read)).at(-1)!) : (hit.file.doc.sources as Row[])[0]?.id;
    if (!src) throw new OpError("E_SCHEMA", `price ${c.id} has no source.`);
    const row = { ...blankRow("offer_prices", s.today), ...clone(c.after), id, source_id: src };
    prices.push(row);
    return [s.note("offer_prices", id, "add", null, row, c.reason, proposal.id, [src])];
  }

  const entity = c.entity as Entity;
  if (c.op === "add") {
    const cc = countryOfRow(entity, c.after);
    const file = s.file(FOLDER[entity], cc);
    if (s.data.findRow(entity, c.id)) throw new OpError("E_EXISTS", `${entity} "${c.id}" is already in the catalog; the research should be merged into it instead (reject this change and re-run propose).`);
    const row: Row = { ...blankRow(entity, s.today), ...clone(c.after), id: c.id };
    row.review_status = "proposed";
    row.confidence = c.flags.includes("inference") ? "inference" : c.flags.includes("gap") ? "gap" : "stated";
    row.verified_by = null;
    row.last_verified = null;
    row.contributed_by = [agent];
    row.licence = row.licence ?? "own-words";
    row.merged_from = [];
    row.updated = s.today;
    row.sources = [...new Set(ev.map((e) => ensureSource(file.doc, e)))].sort();
    applyFieldChanges(row, toFieldChanges(c, ev), file.doc, s.deps.rank);
    (file.doc[entity] as Row[]).push(row);
    return [s.note(entity, c.id, "add", null, row, c.reason, proposal.id, row.sources)];
  }

  // edit
  const { row, file } = s.find(entity, c.id);
  for (const [k, v] of Object.entries(c.before ?? {})) {
    if (!same(row[k] ?? null, v)) throw new OpError("E_STALE_CHANGE", `${entity} ${c.id}: ${k} is now ${JSON.stringify(row[k])} but the proposal expected ${JSON.stringify(v)}. The row changed since the proposal; re-run propose.`);
  }
  const old = clone(row);
  applyFieldChanges(row, toFieldChanges(c, ev), file.doc, s.deps.rank);
  row.sources = addUnique(row.sources, ...ev.map((e) => ensureSource(file.doc, e)));
  row.contributed_by = addUnique(row.contributed_by, agent);
  row.updated = s.today;
  const d = diffRow(old, row);
  return [s.note(entity, c.id, "edit", d.before, d.after, c.reason, proposal.id, row.sources)];
}

// ----------------------------------------------------------------------------- the promotion rule
/** why a row does not meet "two official sources from different hosts state every required fact" (empty = it does) */
export function promotionGaps(entity: Entity, row: Row, file: CatalogFile, policy: Row): string[] {
  const need: number = policy.promotion?.independent_official_sources ?? 2;
  const distinct: boolean = policy.promotion?.distinct_hosts ?? true;
  const srcRows = (file.doc.sources ?? []) as Row[];
  const out: string[] = [];
  const facts = REQUIRED[entity].filter((f) => !["area_id", "house_grade"].includes(f));
  for (const f of facts) {
    if (row[f] === null || row[f] === undefined || row[f] === "") {
      out.push(`${f} is missing`);
      continue;
    }
    const meta = row.field_meta?.[f];
    if (meta?.confidence === "conflict") {
      out.push(`${f} is in conflict`);
      continue;
    }
    const official = ((meta?.src ?? []) as string[]).map((id) => srcRows.find((r) => r.id === id)).filter((r): r is Row => !!r && r.kind === "official");
    const count = distinct ? new Set(official.map((r) => hostOf(r.url))).size : official.length;
    if (count < need) out.push(`${f} has ${count} official source${count === 1 ? "" : "s"} from ${distinct ? "different hosts" : "any host"}, needs ${need}`);
  }
  return out;
}

// ----------------------------------------------------------------------------- the runner
const fail = (code: string, message: string, extra: Partial<Failure> = {}): Failure => ({ ok: false, code, message, ...extra });

export async function runCatalogOp(store: Store, name: string, rawInput: unknown, opts: CatalogRunOptions = {}): Promise<RunResult> {
  const entry = OPS_BY_NAME.get(name);
  const handler = HANDLERS[name];
  if (!entry || !handler) return fail("E_UNKNOWN_OP", `no catalog operation "${name}".`);
  const parsed = entry.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const missingActor = issues.some((x) => x.path[0] === "actor");
    const shown = issues.slice(0, 8).map((x) => `${x.path.join(".") || "input"}: ${x.message}`).join("; ");
    return fail(missingActor ? "E_ACTOR" : "E_SCHEMA", missingActor ? `every write needs an actor, for example {"id": "u_owner", "via": "cli"}. ${shown}` : shown);
  }
  const input = parsed.data as Row;
  const clk = { ...clock(), ...(opts.now ? { now: opts.now, today: opts.today ?? opts.now.slice(0, 10) } : opts.today ? { today: opts.today } : {}) };
  const s = new Session(store, input.actor, clk.now, clk.today);
  try {
    await s.load();
    await handler(s, input);
    const { seq } = await s.commit();
    const out: CatalogWriteOk = {
      ok: true, changed: [...new Set(s.changed)], warnings: s.warnings, changelog_seq: seq, inverse: null, rev: null,
      ...(s.result !== undefined ? { result: s.result } : {}),
    };
    if (name === "catalog.apply" && s.result && Array.isArray((s.result as Row).applied)) {
      out.inverse = { name: "catalog.undo", input: { actor: input.actor, proposal_id: input.proposal_id, change_ids: (s.result as Row).applied } };
    }
    return out;
  } catch (e) {
    if (e instanceof OpError) return fail(e.code, e.message);
    if (e instanceof Error && e.name === "StaleError") return fail("E_STALE", e.message);
    throw e;
  }
}

export { ruleOn, countryOfArea, FILE_TABLES, isEntity };
