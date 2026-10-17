// Proposals (plan 5.4): an ordered list of changes, each one operation with its input, a summary and provenance. They are
// stored at data/trips/<slug>/proposals/<id>.json; applying runs the listed operations in order inside one workspace, so a
// failure in any of them writes nothing.
import { z } from "zod";
import { OpError } from "./types.ts";
import type { Row, WriteOp } from "./types.ts";

export const proposalChange = z.strictObject({
  id: z.string().min(1),
  op: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  summary: z.string(),
  status: z.enum(["open", "applied", "rejected"]),
  provenance: z.strictObject({ research_ref: z.string().nullable(), src: z.array(z.string()), fact_keys: z.array(z.string()) }).optional(),
});

export const proposalDoc = z.strictObject({
  schema: z.literal("proposal/1"),
  id: z.string().min(1),
  slug: z.string().min(1),
  created: z.string(),
  source: z.string(),
  status: z.enum(["open", "partial", "applied", "rejected"]),
  changes: z.array(proposalChange),
});

export const proposalPath = (slug: string, id: string): string => `data/trips/${slug}/proposals/${id}.json`;

async function locate(id: string, store: { list(prefix: string): Promise<string[]> }): Promise<{ slug: string; path: string }> {
  const hits = (await store.list("data/trips/")).map((p) => ({ p, m: /^data\/trips\/([^/]+)\/proposals\/([^/]+)\.json$/.exec(p) })).filter((x) => x.m && x.m[2] === id);
  if (hits.length === 0) throw new OpError("E_NOT_FOUND", `no proposal "${id}". Proposals live in data/trips/<slug>/proposals/.`);
  if (hits.length > 1) throw new OpError("E_AMBIGUOUS", `proposal id "${id}" exists in ${hits.map((h) => h.m![1]).join(", ")}; proposal ids must be unique.`);
  return { slug: hits[0]!.m![1]!, path: hits[0]!.p };
}

function chosen(doc: Row, ids: string[] | undefined): Row[] {
  const changes = doc.changes as Row[];
  if (!ids) return changes.filter((c) => c.status === "open");
  const unknown = ids.filter((x) => !changes.some((c) => c.id === x));
  if (unknown.length) throw new OpError("E_NOT_FOUND", `proposal ${doc.id} has no change ${unknown.join(", ")}. Its changes are ${changes.map((c) => c.id).join(", ")}.`);
  return changes.filter((c) => ids.includes(c.id) && c.status === "open");
}

function settle(doc: Row): void {
  const st = (doc.changes as Row[]).map((c) => c.status);
  doc.status = st.every((s) => s === "open") ? "open" : st.every((s) => s === "rejected") ? "rejected" : st.every((s) => s !== "open") ? "applied" : "partial";
}

export function makeProposalOps(registry: () => Record<string, WriteOp>): Record<string, WriteOp> {
  return {
    "proposal.apply": {
      async prepare(i, store) {
        const { slug, path } = await locate(i.proposal_id, store);
        const bytes = await store.read(path);
        const doc = JSON.parse(new TextDecoder().decode(bytes!));
        const parsed = proposalDoc.safeParse(doc);
        if (!parsed.success) throw new OpError("E_SCHEMA", `${path} is not a valid proposal: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
        const paths = new Set<string>([path]);
        for (const c of chosen(doc, i.change_ids)) {
          const impl = registry()[c.op];
          if (!impl) throw new OpError("E_UNIMPLEMENTED", `change ${c.id} names "${c.op}", which is not an implemented write operation.`);
          const inp = { slug, actor: i.actor, ...c.input };
          for (const p of impl.paths ? await impl.paths(inp, store) : []) paths.add(p);
        }
        return { slug, paths: [...paths] };
      },
      apply(ws, i, ctx) {
        const path = proposalPath(ctx.slug, i.proposal_id);
        const doc = ws.get(path);
        if (!doc) throw new OpError("E_NOT_FOUND", `no proposal "${i.proposal_id}".`);
        const todo = chosen(doc, i.change_ids);
        if (todo.length === 0) throw new OpError("E_NOOP", `proposal ${i.proposal_id} has no open change to apply${i.change_ids ? " among those named" : ""}.`);
        const changed: string[] = [];
        for (const c of todo) {
          try {
            changed.push(...ctx.runInner(c.op, { slug: ctx.slug, ...c.input }).changed);
          } catch (e) {
            if (e instanceof OpError) throw new OpError(e.code, `change ${c.id} (${c.op}) failed: ${e.message} Nothing was applied.`);
            throw e;
          }
          c.status = "applied";
        }
        settle(doc);
        return { changed, summary: `Applied ${todo.length} change(s) of proposal ${i.proposal_id}: ${todo.map((c) => c.id).join(", ")}`, refs: [i.proposal_id] };
      },
    },

    "proposal.reject": {
      async prepare(i, store) {
        const { slug, path } = await locate(i.proposal_id, store);
        return { slug, paths: [path] };
      },
      apply(ws, i, ctx) {
        const doc = ws.get(proposalPath(ctx.slug, i.proposal_id));
        const todo = chosen(doc, i.change_ids);
        if (todo.length === 0) throw new OpError("E_NOOP", `proposal ${i.proposal_id} has no open change to reject${i.change_ids ? " among those named" : ""}.`);
        for (const c of todo) c.status = "rejected";
        settle(doc);
        return { changed: todo.map((c) => c.id), summary: `Rejected ${todo.length} change(s) of proposal ${i.proposal_id}`, refs: [i.proposal_id] };
      },
    },
  };
}
