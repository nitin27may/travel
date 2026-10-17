// The operation runner (plan 5.1-5.3). runOp validates the input against the catalogue, loads the files the operation
// asks for, applies it, validates the result with the structural validator, runs the day checks, appends one changelog
// row, writes with the trip writer and returns the inverse that restores the previous bytes.
import { join } from "node:path";
import { OPS_BY_NAME } from "./catalogue.ts";
import { READ_HANDLERS } from "./reads.ts";
import { WRITE_OPS } from "./registry.ts";
import { OpError, Workspace, serializeFor, tripPath } from "./types.ts";
import type { Actor, OpContext, PlaceBackend, Row, WriteOp } from "./types.ts";
import { StaleError, toBytes, toText } from "../store/index.ts";
import type { Store } from "../store/index.ts";
import { validateDoc } from "../validate/index.ts";
import { fsCatalog } from "../checks/context.ts";

export interface Warning {
  code: string;
  message: string;
  where: string;
}

export interface Inverse {
  name: string;
  input: Record<string, unknown>;
}

export interface WriteOk {
  ok: true;
  changed: string[];
  warnings: Warning[];
  changelog_seq: number;
  inverse: Inverse | null;
  /** the trip file's rev after the write; pass it as expected_rev on the next call */
  rev: string | null;
  /** true when client_op_id matched an earlier row and nothing was written */
  replayed?: boolean;
}
export interface ReadOk {
  ok: true;
  result: unknown;
}
export interface Failure {
  ok: false;
  code: string;
  message: string;
  rev?: string | null;
  errors?: { code: string; path: string; message: string }[];
}
export type RunResult = WriteOk | ReadOk | Failure;

export interface RunOptions {
  /** ISO datetime with offset; defaults to the clock (TRAVEL_NOW pins it for reproducible runs) */
  now?: string;
  /** ISO date; defaults to the date of `now` (TRAVEL_TODAY pins it) */
  today?: string;
  backend?: PlaceBackend | null;
}

const fail = (code: string, message: string, extra: Partial<Failure> = {}): Failure => ({ ok: false, code, message, ...extra });

export function clock(env: Record<string, string | undefined> = process.env): { now: string; today: string } {
  const now = env.TRAVEL_NOW ?? new Date().toISOString().replace(/\.\d+Z$/, "Z");
  return { now, today: env.TRAVEL_TODAY ?? now.slice(0, 10) };
}

export const clientMarker = (id: string): string => `client_op_id:${id}`;

function parseInput(name: string, raw: unknown): { ok: true; data: Record<string, any> } | Failure {
  const entry = OPS_BY_NAME.get(name)!;
  const parsed = entry.input.safeParse(raw ?? {});
  if (parsed.success) return { ok: true, data: parsed.data as Record<string, any> };
  const issues = parsed.error.issues;
  const missingActor = issues.some((i) => i.path[0] === "actor");
  const shown = issues.slice(0, 8).map((i) => `${i.path.join(".") || "input"}: ${i.message}`);
  const message = shown.join("; ") + (issues.length > shown.length ? `; and ${issues.length - shown.length} more` : "");
  return fail(missingActor ? "E_ACTOR" : "E_SCHEMA", missingActor ? `every write needs an actor, for example {"id": "u_owner", "via": "cli"}. ${message}` : message);
}

function appendChangelog(doc: Row, ctx: OpContext, op: string, effect: { summary: string; refs: string[] }, clientOpId?: string): number {
  const log: Row[] = doc.changelog ?? (doc.changelog = []);
  const seq = log.reduce((m, r) => Math.max(m, Number(r.seq)), 0) + 1;
  log.push({
    seq, at: ctx.now, actor_id: ctx.actor.id, actor_via: ctx.actor.via, op, summary: effect.summary,
    refs: [...effect.refs, ...(clientOpId ? [clientMarker(clientOpId)] : [])],
  });
  doc.updated = ctx.today;
  return seq;
}

