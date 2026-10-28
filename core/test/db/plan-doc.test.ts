// plan_draft after migration 0013 `plan_doc` (EM-M; edit-my-trip.md 3, 4.1, 4.5) and core/src/db/plans.ts, against a real database.
// Runs only when TEST_DATABASE_URL points at a disposable database (the Docker one of `pnpm db:test`, a throwaway local Postgres, or
// the Neon child branch), never production:
//   TEST_DATABASE_URL="postgres://…" pnpm --dir core exec vitest run test/db/plan-doc.test.ts
// Owner-only RLS over the new columns, with mutation checks that prove each policy is what stops the leak; an unset user; the grants;
// the CHECKs; the revision and tombstone triggers; the 50 cap and its race; the purge; the module's put, delete, list and merge paths.
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PLAN_DOC_LIMITS, PLAN_SYNC } from "../../src/config/plans.ts";
import { closePools, draftsReadQuery, getPool, legacyDraftRow, USER_TX_TIMEOUTS, withUserTransaction } from "../../src/db/index.ts";
import { deletePlan, deletePlans, getPlan, purgeAllTombstones, insertPlans, listPlans, mergeKeys, PLAN_CAP_SQLSTATE, putPlan, type PlanWrite } from "../../src/db/plans.ts";
import { migrate } from "../../src/db/runner.ts";
import { planRowFields } from "../../src/plan/doc.ts";
import { ACCOUNT_PLANS_LIMITS, diffPlanList, parseAccountPlanList, PLAN_DOC_MIGRATION } from "../../src/schema/api/account-plans.ts";
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

