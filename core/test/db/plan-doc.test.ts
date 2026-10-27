// planner_draft after migration 0013 `plan_doc` (EM-M; edit-my-trip.md 3, 4.1, 4.5) and core/src/db/plans.ts, against a real database.
// Runs only when TEST_DATABASE_URL points at a disposable database (the Docker one of `pnpm db:test`, a throwaway local Postgres, or
// the Neon child branch), never production:
//   TEST_DATABASE_URL="postgres://…" pnpm --dir core exec vitest run test/db/plan-doc.test.ts
// Owner-only RLS over the new columns, with mutation checks that prove each policy is what stops the leak; an unset user; the grants;
// the CHECKs; the revision and tombstone triggers; the 50 cap and its race; the purge; the module's put, delete, list and merge paths.
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PLAN_DOC_LIMITS, PLAN_SYNC } from "../../src/config/plans.ts";
import { closePools, getPool, withUserTransaction } from "../../src/db/index.ts";
import { deletePlan, getPlan, insertPlans, listPlans, mergeKeys, PLAN_CAP_SQLSTATE, putPlan, type PlanWrite } from "../../src/db/plans.ts";
import { migrate } from "../../src/db/runner.ts";
import { planRowFields } from "../../src/plan/doc.ts";
import { parseAccountPlanList, PLAN_DOC_MIGRATION } from "../../src/schema/api/account-plans.ts";
import type { PlanDraft } from "../../src/schema/plan-draft.ts";
import { templateDraft } from "../plan/doc-helpers.ts";

const url = process.env.TEST_DATABASE_URL;
const run = describe.skipIf(!url);
const tag = randomBytes(4).toString("hex");
const U = (n: string) => `itest-pd-${tag}-${n}`;

/** A template draft of its own id. */
const tmpl = (id: string = randomUUID(), over: Partial<PlanDraft> = {}): PlanDraft => templateDraft({ id, ...over } as never);
/** The columns a write stores, derived as the route derives them. */
const w = (doc: PlanDraft, title = "Dolomites"): PlanWrite => ({ ...planRowFields(doc), title, doc });

