// Integration test — runs only when TEST_DATABASE_URL points at a disposable Neon branch.
//
// It applies the migrations (idempotent), then asserts the full table inventory, RLS coverage, the
// absence of PUBLIC grants, and plan_draft owner isolation through the real shared transaction
// helper. `pg` is imported dynamically inside beforeAll so the suite loads with no driver offline.
//
// Enable it with, e.g.:
//   TEST_DATABASE_URL="postgres://…branch…" pnpm --dir core exec vitest run test/db/integration.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../src/db/runner.ts";
import { ALL_APP_TABLES, PUBLIC_READ_TABLES, RLS_EXEMPT_TABLES, SIGNAL_COLUMNS } from "../../src/db/inventory.ts";
import { closePools, withUserTransaction } from "../../src/db/index.ts";

const url = process.env.TEST_DATABASE_URL;
const run = describe.skipIf(!url);

run("database integration", () => {
  let Client: any;
  let admin: any;

  beforeAll(async () => {
    process.env.DATABASE_URL = url; // withUserTransaction pools against this
    const pgSpec = "pg"; // non-literal so tsc does not require @types/pg here
    ({ Client } = (await import(pgSpec)) as any);
    admin = new Client({ connectionString: url });
    await admin.connect();
    await migrate(admin); // idempotent
  }, 120000);

  afterAll(async () => {
    if (admin) {
      await admin.query("delete from plan_draft where user_id like 'itest-%'").catch(() => {});
      await admin.query("delete from plan_draft_signal where user_id like 'itest-%'").catch(() => {});
      await admin.end();
    }
    await closePools();
  });

  it("creates every application table with RLS enabled", async () => {
    const { rows } = await admin.query(
      "select tablename, rowsecurity from pg_tables where schemaname='public'",
    );
    const have = new Map<string, boolean>(rows.map((r: any) => [r.tablename, r.rowsecurity]));
    for (const t of ALL_APP_TABLES) {
      expect(have.has(t), `table ${t} exists`).toBe(true);
      expect(have.get(t), `RLS enabled on ${t}`).toBe(true);
    }
  });

  it("grants nothing on application tables to PUBLIC", async () => {
    const { rows } = await admin.query(
      `select table_name, privilege_type from information_schema.role_table_grants
         where table_schema='public' and grantee='PUBLIC'
           and table_name = any($1::text[])`,
      [ALL_APP_TABLES],
    );
    expect(rows).toEqual([]);
  });

  it("gives the app role select only on serving-tier tables", async () => {
    const { rows } = await admin.query(
      `select table_name from information_schema.role_table_grants
         where table_schema='public' and grantee='travel_app' and privilege_type='SELECT'`,
    );
    const granted = new Set(rows.map((r: any) => r.table_name));
    for (const t of PUBLIC_READ_TABLES) expect(granted.has(t), `select grant on ${t}`).toBe(true);
    expect(granted.has("trip"), "no select on trip").toBe(false);
    expect(granted.has("household"), "no select on household").toBe(false);
  });

  it("isolates planner drafts per user through the shared transaction helper", async () => {
    const a = `itest-${Date.now()}-a`;
    const b = `itest-${Date.now()}-b`;
    const ins = await withUserTransaction(a, async (ctx) => {
      await ctx.query("insert into plan_draft(user_id,title) values($1,$2)", [a, "A draft"]);
      return true;
    });
    expect(ins.txid).toMatch(/^[0-9]+$/);
    await withUserTransaction(b, (ctx) =>
      ctx.query("insert into plan_draft(user_id,title) values($1,$2)", [b, "B draft"]),
    );

    const aSees = await withUserTransaction(a, async (ctx) =>
      (await ctx.query("select title from plan_draft")).rows.map((r: any) => r.title),
    );
    const bSees = await withUserTransaction(b, async (ctx) =>
      (await ctx.query("select title from plan_draft")).rows.map((r: any) => r.title),
    );
    expect(aSees.result).toEqual(["A draft"]);
    expect(bSees.result).toEqual(["B draft"]);

    // B cannot change A's row.
    const changed = await withUserTransaction(b, async (ctx) =>
      (await ctx.query("update plan_draft set title='x' where user_id=$1", [a])).rowCount,
    );
    expect(changed.result).toBe(0);

    // B cannot forge a row owned by A (RLS WITH CHECK).
    await expect(
      withUserTransaction(b, (ctx) =>
        ctx.query("insert into plan_draft(user_id,title) values($1,$2)", [a, "forged"]),
      ),
    ).rejects.toThrow();
  });

  it("denies the app role any read of a household table", async () => {
    await expect(
      withUserTransaction("itest-denied", (ctx) => ctx.query("select 1 from trip limit 1")),
    ).rejects.toThrow();
  });

  it("keeps the invalidation stream RLS-off, content-free, and off-limits to the app role", async () => {
    // The one deliberate RLS exemption exists with RLS OFF; plan_draft itself still has RLS on.
    const sig = await admin.query(
      "select rowsecurity from pg_tables where schemaname='public' and tablename=$1",
      [RLS_EXEMPT_TABLES[0]],
    );
    expect(sig.rows.length, "plan_draft_signal exists").toBe(1);
    expect(sig.rows[0].rowsecurity, "RLS is OFF on the signal stream").toBe(false);
    const draft = await admin.query(
      "select rowsecurity from pg_tables where schemaname='public' and tablename='plan_draft'",
    );
    expect(draft.rows[0].rowsecurity, "RLS stays ON on plan_draft").toBe(true);

    // It carries no draft content — exactly the three signal columns.
    const cols = await admin.query(
      "select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",
      [RLS_EXEMPT_TABLES[0]],
    );
    expect(cols.rows.map((r: any) => r.column_name)).toEqual([...SIGNAL_COLUMNS]);

    // The app role has NO grant on the signal table: it can neither read nor write it directly, so
    // it cannot enumerate other users' ids.
    for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      await expect(
        withUserTransaction("itest-signal-x", (ctx) =>
          ctx.query(
            priv === "SELECT"
              ? "select 1 from plan_draft_signal limit 1"
              : priv === "INSERT"
                ? "insert into plan_draft_signal(user_id,version) values('itest-x',1)"
                : priv === "UPDATE"
                  ? "update plan_draft_signal set version=version+1"
                  : "delete from plan_draft_signal",
          ),
        ),
        `app role denied ${priv} on plan_draft_signal`,
      ).rejects.toThrow();
    }
  });

  it("bumps only the acting user's signal version on each draft change (same transaction)", async () => {
    const u = `itest-sig-${Date.now()}`;
    const other = `itest-other-${Date.now()}`;
    // A create bumps u's signal to version 1 and leaves 'other' untouched.
    await withUserTransaction(u, (ctx) =>
      ctx.query("insert into plan_draft(id,user_id,title) values(gen_random_uuid(),$1,$2)", [u, "one"]),
    );
    const v1 = await admin.query("select version from plan_draft_signal where user_id=$1", [u]);
    expect(Number(v1.rows[0]?.version)).toBe(1);
    const none = await admin.query("select 1 from plan_draft_signal where user_id=$1", [other]);
    expect(none.rows.length).toBe(0);

    // A second change bumps the version again (monotonic).
    await withUserTransaction(u, (ctx) =>
      ctx.query("insert into plan_draft(id,user_id,title) values(gen_random_uuid(),$1,$2)", [u, "two"]),
    );
    const v2 = await admin.query("select version from plan_draft_signal where user_id=$1", [u]);
    expect(Number(v2.rows[0].version)).toBe(2);

    await admin.query("delete from plan_draft where user_id=$1", [u]);
    await admin.query("delete from plan_draft_signal where user_id=$1", [u]);
  });
});