export async function runOp(store: Store, name: string, rawInput: unknown, opts: RunOptions = {}): Promise<RunResult> {
  const entry = OPS_BY_NAME.get(name);
  if (!entry) return fail("E_UNKNOWN_OP", `no operation "${name}". Run "node core/bin/ops.ts --list" for the names.`);
  const parsed = parseInput(name, rawInput);
  if (!parsed.ok) return parsed;
  const input = parsed.data;
  const { now, today } = { ...clock(), ...(opts.now ? { now: opts.now, today: opts.today ?? opts.now.slice(0, 10) } : opts.today ? { today: opts.today } : {}) };

  if (entry.kind === "read") {
    const handler = READ_HANDLERS[name];
    if (!handler) return fail("E_UNIMPLEMENTED", `the read operation "${name}" has no implementation yet.`);
    try {
      return { ok: true, result: await handler(input, { store, root: store.refRoot, today }) };
    } catch (e) {
      return fail(e instanceof OpError ? e.code : "E_READ", (e as Error).message);
    }
  }

  const impl = WRITE_OPS[name] as WriteOp | undefined;
  if (!impl) return fail("E_UNIMPLEMENTED", `the write operation "${name}" is in the catalogue but has no implementation yet.`);
  return runWrite(store, name, impl, input, { now, today }, opts.backend ?? null);
}