run("planner_draft with plan_doc (database)", () => {
  let admin: any;

  beforeAll(async () => {
    process.env.DATABASE_URL = url; // withUserTransaction pools against this
    const pgSpec = "pg";
    const { Client } = (await import(pgSpec)) as any;
    admin = new Client({ connectionString: url });
    await admin.connect();
    await migrate(admin);
  }, 120000);

  afterAll(async () => {
    if (admin) {
      await admin.query("delete from planner_draft where user_id like $1", [`itest-pd-${tag}-%`]).catch(() => {});
      await admin.query("delete from planner_draft_signal where user_id like $1", [`itest-pd-${tag}-%`]).catch(() => {});
      await admin.end();
    }
    await closePools();
  });

  /** As the owner (RLS bypassed): a raw row write, so the CHECKs and triggers are tested without the module. */
  const raw = (sql: string, params: unknown[] = []) => admin.query(sql, params);
  const rawInsert = (user: string, id: string, cols: Record<string, unknown>) => {
    const names = Object.keys(cols);
    return raw(
      `insert into planner_draft (id, user_id, title${names.map((n) => `, ${n}`).join("")}) values ($1, $2, 'T'${names.map((_, i) => `, $${i + 3}`).join("")})`,
      [id, user, ...names.map((n) => (n === "doc" && cols[n] !== null ? JSON.stringify(cols[n]) : cols[n]))],
    );
  };

  /** One transaction as the app role for `user`, after `before` ran as the owner in the same transaction; always rolled back. */
  async function rolledBack<T>(user: string | null, before: string[], fn: () => Promise<T>): Promise<T> {
    await admin.query("begin");
    try {
      for (const s of before) await admin.query(s);
      await admin.query('set local role "travel_app"');
      if (user !== null) await admin.query("select set_config('app.user_id', $1, true)", [user]);
      return await fn();
    } finally {
      await admin.query("rollback");
    }
  }

  it("adds the columns of PLAN_DOC_MIGRATION, with their types, nullability and defaults", async () => {
    const { rows } = await raw(
      `select column_name, data_type, is_nullable, column_default from information_schema.columns
        where table_schema = 'public' and table_name = 'planner_draft' order by ordinal_position`,
    );
    const by = new Map(rows.map((r: any) => [r.column_name, r]));
    const pgType: Record<string, string> = { jsonb: "jsonb", text: "text", date: "date", int: "integer", bigint: "bigint", timestamptz: "timestamp with time zone" };
    for (const c of PLAN_DOC_MIGRATION.columns) {
      const r: any = by.get(c.name);
      expect(r, c.name).toBeDefined();
      expect(r.data_type, c.name).toBe(pgType[c.type]);
      expect(r.is_nullable, c.name).toBe(c.nullable ? "YES" : "NO");
      if ("default" in c) expect(String(r.column_default), c.name).toBe(c.default);
    }
    // 0009's columns are unchanged
    expect([...by.keys()].slice(0, 5)).toEqual(["id", "user_id", "title", "created_at", "updated_at"]);
  });

  it("keeps RLS on, the same four owner policies, grants to travel_app only, and the purge closed to the app role", async () => {
    const rls = await raw("select rowsecurity from pg_tables where schemaname='public' and tablename='planner_draft'");
    expect(rls.rows[0]?.rowsecurity).toBe(true);
    const pol = await raw("select policyname, cmd, qual, with_check from pg_policies where schemaname='public' and tablename='planner_draft' order by policyname");
    expect(pol.rows.map((p: any) => [p.policyname, p.cmd])).toEqual([
      ["planner_draft_delete", "DELETE"],
      ["planner_draft_insert", "INSERT"],
      ["planner_draft_select", "SELECT"],
      ["planner_draft_update", "UPDATE"],
    ]);
    for (const p of pol.rows) for (const e of [p.qual, p.with_check]) if (e !== null) expect(e).toMatch(/user_id = app_current_user_id\(\)/);
    const grants = await raw(
      "select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='planner_draft' and grantee <> current_user order by 1, 2",
    );
    expect(grants.rows).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"].map((p) => ({ grantee: "travel_app", privilege_type: p })));
    const exec = await raw("select has_function_privilege('travel_app', 'planner_draft_purge(integer)', 'execute') as app, has_function_privilege('public', 'planner_draft_purge(integer)', 'execute') as pub");
    expect(exec.rows[0]).toEqual({ app: false, pub: false });
    await expect(rolledBack(U("x"), [], () => admin.query("select planner_draft_purge(30)"))).rejects.toMatchObject({ code: "42501" });
  });

  it("isolates every new column per user: B cannot list, read, write, take over or remove A's plan", async () => {
    const a = U("a");
    const b = U("b");
    const doc = tmpl();
    const id = doc.id;
    expect(await putPlan(a, id, null, false, w(doc))).toEqual({ kind: "written", revision: 0, created: true });

    expect(await listPlans(b)).toEqual([]);
    expect(await getPlan(b, id)).toBeNull();
    expect(await putPlan(b, id, null, false, w(doc))).toEqual({ kind: "not-found" });
    expect(await putPlan(b, id, 0, false, w(doc))).toEqual({ kind: "not-found" });
    expect(await putPlan(b, id, 0, true, w(doc))).toEqual({ kind: "not-found" });
    expect(await deletePlan(b, id, 0)).toEqual({ kind: "not-found" });
    expect(await mergeKeys(b, [{ trip: "dolomites-2027", start: "2027-07-03" }])).toEqual([]);
    expect(await insertPlans(b, [{ id, ...w(doc) }])).toEqual({ inserted: [], already: [], overCap: [], refused: [id] });

    const sel = await withUserTransaction(b, async (ctx) => (await ctx.query("select doc, kind, source_trip, start, days, revision, deleted_at from planner_draft")).rows);
    expect(sel.result).toEqual([]);
    // no WHERE, so only the UPDATE and DELETE policies apply (a WHERE would add the SELECT policy and could mask a weakened one)
    const upd = await withUserTransaction(b, async (ctx) => (await ctx.query("update planner_draft set doc = null, kind = null, source_trip = null, deleted_at = now()")).rowCount);
    expect(upd.result).toBe(0);
    const del = await withUserTransaction(b, async (ctx) => (await ctx.query("delete from planner_draft")).rowCount);
    expect(del.result).toBe(0);
    // B cannot plant a row for A (WITH CHECK), nor move its own row onto A
    const bDoc = tmpl();
    await expect(withUserTransaction(b, (ctx) => ctx.query("insert into planner_draft (id, user_id, title) values ($1, $2, 'x')", [bDoc.id, a]))).rejects.toMatchObject({ code: "42501" });
    await putPlan(b, bDoc.id, null, false, w(bDoc));
    await expect(withUserTransaction(b, (ctx) => ctx.query("update planner_draft set user_id = $1", [a]))).rejects.toMatchObject({ code: "42501" });

    const mine = await getPlan(a, id);
    expect(mine).toEqual({ revision: 0, doc: JSON.parse(JSON.stringify(doc)) });
  });

  // Mutation checks: each policy, weakened inside a rolled-back transaction, lets B reach A's row. So the isolation test above fails
  // if a later migration weakens a policy (it is the policy, not the module's WHERE clause, that stops the leak).
  describe("mutation checks on the four policies", () => {
    let a: string;
    let b: string;
    let id: string;
    beforeAll(async () => {
      a = U("ma");
      b = U("mb");
      const doc = tmpl();
      id = doc.id;
      await putPlan(a, id, null, false, w(doc));
    });

    it("select: B reads A's document only when the SELECT policy is weakened", async () => {
      const q = () => admin.query("select doc->>'start' as start from planner_draft where id = $1", [id]).then((r: any) => r.rows);
      expect(await rolledBack(b, [], q)).toEqual([]);
      expect(await rolledBack(b, ["alter policy planner_draft_select on planner_draft using (true)"], q)).toEqual([{ start: "2027-07-03" }]);
    });

    it("update: B changes A's row only when the UPDATE policy is weakened", async () => {
      const q = () => admin.query("update planner_draft set title = 'pwned'").then((r: any) => r.rowCount);
      expect(await rolledBack(b, [], q)).toBe(0);
      expect(await rolledBack(b, ["alter policy planner_draft_update on planner_draft using (true) with check (true)"], q)).toBeGreaterThan(0);
    });

    it("delete: B removes A's row only when the DELETE policy is weakened", async () => {
      const q = () => admin.query("delete from planner_draft").then((r: any) => r.rowCount);
      expect(await rolledBack(b, [], q)).toBe(0);
      expect(await rolledBack(b, ["alter policy planner_draft_delete on planner_draft using (true)"], q)).toBeGreaterThan(0);
    });

    it("insert: B plants a row for A only when the INSERT policy is weakened", async () => {
      const q = () => admin.query("insert into planner_draft (id, user_id, title) values ($1, $2, 'planted')", [randomUUID(), a]).then((r: any) => r.rowCount);
      await expect(rolledBack(b, [], q)).rejects.toMatchObject({ code: "42501" });
      expect(await rolledBack(b, ["alter policy planner_draft_insert on planner_draft with check (true)"], q)).toBe(1);
    });

    it("A's row is intact after every rolled-back mutation", async () => {
      expect((await getPlan(a, id))?.revision).toBe(0);
    });
  });

  it("shows an unset user nothing and lets it write nothing", async () => {
    const doc = tmpl();
    await putPlan(U("c"), doc.id, null, false, w(doc));
    expect(await rolledBack(null, [], () => admin.query("select * from planner_draft").then((r: any) => r.rows))).toEqual([]);
    await expect(rolledBack(null, [], () => admin.query("insert into planner_draft (id, user_id, title) values ($1, $2, 'x')", [randomUUID(), U("c")]))).rejects.toMatchObject({ code: "42501" });
    expect(await rolledBack(null, [], () => admin.query("update planner_draft set doc = null").then((r: any) => r.rowCount))).toBe(0);
  });

  describe("the CHECKs refuse what the route would never write", () => {
    const user = U("chk");
    const good = () => {
      const d = tmpl();
      return { d, cols: { doc: d, kind: "template", source_trip: "dolomites-2027", start: "2027-07-03", days: 14 } };
    };

    it("accepts a template row, a built row and a titled row with no document", async () => {
      const { d, cols } = good();
      await rawInsert(user, d.id, cols);
      const built = tmpl();
      const { template: _t, start: _s, travellers: _tr, ...rest } = built as any;
      await rawInsert(user, built.id, { doc: { ...rest, party: "device" }, kind: "built", source_trip: null });
      await rawInsert(user, randomUUID(), {});
    });

    it.each([
      ["a document that is not an object", (c: any) => ({ ...c, doc: [1, 2] })],
      ["another schema name", (c: any) => ({ ...c, doc: { ...c.doc, schema: "trip-custom/1" } })],
      ["a schema that is not a string", (c: any) => ({ ...c, doc: { ...c.doc, schema: 1 } })],
      ["no id in the document", (c: any) => ({ ...c, doc: { ...c.doc, id: undefined } })],
      ["the document of another row", (c: any) => ({ ...c, doc: { ...c.doc, id: randomUUID() } })],
      ["a document over 24 KB", (c: any) => ({ ...c, doc: { ...c.doc, pad: "x".repeat(25000) } })],
      ["an unknown kind", (c: any) => ({ ...c, kind: "draft" })],
      ["a document without a kind", (c: any) => ({ ...c, kind: null })],
      ["a kind without a document", (c: any) => ({ ...c, doc: null })],
      ["a template without its trip", (c: any) => ({ ...c, source_trip: null })],
      ["a trip that is not the document's", (c: any) => ({ ...c, source_trip: "canadian-rockies-2029" })],
      ["a built kind on a template document", (c: any) => ({ ...c, kind: "built", source_trip: null })],
      ["a slug that is not a slug", (c: any) => ({ ...c, source_trip: "Dolomites 2027" })],
      ["zero days", (c: any) => ({ ...c, days: 0 })],
      ["100 days", (c: any) => ({ ...c, days: 100 })],
    ])("refuses %s (23514)", async (_name, change) => {
      const { d, cols } = good();
      const c = change(cols);
      if (c.doc && typeof c.doc === "object" && !Array.isArray(c.doc) && c.doc.id === undefined) delete c.doc.id;
      await expect(rawInsert(user, d.id, c)).rejects.toMatchObject({ code: "23514" });
    });
  });

  it("owns the revision and the tombstone on insert and update, whatever a caller sends", async () => {
    const user = U("rev");
    const d = tmpl();
    await rawInsert(user, d.id, { doc: d, kind: "template", source_trip: "dolomites-2027", revision: 7, deleted_at: "2020-01-01T00:00:00Z" });
    const first = await raw("select revision, deleted_at, created_at from planner_draft where id = $1", [d.id]);
    expect(Number(first.rows[0].revision)).toBe(0);
    expect(first.rows[0].deleted_at).toBeNull();
    await raw("update planner_draft set revision = 100, created_at = '2000-01-01' where id = $1", [d.id]);
    await raw("update planner_draft set title = 'Renamed' where id = $1", [d.id]);
    const after = await raw("select revision, created_at from planner_draft where id = $1", [d.id]);
    expect(Number(after.rows[0].revision)).toBe(2);
    expect(after.rows[0].created_at.toISOString()).toBe(first.rows[0].created_at.toISOString());
  });

  it("puts, conflicts, tombstones, lists and restores through the module", async () => {
    const user = U("flow");
    const d = tmpl();
    expect(await putPlan(user, d.id, null, false, w(d))).toEqual({ kind: "written", revision: 0, created: true });
    // a create of an id the caller holds: the row comes back as a conflict
    const again = await putPlan(user, d.id, null, false, w(d));
    expect(again.kind).toBe("conflict");

    const moved = tmpl(d.id, { start: "2027-07-10" } as never);
    expect(await putPlan(user, d.id, 0, false, w(moved))).toEqual({ kind: "written", revision: 1, created: false });
    const stale = await putPlan(user, d.id, 0, false, w(d));
    expect(stale).toMatchObject({ kind: "conflict", row: { revision: 1, deleted_at: null } });
    expect(stale.kind === "conflict" && (stale.row.doc as PlanDraft).start).toBe("2027-07-10");
    expect(await getPlan(user, d.id)).toMatchObject({ revision: 1 });

    const list1 = await listPlans(user);
    expect(parseAccountPlanList({ items: list1 }).success).toBe(true);
    expect(list1).toEqual([expect.objectContaining({ id: d.id, title: "Dolomites", kind: "template", source_trip: "dolomites-2027", start: "2027-07-10", days: 14, revision: 1, deleted_at: null })]);
    expect(JSON.stringify(list1)).not.toContain("travellers");

    expect(await deletePlan(user, d.id, 0)).toMatchObject({ kind: "conflict", row: { revision: 1 } });
    expect(await deletePlan(user, d.id, 1)).toEqual({ kind: "deleted", revision: 2 });
    expect(await deletePlan(user, d.id, 1)).toEqual({ kind: "already", revision: 2 });
    expect(await getPlan(user, d.id)).toBeNull();
    // the tombstone keeps its id and title only: the document and the household columns are gone
    const tomb = await raw("select doc, kind, source_trip, start, days, deleted_at from planner_draft where id = $1", [d.id]);
    expect(tomb.rows[0]).toMatchObject({ doc: null, kind: null, source_trip: null, start: null, days: null });
    expect(tomb.rows[0].deleted_at).not.toBeNull();
    const list2 = await listPlans(user);
    expect(parseAccountPlanList({ items: list2 }).success).toBe(true);
    expect(list2[0]).toMatchObject({ id: d.id, title: "Dolomites", kind: null, start: null, revision: 2 });
    expect(list2[0]?.deleted_at).not.toBeNull();

    // an edit from a device that missed the removal learns of it, with no document
    expect(await putPlan(user, d.id, 2, false, w(d))).toMatchObject({ kind: "conflict", row: { revision: 2, doc: null } });
    // Undo: restore with the tombstone's revision
    expect(await putPlan(user, d.id, 2, true, w(d))).toEqual({ kind: "written", revision: 3, created: false });
    expect(await getPlan(user, d.id)).toMatchObject({ revision: 3 });
  });

  describe("the cap (50 live rows per user)", () => {
    const user = U("cap");
    const ids: string[] = [];

    beforeAll(async () => {
      for (let i = 0; i < PLAN_DOC_LIMITS.accountPlans; i++) {
        const d = tmpl();
        ids.push(d.id);
        await rawInsert(user, d.id, { doc: d, kind: "template", source_trip: "dolomites-2027" });
      }
    }, 60000);

    it("refuses the 51st with TP001, through the module as `cap`, a titled draft included; another user is not affected", async () => {
      const d = tmpl();
      expect(await putPlan(user, d.id, null, false, w(d))).toEqual({ kind: "cap" });
      await expect(withUserTransaction(user, (ctx) => ctx.query("insert into planner_draft (id, user_id, title) values ($1, $2, 'x')", [randomUUID(), user]))).rejects.toMatchObject({ code: PLAN_CAP_SQLSTATE });
      const other = tmpl();
      expect((await putPlan(U("cap-other"), other.id, null, false, w(other))).kind).toBe("written");
    });

    it("counts live rows only: a tombstone frees a place, and a restore at the cap is refused", async () => {
      const gone = ids[0]!;
      expect((await deletePlan(user, gone, 0)).kind).toBe("deleted");
      const d = tmpl();
      expect((await putPlan(user, d.id, null, false, w(d))).kind).toBe("written");
      const back = tmpl(gone);
      expect(await putPlan(user, gone, 1, true, w(back))).toEqual({ kind: "cap" });
      // an update of a live row at the cap is not a new row
      const live = tmpl(ids[1]!, { start: "2027-08-01" } as never);
      expect((await putPlan(user, ids[1]!, 0, false, w(live))).kind).toBe("written");
    });

    it("merge inserts stop at the cap row by row, keeping the rows before it", async () => {
      const u = U("cap-merge");
      for (let i = 0; i < PLAN_DOC_LIMITS.accountPlans - 1; i++) {
        const d = tmpl();
        await rawInsert(u, d.id, { doc: d, kind: "template", source_trip: "dolomites-2027" });
      }
      const x = tmpl();
      const y = tmpl();
      const r = await insertPlans(u, [{ id: x.id, ...w(x) }, { id: y.id, ...w(y) }]);
      expect(r).toEqual({ inserted: [x.id], already: [], overCap: [y.id], refused: [] });
      expect(await getPlan(u, x.id)).not.toBeNull();
    }, 60000);

    it("serialises two racing creates at 49: exactly one wins (NAV-D's race, kept)", async () => {
      const u = U("race");
      for (let i = 0; i < PLAN_DOC_LIMITS.accountPlans - 1; i++) {
        const d = tmpl();
        await rawInsert(u, d.id, { doc: d, kind: "template", source_trip: "dolomites-2027" });
      }
      const first = tmpl();
      const second = tmpl();
      // the first holds its transaction open after its insert; the second starts inside that window
      const slow = withUserTransaction(u, async (ctx) => {
        await ctx.query(`insert into planner_draft (id, user_id, title) values ($1, $2, 'first')`, [first.id, u]);
        await ctx.query("select pg_sleep(0.6)");
      });
      await new Promise((r) => setTimeout(r, 150));
      const fast = putPlan(u, second.id, null, false, w(second));
      const [s, f] = await Promise.allSettled([slow, fast]);
      expect(s.status).toBe("fulfilled");
      expect(f.status === "fulfilled" && f.value).toEqual({ kind: "cap" });
      const n = await raw("select count(*)::int as n from planner_draft where user_id = $1 and deleted_at is null", [u]);
      expect(n.rows[0].n).toBe(PLAN_DOC_LIMITS.accountPlans);
    }, 60000);
  });

  it("purges tombstones after the retention: hidden from the list, dropped by the caller's next write, and by the owner's job", async () => {
    const user = U("purge");
    const other = U("purge-other");
    const old = tmpl();
    const keep = tmpl();
    const theirs = tmpl();
    for (const [u, d] of [[user, old], [user, keep], [other, theirs]] as const) {
      await putPlan(u, d.id, null, false, w(d));
      await deletePlan(u, d.id, 0);
    }
    const days = PLAN_SYNC.tombstoneDays;
    await raw(`update planner_draft set deleted_at = now() - make_interval(days => $2::int + 1) where id = any($1::uuid[])`, [[old.id, theirs.id], days]);

    expect((await listPlans(user)).map((r) => r.id)).toEqual([keep.id]);
    const next = tmpl();
    await putPlan(user, next.id, null, false, w(next));
    expect((await raw("select 1 from planner_draft where id = $1", [old.id])).rows).toEqual([]);
    expect((await raw("select 1 from planner_draft where id = $1", [keep.id])).rows).toHaveLength(1);
    // the caller's write purged only its own rows
    expect((await raw("select 1 from planner_draft where id = $1", [theirs.id])).rows).toHaveLength(1);
    const purged = await raw("select planner_draft_purge($1) as n", [days]);
    expect(purged.rows[0].n).toBeGreaterThanOrEqual(1);
    expect((await raw("select 1 from planner_draft where id = $1", [theirs.id])).rows).toEqual([]);
  });

  it("merge: the keys carry a document only for a matching trip and start; inserts are idempotent and never take another user's id", async () => {
    const user = U("merge");
    const match = tmpl();
    const other = tmpl(randomUUID(), { start: "2027-09-01", month: 9 } as never);
    await putPlan(user, match.id, null, false, w(match));
    await putPlan(user, other.id, null, false, w(other));
    const keys = await mergeKeys(user, [{ trip: "dolomites-2027", start: "2027-07-03" }]);
    const by = new Map(keys.map((k) => [k.id, k]));
    expect(by.get(match.id)).toMatchObject({ source_trip: "dolomites-2027", start: "2027-07-03" });
    expect(by.get(match.id)?.doc).not.toBeNull();
    expect(by.get(other.id)?.doc).toBeNull();

    const fresh = tmpl();
    const theirs = tmpl();
    await putPlan(U("merge-other"), theirs.id, null, false, w(theirs));
    const tomb = tmpl();
    await putPlan(user, tomb.id, null, false, w(tomb));
    await deletePlan(user, tomb.id, 0);
    const r = await insertPlans(user, [fresh, match, theirs, tomb].map((d) => ({ id: d.id, ...w(d) })));
    expect(r).toEqual({ inserted: [fresh.id], already: [match.id, tomb.id], overCap: [], refused: [theirs.id] });
    const again = await insertPlans(user, [{ id: fresh.id, ...w(fresh) }]);
    expect(again).toEqual({ inserted: [], already: [fresh.id], overCap: [], refused: [] });
    // the other user's row is untouched
    expect((await raw("select user_id from planner_draft where id = $1", [theirs.id])).rows[0].user_id).toBe(U("merge-other"));
  });

  it("keeps the content-free signal firing on a plan write, with its three columns only", async () => {
    const user = U("sig");
    const d = tmpl();
    await putPlan(user, d.id, null, false, w(d));
    const s1 = await raw("select * from planner_draft_signal where user_id = $1", [user]);
    expect(Object.keys(s1.rows[0]).sort()).toEqual(["changed_at", "user_id", "version"]);
    await deletePlan(user, d.id, 0);
    const s2 = await raw("select version from planner_draft_signal where user_id = $1", [user]);
    expect(Number(s2.rows[0].version)).toBeGreaterThan(Number(s1.rows[0].version));
  });

  it("has the list, merge and purge indexes", async () => {
    const { rows } = await raw("select indexname from pg_indexes where schemaname='public' and tablename='planner_draft'");
    const names = rows.map((r: any) => r.indexname);
    expect(names).toEqual(expect.arrayContaining(["planner_draft_user_live", "planner_draft_user_trip_start", "planner_draft_tombstones"]));
  });

  it("pools: the module's transactions run as travel_app, never as the owner", async () => {
    const pool = await getPool(url);
    const c = await pool.connect();
    c.release();
    const r = await withUserTransaction(U("who"), async (ctx) => (await ctx.query<{ r: string }>("select current_user as r")).rows[0]!.r);
    expect(r.result).toBe("travel_app");
  });
});