run("plan_draft with plan_doc (database)", () => {
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
      await admin.query("delete from plan_draft where user_id like $1", [`itest-pd-${tag}-%`]).catch(() => {});
      await admin.query("delete from plan_draft_signal where user_id like $1", [`itest-pd-${tag}-%`]).catch(() => {});
      await admin.end();
    }
    await closePools();
  });

  /** As the owner (RLS bypassed): a raw row write, so the CHECKs and triggers are tested without the module. */
  const raw = (sql: string, params: unknown[] = []) => admin.query(sql, params);
  const rawInsert = (user: string, id: string, given: Record<string, unknown>) => {
    // the start column is the document's start (CHECK plan_draft_start_of_doc), as the route derives it
    const d = given.doc as { start?: unknown } | null | undefined;
    const cols = d && typeof d === "object" && !Array.isArray(d) && !("start" in given) ? { ...given, start: d.start ?? null } : given;
    const names = Object.keys(cols);
    return raw(
      `insert into plan_draft (id, user_id, title${names.map((n) => `, ${n}`).join("")}) values ($1, $2, 'T'${names.map((_, i) => `, $${i + 3}`).join("")})`,
      [id, user, ...names.map((n) => (n === "doc" && cols[n] !== null ? JSON.stringify(cols[n]) : cols[n]))],
    );
  };

  /** Backdate tombstones as the owner: the revision trigger pins deleted_at (S2), so only with it off, inside one transaction. */
  async function backdate(ids: string[], days: number): Promise<void> {
    await admin.query("begin");
    try {
      await admin.query("alter table plan_draft disable trigger plan_draft_revision_t");
      await admin.query(`update plan_draft set deleted_at = now() - make_interval(days => $2::int) where id = any($1::uuid[])`, [ids, days]);
      await admin.query("alter table plan_draft enable trigger plan_draft_revision_t");
      await admin.query("commit");
    } catch (e) {
      await admin.query("rollback");
      throw e;
    }
  }

  /** `ids` as title-only tombstones of `user`, as the owner, 40 at a time (the cap counts live rows on insert). */
  async function tombstones(user: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += 40) {
      const part = ids.slice(i, i + 40);
      await raw(`insert into plan_draft (id, user_id, title) select x, $2, 'Gone' from unnest($1::uuid[]) as x`, [part, user]);
      await raw("update plan_draft set deleted_at = now() where user_id = $1 and id = any($2::uuid[])", [user, part]);
    }
  }

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
        where table_schema = 'public' and table_name = 'plan_draft' order by ordinal_position`,
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
    const rls = await raw("select rowsecurity from pg_tables where schemaname='public' and tablename='plan_draft'");
    expect(rls.rows[0]?.rowsecurity).toBe(true);
    const pol = await raw("select policyname, cmd, qual, with_check from pg_policies where schemaname='public' and tablename='plan_draft' order by policyname");
    expect(pol.rows.map((p: any) => [p.policyname, p.cmd])).toEqual([
      ["plan_draft_delete", "DELETE"],
      ["plan_draft_insert", "INSERT"],
      ["plan_draft_select", "SELECT"],
      ["plan_draft_update", "UPDATE"],
    ]);
    for (const p of pol.rows) for (const e of [p.qual, p.with_check]) if (e !== null) expect(e).toMatch(/user_id = app_current_user_id\(\)/);
    const grants = await raw(
      "select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='plan_draft' and grantee <> current_user order by 1, 2",
    );
    expect(grants.rows).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"].map((p) => ({ grantee: "travel_app", privilege_type: p })));
    const exec = await raw("select has_function_privilege('travel_app', 'plan_draft_purge(integer)', 'execute') as app, has_function_privilege('public', 'plan_draft_purge(integer)', 'execute') as pub");
    expect(exec.rows[0]).toEqual({ app: false, pub: false });
    await expect(rolledBack(U("x"), [], () => admin.query("select plan_draft_purge(30)"))).rejects.toMatchObject({ code: "42501" });
  });

  it("isolates every new column per user: B cannot list, read, write, take over or remove A's plan", async () => {
    const a = U("a");
    const b = U("b");
    const doc = tmpl();
    const id = doc.id;
    expect(await putPlan(a, id, null, false, w(doc))).toEqual({ kind: "written", revision: 0, created: true });

    expect(await listPlans(b)).toEqual([]);
    expect(await getPlan(b, id)).toBeNull();
    expect(await putPlan(b, id, 0, false, w(doc))).toEqual({ kind: "not-found" });
    expect(await putPlan(b, id, 0, true, w(doc))).toEqual({ kind: "not-found" });
    expect(await deletePlan(b, id, 0)).toEqual({ kind: "not-found" });
    expect(await mergeKeys(b, [{ trip: "dolomites-2027", start: "2027-07-03" }])).toEqual([]);

    const sel = await withUserTransaction(b, async (ctx) => (await ctx.query("select doc, kind, source_trip, start, days, revision, deleted_at from plan_draft")).rows);
    expect(sel.result).toEqual([]);
    // no WHERE, so only the UPDATE and DELETE policies apply (a WHERE would add the SELECT policy and could mask a weakened one)
    const upd = await withUserTransaction(b, async (ctx) => (await ctx.query("update plan_draft set doc = null, kind = null, source_trip = null, deleted_at = now()")).rowCount);
    expect(upd.result).toBe(0);
    const del = await withUserTransaction(b, async (ctx) => (await ctx.query("delete from plan_draft")).rowCount);
    expect(del.result).toBe(0);
    // B cannot plant a row for A (WITH CHECK)
    const bDoc = tmpl();
    await expect(withUserTransaction(b, (ctx) => ctx.query("insert into plan_draft (id, user_id, title) values ($1, $2, 'x')", [bDoc.id, a]))).rejects.toMatchObject({ code: "42501" });
    // nor move its own row onto A: the trigger keeps user_id (S2), and WITH CHECK would refuse it anyway
    await putPlan(b, bDoc.id, null, false, w(bDoc));
    await withUserTransaction(b, (ctx) => ctx.query("update plan_draft set user_id = $1", [a]));
    expect((await raw("select user_id from plan_draft where id = $1", [bDoc.id])).rows).toEqual([{ user_id: b }]);

    const mine = await getPlan(a, id);
    expect(mine).toEqual({ revision: 0, doc: JSON.parse(JSON.stringify(doc)) });
  });

  it("S1: ids are per user: B can hold the same id as A, every answer is the same as if A held nothing, and A's row is untouched", async () => {
    const a = U("s1a");
    const b = U("s1b");
    const c = U("s1c");
    const doc = tmpl();
    await putPlan(a, doc.id, null, false, w(doc, "A's"));
    // B's create of A's id answers exactly what C's create of a fresh id answers
    const fresh = tmpl();
    expect(await putPlan(b, doc.id, null, false, w(doc, "B's"))).toEqual(await putPlan(c, fresh.id, null, false, w(fresh, "C's")));
    // and the merge too: inserted, never refused
    const other = tmpl();
    await putPlan(a, other.id, null, false, w(other));
    expect(await insertPlans(b, [{ id: other.id, ...w(other) }])).toEqual({ inserted: [other.id], already: [], overCap: [], refused: [] });
    // two rows of one id, one per user; each sees its own
    expect((await raw("select user_id, title from plan_draft where id = $1 order by user_id", [doc.id])).rows).toEqual([
      { user_id: a, title: "A's" },
      { user_id: b, title: "B's" },
    ]);
    expect((await deletePlan(b, doc.id, 0)).kind).toBe("deleted");
    expect(await getPlan(a, doc.id)).toMatchObject({ revision: 0 });
    expect((await listPlans(a)).map((r) => [r.id, r.deleted_at])).toEqual(expect.arrayContaining([[doc.id, null]]));
    // the key is (user_id, id)
    const pk = await raw(
      `select array_agg(a.attname::text order by k.ord) as cols from pg_index i
         cross join lateral unnest(i.indkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        where i.indrelid = 'plan_draft'::regclass and i.indisprimary`,
    );
    expect(pk.rows[0].cols).toEqual(["user_id", "id"]);
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
      const q = () => admin.query("select doc->>'start' as start from plan_draft where id = $1", [id]).then((r: any) => r.rows);
      expect(await rolledBack(b, [], q)).toEqual([]);
      expect(await rolledBack(b, ["alter policy plan_draft_select on plan_draft using (true)"], q)).toEqual([{ start: "2027-07-03" }]);
    });

    it("update: B changes A's row only when the UPDATE policy is weakened", async () => {
      const q = () => admin.query("update plan_draft set title = 'pwned'").then((r: any) => r.rowCount);
      expect(await rolledBack(b, [], q)).toBe(0);
      expect(await rolledBack(b, ["alter policy plan_draft_update on plan_draft using (true) with check (true)"], q)).toBeGreaterThan(0);
    });

    it("delete: B removes A's row only when the DELETE policy is weakened", async () => {
      const q = () => admin.query("delete from plan_draft").then((r: any) => r.rowCount);
      expect(await rolledBack(b, [], q)).toBe(0);
      expect(await rolledBack(b, ["alter policy plan_draft_delete on plan_draft using (true)"], q)).toBeGreaterThan(0);
    });

    it("insert: B plants a row for A only when the INSERT policy is weakened", async () => {
      const q = () => admin.query("insert into plan_draft (id, user_id, title) values ($1, $2, 'planted')", [randomUUID(), a]).then((r: any) => r.rowCount);
      await expect(rolledBack(b, [], q)).rejects.toMatchObject({ code: "42501" });
      expect(await rolledBack(b, ["alter policy plan_draft_insert on plan_draft with check (true)"], q)).toBe(1);
    });

    it("A's row is intact after every rolled-back mutation", async () => {
      expect((await getPlan(a, id))?.revision).toBe(0);
    });
  });

  it("shows an unset user nothing and lets it write nothing", async () => {
    const doc = tmpl();
    await putPlan(U("c"), doc.id, null, false, w(doc));
    expect(await rolledBack(null, [], () => admin.query("select * from plan_draft").then((r: any) => r.rows))).toEqual([]);
    await expect(rolledBack(null, [], () => admin.query("insert into plan_draft (id, user_id, title) values ($1, $2, 'x')", [randomUUID(), U("c")]))).rejects.toMatchObject({ code: "42501" });
    expect(await rolledBack(null, [], () => admin.query("update plan_draft set doc = null").then((r: any) => r.rowCount))).toBe(0);
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
      // S2: the start column is the document's
      ["a start that is not the document's", (c: any) => ({ ...c, start: "2027-07-04" })],
      ["no start beside a dated document", (c: any) => ({ ...c, start: null })],
      ["a start beside an undated document", (c: any) => ({ ...c, doc: { ...c.doc, start: undefined } })],
    ])("refuses %s (23514)", async (_name, change) => {
      const { d, cols } = good();
      const c = change(cols);
      if (c.doc && typeof c.doc === "object" && !Array.isArray(c.doc)) for (const k of ["id", "start"]) if (c.doc[k] === undefined) delete c.doc[k];
      await expect(rawInsert(user, d.id, c)).rejects.toMatchObject({ code: "23514" });
    });
  });

  it("S2: a tombstone holds no household data, whoever writes it (CHECK, 23514)", async () => {
    const user = U("tombchk");
    const d = tmpl();
    await rawInsert(user, d.id, { doc: d, kind: "template", source_trip: "dolomites-2027", days: 14 });
    // a tombstone that keeps any of the document, its kind, its trip, its start or its days is refused
    for (const keep of ["doc", "kind", "source_trip", "start", "days"]) {
      const clear = ["doc", "kind", "source_trip", "start", "days"].filter((k) => k !== keep);
      // keeping kind alone (or the trip alone) also breaks the kind/doc rules; each is still a 23514
      await expect(raw(`update plan_draft set deleted_at = now(), ${clear.map((k) => `${k} = null`).join(", ")} where id = $1`, [d.id])).rejects.toMatchObject({
        code: "23514",
      });
    }
    await expect(raw("update plan_draft set deleted_at = now() where id = $1", [d.id])).rejects.toMatchObject({ code: "23514" });
    await raw("update plan_draft set deleted_at = now(), doc = null, kind = null, source_trip = null, start = null, days = null where id = $1", [d.id]);
  });

  it("S2: pins the id, the user and the tombstone time: none can be moved, backdated or extended by an update", async () => {
    const user = U("pin");
    const d = tmpl();
    await putPlan(user, d.id, null, false, w(d));
    const other = randomUUID();
    await raw("update plan_draft set id = $2, user_id = 'someone-else' where id = $1", [d.id, other]);
    expect((await raw("select id::text, user_id from plan_draft where id = any($1::uuid[])", [[d.id, other]])).rows).toEqual([{ id: d.id, user_id: user }]);
    // tombstoning with a past time: the trigger stamps now()
    await raw(
      "update plan_draft set deleted_at = '2000-01-01', doc = null, kind = null, source_trip = null, start = null, days = null where id = $1",
      [d.id],
    );
    const t1 = (await raw("select deleted_at from plan_draft where id = $1", [d.id])).rows[0].deleted_at as Date;
    expect(Date.now() - t1.getTime()).toBeLessThan(60_000);
    // a later update of the tombstone (past or future) keeps the first time
    for (const when of ["2000-01-01", "2999-01-01"]) {
      await raw("update plan_draft set deleted_at = $2 where id = $1", [d.id, when]);
      expect(((await raw("select deleted_at from plan_draft where id = $1", [d.id])).rows[0].deleted_at as Date).toISOString()).toBe(t1.toISOString());
    }
  });

  it("owns the revision and the tombstone on insert and update, whatever a caller sends", async () => {
    const user = U("rev");
    const d = tmpl();
    await rawInsert(user, d.id, { doc: d, kind: "template", source_trip: "dolomites-2027", revision: 7, deleted_at: "2020-01-01T00:00:00Z" });
    const first = await raw("select revision, deleted_at, created_at from plan_draft where id = $1", [d.id]);
    expect(Number(first.rows[0].revision)).toBe(0);
    expect(first.rows[0].deleted_at).toBeNull();
    await raw("update plan_draft set revision = 100, created_at = '2000-01-01' where id = $1", [d.id]);
    await raw("update plan_draft set title = 'Renamed' where id = $1", [d.id]);
    const after = await raw("select revision, created_at from plan_draft where id = $1", [d.id]);
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
    const tomb = await raw("select doc, kind, source_trip, start, days, deleted_at from plan_draft where id = $1", [d.id]);
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
      await expect(withUserTransaction(user, (ctx) => ctx.query("insert into plan_draft (id, user_id, title) values ($1, $2, 'x')", [randomUUID(), user]))).rejects.toMatchObject({ code: PLAN_CAP_SQLSTATE });
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
        await ctx.query(`insert into plan_draft (id, user_id, title) values ($1, $2, 'first')`, [first.id, u]);
        await ctx.query("select pg_sleep(0.6)");
      });
      await new Promise((r) => setTimeout(r, 150));
      const fast = putPlan(u, second.id, null, false, w(second));
      const [s, f] = await Promise.allSettled([slow, fast]);
      expect(s.status).toBe("fulfilled");
      expect(f.status === "fulfilled" && f.value).toEqual({ kind: "cap" });
      const n = await raw("select count(*)::int as n from plan_draft where user_id = $1 and deleted_at is null", [u]);
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
    await backdate([old.id, theirs.id], days + 1);

    expect((await listPlans(user)).map((r) => r.id)).toEqual([keep.id]);
    const next = tmpl();
    await putPlan(user, next.id, null, false, w(next));
    expect((await raw("select 1 from plan_draft where id = $1", [old.id])).rows).toEqual([]);
    expect((await raw("select 1 from plan_draft where id = $1", [keep.id])).rows).toHaveLength(1);
    // the caller's write purged only its own rows
    expect((await raw("select 1 from plan_draft where id = $1", [theirs.id])).rows).toHaveLength(1);
    // the owner's job, through the module (core/bin/db-purge.ts and the cron route run this)
    expect(await purgeAllTombstones(admin, days)).toBeGreaterThanOrEqual(1);
    await expect(purgeAllTombstones(admin, 0)).rejects.toThrow(RangeError);
    expect((await raw("select 1 from plan_draft where id = $1", [theirs.id])).rows).toEqual([]);
  });

  it("merge: the keys carry a document only for a matching trip and start; inserts are idempotent and never touch another user's row", async () => {
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
    // an id another user holds is this user's own new row (S1): never refused, never a signal
    expect(r).toEqual({ inserted: [fresh.id, theirs.id], already: [match.id, tomb.id], overCap: [], refused: [] });
    const again = await insertPlans(user, [{ id: fresh.id, ...w(fresh) }]);
    expect(again).toEqual({ inserted: [], already: [fresh.id], overCap: [], refused: [] });
    // the other user's row is untouched
    // the key is (user_id, id), so the same id can exist once per user: ask for the other user's row by both
    expect((await raw("select user_id from plan_draft where id = $1 and user_id = $2", [theirs.id, U("merge-other")])).rows.map((r: any) => r.user_id)).toEqual([U("merge-other")]);
  });

  it("keeps the content-free signal firing on a plan write, with its three columns only", async () => {
    const user = U("sig");
    const d = tmpl();
    await putPlan(user, d.id, null, false, w(d));
    const s1 = await raw("select * from plan_draft_signal where user_id = $1", [user]);
    expect(Object.keys(s1.rows[0]).sort()).toEqual(["changed_at", "user_id", "version"]);
    await deletePlan(user, d.id, 0);
    const s2 = await raw("select version from plan_draft_signal where user_id = $1", [user]);
    expect(Number(s2.rows[0].version)).toBeGreaterThan(Number(s1.rows[0].version));
  });

  it("N2: at the cap, a merge of a copy the person removed in the account is `already`, not `overCap`", async () => {
    const u = U("n2");
    const gone = tmpl();
    await putPlan(u, gone.id, null, false, w(gone));
    expect((await deletePlan(u, gone.id, 0)).kind).toBe("deleted");
    for (let i = 0; i < PLAN_DOC_LIMITS.accountPlans; i++) {
      const d = tmpl();
      await rawInsert(u, d.id, { doc: d, kind: "template", source_trip: "dolomites-2027" });
    }
    const fresh = tmpl();
    expect(await insertPlans(u, [gone, fresh].map((d) => ({ id: d.id, ...w(d) })))).toEqual({ inserted: [], already: [gone.id], overCap: [fresh.id], refused: [] });
  }, 60000);

  it("B2: the list reads live rows apart from tombstones, so 150 recent removals never hide a live row", async () => {
    const u = U("b2list");
    const live = tmpl();
    await putPlan(u, live.id, null, false, w(live));
    // 160 tombstones, all newer than the live row
    const ids = Array.from({ length: 160 }, () => randomUUID());
    await tombstones(u, ids);
    const list = await listPlans(u);
    expect(list[0]).toMatchObject({ id: live.id, deleted_at: null });
    expect(list.filter((r) => r.deleted_at !== null)).toHaveLength(ACCOUNT_PLANS_LIMITS.listTombstones);
    expect(list.length).toBeLessThanOrEqual(ACCOUNT_PLANS_LIMITS.listRows);
    expect(parseAccountPlanList({ items: list }).success).toBe(true);
    // the device that holds the live copy keeps it
    expect(diffPlanList([{ id: live.id, revision: 0 }], list).drop).toEqual([]);
  }, 60000);

  it("B2: a delete keeps the newest PLAN_SYNC.tombstoneCap tombstones of the user and drops the older ones", async () => {
    const u = U("b2cap");
    const other = U("b2cap-other");
    const ids = Array.from({ length: PLAN_SYNC.tombstoneCap + 5 }, () => randomUUID());
    await tombstones(u, ids);
    // the five oldest
    await backdate(ids.slice(0, 5), 2);
    const theirs = tmpl();
    await putPlan(other, theirs.id, null, false, w(theirs));
    await deletePlan(other, theirs.id, 0);
    await backdate([theirs.id], 3);
    const d = tmpl();
    await putPlan(u, d.id, null, false, w(d));
    expect((await deletePlan(u, d.id, 0)).kind).toBe("deleted");
    const left = await raw("select id::text from plan_draft where user_id = $1 and deleted_at is not null", [u]);
    expect(left.rows).toHaveLength(PLAN_SYNC.tombstoneCap);
    const kept = new Set(left.rows.map((r: any) => r.id));
    expect(kept.has(d.id)).toBe(true);
    for (const id of ids.slice(0, 5)) expect(kept.has(id)).toBe(false);
    // another user's tombstone is not touched
    expect((await raw("select 1 from plan_draft where user_id = $1 and id = $2", [other, theirs.id])).rows).toHaveLength(1);
  }, 60000);

  it("B1: the /account/ read and its Rename and Delete reach title-only live rows only", async () => {
    const u = U("b1");
    const legacy = randomUUID();
    await raw("insert into plan_draft (id, user_id, title) values ($1, $2, 'Nitin')", [legacy, u]);
    const synced = tmpl();
    await putPlan(u, synced.id, null, false, w(synced));
    const tomb = tmpl();
    await putPlan(u, tomb.id, null, false, w(tomb));
    await deletePlan(u, tomb.id, 0);
    const q = draftsReadQuery();
    const read = await withUserTransaction(u, async (ctx) => (await ctx.query(q.sql, q.params(u))).rows.map((r) => r.id));
    expect(read.result).toEqual([legacy]);
    // the actions' statements (web/app/account/actions.ts): a synced plan and a tombstone match nothing
    for (const id of [synced.id, tomb.id]) {
      const ren = await withUserTransaction(u, async (ctx) =>
        (await ctx.query(`update public.plan_draft d set title = 'x' where d.id = $1 and d.user_id = $2 and ${legacyDraftRow("d")} returning d.id`, [id, u])).rowCount,
      );
      expect(ren.result).toBe(0);
      const del = await withUserTransaction(u, async (ctx) =>
        (await ctx.query(`delete from public.plan_draft d where d.id = $1 and d.user_id = $2 and ${legacyDraftRow("d")} returning d.id`, [id, u])).rowCount,
      );
      expect(del.result).toBe(0);
    }
    expect(await getPlan(u, synced.id)).toMatchObject({ revision: 0 });
    const ren = await withUserTransaction(u, async (ctx) =>
      (await ctx.query(`update public.plan_draft d set title = 'Renamed' where d.id = $1 and d.user_id = $2 and ${legacyDraftRow("d")} returning d.id`, [legacy, u])).rowCount,
    );
    expect(ren.result).toBe(1);
    // on a table without the two columns the predicate reads every row as a legacy row (a missing key is null)
    await admin.query("begin");
    try {
      await admin.query("create temp table pre_0013 (id uuid, user_id text, title text)");
      await admin.query("insert into pre_0013 values (gen_random_uuid(), 'u', 't')");
      const r = await admin.query(`select count(*)::int as n from pre_0013 d where ${legacyDraftRow("d")}`);
      expect(r.rows[0].n).toBe(1);
    } finally {
      await admin.query("rollback");
    }
    expect(() => legacyDraftRow("d; drop table x")).toThrow();
  });

  it("S4: every user transaction runs with the statement, lock and idle timeouts, and a lock wait fails fast (55P03)", async () => {
    const u = U("s4");
    const r = await withUserTransaction(u, async (ctx) =>
      (await ctx.query("select current_setting('statement_timeout') as s, current_setting('lock_timeout') as l, current_setting('idle_in_transaction_session_timeout') as i")).rows[0],
    );
    expect(r.result).toEqual({ s: USER_TX_TIMEOUTS.statement, l: USER_TX_TIMEOUTS.lock, i: USER_TX_TIMEOUTS.idleInTransaction });
    const d = tmpl();
    await putPlan(u, d.id, null, false, w(d));
    // the owner holds the row; the user's write waits for the lock timeout, then fails
    await admin.query("begin");
    try {
      await admin.query("select 1 from plan_draft where id = $1 for update", [d.id]);
      const t = Date.now();
      await expect(putPlan(u, d.id, 0, false, w(d))).rejects.toMatchObject({ code: "55P03" });
      expect(Date.now() - t).toBeLessThan(10_000);
    } finally {
      await admin.query("rollback");
    }
    // the pool's next transaction is clean: no timeout leaks onto the connection
    const pool = await getPool(url);
    const c = await pool.connect();
    try {
      expect((await c.query("select current_setting('lock_timeout') as l")).rows[0]).toEqual({ l: "0" });
    } finally {
      c.release();
    }
  }, 20000);

  it("S6: deletePlans removes every row of the user, and only theirs", async () => {
    const u = U("s6");
    const other = U("s6-other");
    for (const who of [u, u, other]) {
      const d = tmpl();
      await putPlan(who, d.id, null, false, w(d));
    }
    await raw("insert into plan_draft (id, user_id, title) values ($1, $2, 'legacy')", [randomUUID(), u]);
    expect(await deletePlans(u)).toBe(3);
    expect((await raw("select count(*)::int as n from plan_draft where user_id = $1", [u])).rows[0].n).toBe(0);
    expect((await raw("select count(*)::int as n from plan_draft where user_id = $1", [other])).rows[0].n).toBe(1);
  });

  it("renames the table and every object named after it: nothing is left named planner_draft (owner, 27 Oct 2026)", async () => {
    const old = "planner" + "_draft"; // split so a repository grep for the old name finds only the rename itself
    // Postgres 18 stores NOT NULL as named constraints (`<table>_<column>_not_null`) that a table rename leaves alone: they are the engine's own names, not ours
    const { rows } = await raw(
      `select 'class' as k, relname::text as n from pg_class where relnamespace = 'public'::regnamespace and relname like $1
       union all select 'proc', proname::text from pg_proc where pronamespace = 'public'::regnamespace and proname like $1
       union all select 'policy', polname::text from pg_policy where polname like $1
       union all select 'trigger', tgname::text from pg_trigger where tgname like $1
       union all select 'constraint', conname::text from pg_constraint where connamespace = 'public'::regnamespace and conname like $1 and conname not like '%\\_not\\_null'`,
      [`${old}%`],
    );
    expect(rows).toEqual([]);
    for (const t of ["plan_draft", "plan_draft_signal"]) expect((await raw("select to_regclass($1) is not null as ok", [`public.${t}`])).rows[0].ok).toBe(true);
    // the signal function is still the owner's SECURITY DEFINER body, and the app role still has no grant on the signal table
    const fn = await raw("select prosecdef from pg_proc where proname = 'plan_draft_bump_signal'");
    expect(fn.rows).toEqual([{ prosecdef: true }]);
    const g = await raw("select count(*)::int as n from information_schema.role_table_grants where table_name = 'plan_draft_signal' and grantee = 'travel_app'");
    expect(g.rows[0].n).toBe(0);
    // the new functions of 0013 are not SECURITY DEFINER (review-em-s 4.4)
    const own = await raw("select proname::text as n, prosecdef from pg_proc where proname in ('plan_draft_revision', 'plan_draft_cap', 'plan_draft_purge', 'plan_draft_touch') order by 1");
    expect(own.rows.map((r: any) => [r.n, r.prosecdef])).toEqual([
      ["plan_draft_cap", false],
      ["plan_draft_purge", false],
      ["plan_draft_revision", false],
      ["plan_draft_touch", false],
    ]);
  });

  it("has the list, merge and purge indexes", async () => {
    const { rows } = await raw("select indexname from pg_indexes where schemaname='public' and tablename='plan_draft'");
    const names = rows.map((r: any) => r.indexname);
    expect(names).toEqual(expect.arrayContaining(["plan_draft_user_live", "plan_draft_user_trip_start", "plan_draft_tombstones"]));
  });

  it("pools: the module's transactions run as travel_app, never as the owner", async () => {
    const pool = await getPool(url);
    const c = await pool.connect();
    c.release();
    const r = await withUserTransaction(U("who"), async (ctx) => (await ctx.query<{ r: string }>("select current_user as r")).rows[0]!.r);
    expect(r.result).toBe("travel_app");
  });
});
