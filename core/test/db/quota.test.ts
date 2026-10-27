// quota_bucket and quota_take() against a real branch (EML-Q; email spec 14, DB row). Runs only when TEST_DATABASE_URL points at a
// disposable Neon branch (the child `srv-migrate-verify`), never production:
//   TEST_DATABASE_URL="$(neon connection-string br-damp-breeze-b41mtvn5 --project-id damp-queen-64719841)" \
//     pnpm --dir core exec vitest run test/db/quota.test.ts
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../src/db/runner.ts";
import { closePools } from "../../src/db/client.ts";
import { createPgQuotaStore } from "../../src/quota/pg.ts";
import { ipHash } from "../../src/quota/keys.ts";
import { readinessProblems, readinessQuery } from "../../src/quota/stats.ts";
import { APP_ROLE } from "../../src/db/tx.ts";

const url = process.env.TEST_DATABASE_URL;
const run = describe.skipIf(!url);
const tag = randomBytes(4).toString("hex");
const B = (name: string) => `itest:${tag}:${name}`;
const hex = () => randomBytes(16).toString("hex");

run("quota_bucket (database)", () => {
  let admin: any;
  const store = () => createPgQuotaStore(url);

  /** Run SQL as the app role, the way the runtime does. */
  async function asApp(sql: string, params: unknown[] = []): Promise<any> {
    await admin.query("begin");
    try {
      await admin.query('set local role "travel_app"');
      const r = await admin.query(sql, params);
      await admin.query("commit");
      return r;
    } catch (e) {
      await admin.query("rollback");
      throw e;
    }
  }

  beforeAll(async () => {
    const pgSpec = "pg";
    const { Client } = (await import(pgSpec)) as any;
    admin = new Client({ connectionString: url });
    await admin.connect();
    await migrate(admin);
  }, 120000);

  afterAll(async () => {
    if (admin) {
      await admin.query("delete from quota_bucket where bucket like $1", [`itest:${tag}:%`]).catch(() => {});
      await admin.end();
    }
    await closePools();
  });

  it("reports the quota store ready once 0011 is applied (quota.ts check, review SF7)", async () => {
    const q = readinessQuery(APP_ROLE);
    const { rows } = await admin.query(q.sql, q.params);
    expect(readinessProblems(rows[0])).toEqual([]);
    const none = readinessQuery(`no_such_role_${tag}`);
    const missing = await admin.query(none.sql, none.params);
    expect(readinessProblems(missing.rows[0])).toEqual(["the app role is missing (an earlier migration)"]);
  });

  it("has RLS on and no grant of any kind to the app role", async () => {
    const rls = await admin.query("select rowsecurity from pg_tables where schemaname='public' and tablename='quota_bucket'");
    expect(rls.rows[0]?.rowsecurity).toBe(true);
    const grants = await admin.query(
      "select privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='quota_bucket' and grantee in ('travel_app','PUBLIC')",
    );
    expect(grants.rows).toEqual([]);
    const policies = await admin.query("select 1 from pg_policies where schemaname='public' and tablename='quota_bucket'");
    expect(policies.rows).toEqual([]);
  });

  it.each([
    ["select", "select * from quota_bucket limit 1"],
    ["insert", `insert into quota_bucket(bucket,key,window_s,window_start) values('itest:x','',60,now())`],
    ["update", "update quota_bucket set count = 0"],
    ["delete", "delete from quota_bucket"],
  ])("denies the app role a direct %s (42501)", async (_op, sql) => {
    await expect(asApp(sql)).rejects.toMatchObject({ code: "42501" });
  });

  it("admits exactly the limit under 20 parallel calls", async () => {
    const s = store();
    const key = hex();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => s.take([{ bucket: B("parallel"), key, windowS: 3600, limit: 5 }])),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    const refused = results.filter((r) => !r.allowed);
    expect(refused).toHaveLength(15);
    for (const r of refused) if (!r.allowed) expect(r.retryAfterS).toBeGreaterThan(0), expect(r.retryAfterS).toBeLessThanOrEqual(3600);
    const row = await admin.query("select count from quota_bucket where bucket=$1 and key=$2", [B("parallel"), key]);
    expect(Number(row.rows[0].count)).toBe(5);
  }, 60000);

  it("is all or nothing across rules", async () => {
    const s = store();
    const a = hex();
    const rules = [
      { bucket: B("tight"), key: a, windowS: 60, limit: 1 },
      { bucket: B("loose"), key: a, windowS: 3600, limit: 10 },
    ];
    expect((await s.take(rules)).allowed).toBe(true);
    const second = await s.take(rules);
    expect(second.allowed).toBe(false);
    if (!second.allowed) expect(second.failed).toBe(0);
    const loose = await admin.query("select count from quota_bucket where bucket=$1", [B("loose")]);
    expect(Number(loose.rows[0].count)).toBe(1);
  });

  it("counts without refusing when the limit is null, and peeks global counters only", async () => {
    const s = store();
    for (let i = 0; i < 3; i++) await s.take([{ bucket: B("metric"), key: "", windowS: 86400, limit: null }]);
    expect(await s.peek(B("metric"), 86400, new Date())).toBe(3);
    const k = hex();
    await s.take([{ bucket: B("keyed"), key: k, windowS: 86400, limit: null }]);
    // quota_peek reads only the empty key: a hashed row is invisible through it.
    expect(await s.peek(B("keyed"), 86400, new Date())).toBe(0);
  });

  it.each(["visitor@example.test", "203.0.113.7", "2001:db8::1", "ABCDEF0123456789ABCDEF0123456789"])(
    "refuses a raw value %s as a key (CHECK, 23514), even through quota_take",
    async (raw) => {
      await expect(
        asApp("select * from quota_take($1::text[], $2::text[], $3::int[], $4::int[])", [[B("raw")], [raw], [60], [5]]),
      ).rejects.toMatchObject({ code: "23514" });
    },
  );

  it("stores the HMAC of an IP, never the IP", async () => {
    const s = store();
    const ip = "203.0.113.9";
    await s.take([{ bucket: B("ip"), key: ipHash("x".repeat(32), ip, new Date()), windowS: 3600, limit: 5 }]);
    const all = await admin.query("select key from quota_bucket where bucket like $1", [`itest:${tag}:%`]);
    for (const r of all.rows) expect(r.key).not.toContain(ip);
  });

  it("refuses bad arguments with 22023", async () => {
    await expect(asApp("select * from quota_take($1::text[], $2::text[], $3::int[], $4::int[])", [[B("a"), B("b")], [""], [60], [1]])).rejects.toMatchObject({ code: "22023" });
    await expect(asApp("select * from quota_take($1::text[], $2::text[], $3::int[], $4::int[])", [[], [], [], []])).rejects.toMatchObject({ code: "22023" });
  });

  it("purges hashed rows 48 h after their window and global counters after 35 days", async () => {
    const oldKeyed = hex();
    await admin.query("insert into quota_bucket(bucket,key,window_s,window_start,count) values($1,$2,60,now() - interval '72 hours',3)", [B("old"), oldKeyed]);
    await admin.query("insert into quota_bucket(bucket,key,window_s,window_start,count) values($1,'',86400,now() - interval '40 days',3)", [B("oldglobal")]);
    await admin.query("insert into quota_bucket(bucket,key,window_s,window_start,count) values($1,'',86400,now() - interval '3 days',3)", [B("recentglobal")]);
    await store().take([{ bucket: B("trigger"), key: "", windowS: 60, limit: null }]);
    const left = await admin.query("select bucket from quota_bucket where bucket = any($1::text[])", [[B("old"), B("oldglobal"), B("recentglobal")]]);
    expect(left.rows.map((r: any) => r.bucket)).toEqual([B("recentglobal")]);
  });
});