async function runWrite(store: Store, name: string, impl: WriteOp, input: Record<string, any>, clk: { now: string; today: string }, backend: PlaceBackend | null): Promise<RunResult> {
  const actor = input.actor as Actor;
  let slug: string;
  let prepared: string[] | null = null;
  try {
    if (impl.prepare) {
      const p = await impl.prepare(input, store);
      slug = p.slug;
      prepared = p.paths;
    } else slug = impl.slug ? impl.slug(input) : String(input.slug);
  } catch (e) {
    return fail(e instanceof OpError ? e.code : "E_SCHEMA", (e as Error).message);
  }
  const tp = tripPath(slug);

  // idempotent retry: the same client_op_id in this trip's changelog returns the earlier row
  const existingBytes = await store.read(tp);
  const existing: Row | null = existingBytes ? JSON.parse(toText(existingBytes)) : null;
  if (input.client_op_id && existing) {
    const marker = clientMarker(input.client_op_id);
    const hit = (existing.changelog ?? []).find((r: Row) => Array.isArray(r.refs) && r.refs.includes(marker));
    if (hit) {
      return {
        ok: true, replayed: true, changed: (hit.refs as string[]).filter((r) => r !== marker), warnings: [], changelog_seq: hit.seq, inverse: null,
        rev: await store.rev(tp),
      };
    }
  }
  // optimistic concurrency
  if (input.expected_rev !== undefined) {
    const cur = await store.rev(tp);
    if (String(input.expected_rev) !== (cur ?? "")) return fail("E_STALE", `${tp} changed since you read it; the current rev is ${cur ?? "none"}. Reload and retry.`, { rev: cur });
  }

  // load
  let extra: string[];
  try {
    extra = prepared ?? (impl.paths ? await impl.paths(input, store) : []);
  } catch (e) {
    return fail(e instanceof OpError ? e.code : "E_INTERNAL", (e as Error).message);
  }
  const loaded = new Map<string, string | null>();
  for (const p of new Set([tp, ...extra])) {
    const b = await store.read(p);
    loaded.set(p, b ? toText(b) : null);
  }
  const ws = new Workspace(loaded);

  // places go through the backend (pitfall 3)
  const ctx: OpContext = {
    actor, now: clk.now, today: clk.today, slug, places: new Map(), placeEdits: [], catalog: fsCatalog(store.refRoot), refFiles: new Map(),
    runInner: () => {
      throw new OpError("E_INTERNAL", "runInner is not set");
    },
  };
  for (const p of impl.refs ? impl.refs(input) : []) {
    if (!store.readRef) return fail("E_NO_REFS", `${name} reads files under research/, which this store cannot reach.`);
    ctx.refFiles.set(p, await store.readRef(p));
  }
  const wanted = impl.places ? impl.places(input) : [];
  if (wanted.length > 0) {
    if (!backend) return fail("E_NO_BACKEND", `${name} changes a place, and no place backend is configured. The CLI uses python3 tools/locations.py.`);
    for (const id of wanted) {
      const p = await backend.get(id);
      if (p) ctx.places.set(id, p);
    }
  }

  ctx.runInner = (innerName, innerRaw) => {
    const innerImpl = WRITE_OPS[innerName] as WriteOp | undefined;
    const e = OPS_BY_NAME.get(innerName);
    if (!innerImpl || !e || e.kind !== "write") throw new OpError("E_UNIMPLEMENTED", `the proposal names "${innerName}", which is not an implemented write operation.`);
    const inp = parseInput(innerName, { ...innerRaw, actor });
    if (!inp.ok) throw new OpError(inp.code, `${innerName}: ${inp.message}`);
    const innerSlug = innerImpl.slug ? innerImpl.slug(inp.data) : String(inp.data.slug);
    const innerCtx: OpContext = { ...ctx, slug: innerSlug };
    const eff = innerImpl.apply(ws, inp.data, innerCtx);
    let seq = 0;
    if (!innerImpl.noChangelog) seq = appendChangelog(ws.trip(innerSlug), innerCtx, innerName, eff);
    return { changed: eff.changed, changelog_seq: seq };
  };

  let effect;
  let seq = 0;
  try {
    effect = impl.apply(ws, input, ctx);
    if (!impl.noChangelog) seq = appendChangelog(ws.trip(slug), ctx, name, effect, input.client_op_id);
    else {
      const after = ws.textAfter(tp);
      seq = after ? Number((JSON.parse(after).changelog ?? []).reduce((m: number, r: Row) => Math.max(m, Number(r.seq)), 0)) : 0;
    }
  } catch (e) {
    if (e instanceof OpError) return fail(e.code, e.message);
    throw e;
  }

  // validate every trip that changed; any E_* aborts and nothing is written
  const dirty = ws.dirty();
  let warnings: Warning[] = [];
  const root = store.refRoot;
  for (const d of dirty) {
    const m = /^data\/trips\/([^/]+)\/trip\.json$/.exec(d.path);
    if (!m || d.after === null) continue;
    const res = validateDoc(JSON.parse(d.after), "trip", root, { folder: m[1] }, join(root, d.path));
    if (res.errors.length > 0) {
      const first = res.errors[0]!;
      return fail(first.code, `${name} would leave ${d.path} invalid: ${first.message}${res.errors.length > 1 ? ` (and ${res.errors.length - 1} more)` : ""}. Nothing was written.`, { errors: res.errors });
    }
    if (m[1] === slug) warnings = res.warnings.map((w) => ({ code: w.code, message: w.message, where: w.path }));
  }

  // place edits, then files (trip.json last, so a half-finished run leaves the old trip file)
  const prevPlaces: { id: string; status: string; trip: string | null }[] = [];
  try {
    for (const pe of ctx.placeEdits) {
      await backend!.edit(pe.id, { ...(pe.status !== undefined ? { status: pe.status } : {}), ...(pe.trip !== undefined ? { trip: pe.trip } : {}) });
      prevPlaces.push({ id: pe.id, ...pe.prev });
    }
    const order = [...dirty].sort((a, b) => Number(/trip\.json$/.test(a.path)) - Number(/trip\.json$/.test(b.path)) || a.path.localeCompare(b.path));
    for (const d of order) {
      if (d.after === null) await store.remove(d.path);
      else await store.write(d.path, toBytes(d.after), d.before === null ? null : await store.rev(d.path));
    }
  } catch (e) {
    if (e instanceof StaleError) return fail("E_STALE", e.message, { rev: e.rev });
    return fail("E_WRITE", (e as Error).message);
  }

  const inverse: Inverse | null = dirty.length === 0 && prevPlaces.length === 0 ? null : {
    name: "trip.restore",
    input: {
      actor, slug,
      files: dirty.map((d) => ({ path: d.path, content: d.before })),
      ...(prevPlaces.length > 0 ? { places: prevPlaces } : {}),
    },
  };
  return { ok: true, changed: effect.changed, warnings, changelog_seq: seq, inverse, rev: await store.rev(tp) };
}

export { serializeFor };
