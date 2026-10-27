// account_profile (migration 0012, ACCT-PC; account-profile-and-travellers.md 9.2) against a real database. Runs only when
// TEST_DATABASE_URL points at a disposable database (the Docker one of `pnpm db:test`, or the Neon child branch), never production:
//   TEST_DATABASE_URL="postgres://…" pnpm --dir core exec vitest run test/db/account-profile.test.ts
// Owner-only RLS (four cases), an unset user, the grants, the CHECK refusals, the revision guard and the trigger's bookkeeping.
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../src/db/runner.ts";
import { closePools, withUserTransaction } from "../../src/db/index.ts";
import { CONSENT_REQUIRED_SQLSTATE, finishSetup, loadProfile, removeTravellers, saveTravellers, deleteProfile } from "../../src/db/profile.ts";
import { TRAVELLERS_CONSENT_VERSION } from "../../src/config/account.ts";
import { TRAVELLERS_SCHEMA } from "../../src/schema/travellers.ts";

const url = process.env.TEST_DATABASE_URL;
const run = describe.skipIf(!url);
const tag = randomBytes(4).toString("hex");
const U = (n: string) => `itest-ap-${tag}-${n}`;
const TODAY = new Date().toISOString().slice(0, 10);
const DOC = { schema: TRAVELLERS_SCHEMA, adults: 2, children: [{ age: 7, age_as_of: TODAY }, { age: 9, age_as_of: TODAY }] };
const DOC2 = { schema: TRAVELLERS_SCHEMA, adults: 1, children: [{ age: 4, age_as_of: TODAY }] };
/** The Account page's Save travellers: the AP-15 wording was on screen (S3). */
const CONSENT = { consent: true } as const;

run("account_profile (database)", () => {
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
      await admin.query("delete from account_profile where user_id like $1", [`itest-ap-${tag}-%`]).catch(() => {});
      await admin.end();
    }
    await closePools();
  });

  /** As the app role with no user bound: what an anonymous or broken transaction sees. */
  async function asAppNoUser(sql: string, params: unknown[] = []): Promise<any> {
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

  it("has RLS on, the four owner policies, and grants only to travel_app", async () => {
    const rls = await admin.query("select rowsecurity from pg_tables where schemaname='public' and tablename='account_profile'");
    expect(rls.rows[0]?.rowsecurity).toBe(true);
    const pol = await admin.query("select policyname, cmd from pg_policies where schemaname='public' and tablename='account_profile' order by policyname");
    expect(pol.rows).toEqual([
      { policyname: "account_profile_delete", cmd: "DELETE" },
      { policyname: "account_profile_insert", cmd: "INSERT" },
      { policyname: "account_profile_select", cmd: "SELECT" },
      { policyname: "account_profile_update", cmd: "UPDATE" },
    ]);
    const grants = await admin.query(
      "select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='account_profile' and grantee <> current_user order by 1, 2",
    );
    expect(grants.rows).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"].map((p) => ({ grantee: "travel_app", privilege_type: p })));
  });

  it("isolates rows per user: B cannot select, insert, update or delete A's row", async () => {
    const a = U("a");
    const b = U("b");
    expect(await saveTravellers(a, DOC, 0, CONSENT)).toEqual({ kind: "saved", revision: 1 });

    // select: B sees nothing of A, by id or in bulk
    expect((await loadProfile(b)).exists).toBe(false);
    const bulk = await withUserTransaction(b, async (ctx) => (await ctx.query("select user_id from account_profile")).rows);
    expect(bulk.result).toEqual([]);
    const byId = await withUserTransaction(b, async (ctx) => (await ctx.query("select 1 from account_profile where user_id = $1", [a])).rows);
    expect(byId.result).toEqual([]);

    // insert: B cannot create a row owned by A (WITH CHECK), nor take over A's id through an upsert
    await expect(withUserTransaction(b, (ctx) => ctx.query("insert into account_profile(user_id) values ($1)", [a]))).rejects.toMatchObject({ code: "42501" });

    // update and delete: zero rows
    const upd = await withUserTransaction(b, async (ctx) => (await ctx.query("update account_profile set travellers = null where user_id = $1", [a])).rowCount);
    expect(upd.result).toBe(0);
    const del = await withUserTransaction(b, async (ctx) => (await ctx.query("delete from account_profile where user_id = $1", [a])).rowCount);
    expect(del.result).toBe(0);
    // with no WHERE and no column read, only the UPDATE and DELETE policies apply (a WHERE also applies the SELECT policy, which
    // would hide a weakened UPDATE or DELETE policy; mutation-checked by hand, see the ACCT-PC hand-back)
    const bulkUpd = await withUserTransaction(b, async (ctx) => (await ctx.query("update account_profile set travellers = null")).rowCount);
    expect(bulkUpd.result).toBe(0);
    const bulkDel = await withUserTransaction(b, async (ctx) => (await ctx.query("delete from account_profile")).rowCount);
    expect(bulkDel.result).toBe(0);

    // B cannot move its own row onto A's id either (WITH CHECK on update; no WHERE, so the SELECT policy does not mask it)
    await finishSetup(b);
    await expect(withUserTransaction(b, (ctx) => ctx.query("update account_profile set user_id = $1", [a]))).rejects.toMatchObject({ code: "42501" });

    // A's row is untouched
    const mine = await loadProfile(a);
    expect(mine.travellers).toEqual(DOC);
    expect(mine.revision).toBe(1);
  });

  it("shows an unset user nothing and lets it write nothing", async () => {
    await saveTravellers(U("c"), DOC, 0, CONSENT);
    const r = await asAppNoUser("select * from account_profile");
    expect(r.rows).toEqual([]);
    await expect(asAppNoUser("insert into account_profile(user_id) values ($1)", [U("c2")])).rejects.toMatchObject({ code: "42501" });
    const u = await asAppNoUser("update account_profile set travellers = null");
    expect(u.rowCount).toBe(0);
  });

  it.each([
    ["another schema", { ...DOC, schema: "travellers/2" }],
    ["13 adults", { ...DOC, adults: 13 }],
    ["9 children", { ...DOC, children: Array.from({ length: 9 }, () => ({ age: 5, age_as_of: TODAY })) }],
    ["a child of 18", { ...DOC, children: [{ age: 18, age_as_of: TODAY }] }],
    ["a name on a child", { ...DOC, children: [{ age: 5, age_as_of: TODAY, name: "Kai" }] }],
    ["a birth month (the first draft's born)", { ...DOC, children: [{ age: 5, age_as_of: TODAY, born: "2021-03" }] }],
    ["an unknown key", { ...DOC, note: "x" }],
    ["a nested array", { ...DOC, children: [[{ age: 5, age_as_of: TODAY }]] }],
    ["more adults' ages than adults", { ...DOC, adults: 1, adult_ages: [{ age: 40, age_as_of: TODAY }, { age: 41, age_as_of: TODAY }] }],
    ["an adult of 12", { ...DOC, adult_ages: [{ age: 12, age_as_of: TODAY }] }],
    ["a 3 KB document", { ...DOC, children: [{ age: 5, age_as_of: TODAY, dob: "x".repeat(3000) }] }],
    ["an array", [DOC]],
    // N4: lax jsonpath unwraps an array for like_regex, so each leaf's type is checked first
    ["a date of birth in an array", { ...DOC, children: [{ age: 5, age_as_of: TODAY, dob: ["2021-03-01"] }] }],
    ["a date of birth in an array with a stray value", { ...DOC, children: [{ age: 5, age_as_of: TODAY, dob: ["2021-03-01", "x"] }] }],
    ["an entry date in an array", { ...DOC, children: [{ age: 5, age_as_of: [TODAY] }] }],
    ["an adult's entry date in an array", { ...DOC, adult_ages: [{ age: 40, age_as_of: [TODAY, "x"] }] }],
    ["an age in an array", { ...DOC, children: [{ age: [5], age_as_of: TODAY }] }],
  ])("refuses %s even from the owner (CHECK, 23514)", async (_what, travellers) => {
    await expect(
      admin.query("insert into account_profile(user_id, travellers, travellers_consent_version) values ($1, $2::jsonb, $3)", [
        U("bad"),
        JSON.stringify(travellers),
        TRAVELLERS_CONSENT_VERSION,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("guards every save and removal with the revision (two devices)", async () => {
    const u = U("rev");
    expect(await saveTravellers(u, DOC, 0, CONSENT)).toEqual({ kind: "saved", revision: 1 });
    // a second device that loaded "nothing saved" cannot overwrite
    expect(await saveTravellers(u, DOC2, 0, CONSENT)).toEqual({ kind: "conflict" });
    expect(await saveTravellers(u, DOC2, 1)).toEqual({ kind: "saved", revision: 2 });
    // the first device, still on revision 1, can neither save nor remove
    expect(await saveTravellers(u, DOC, 1)).toEqual({ kind: "conflict" });
    expect(await removeTravellers(u, 1)).toEqual({ kind: "conflict" });
    expect(await removeTravellers(u, 2)).toEqual({ kind: "saved", revision: 3 });
    // removing again is a no-op; Undo re-saves at the new revision
    expect(await removeTravellers(u, 3)).toEqual({ kind: "saved", revision: 3 });
    expect(await saveTravellers(u, DOC2, 3, CONSENT)).toEqual({ kind: "saved", revision: 4 });
    expect((await loadProfile(u)).travellers).toEqual(DOC2);
    // a row deleted on another device is a conflict, never a silent re-create at a stale revision
    expect(await deleteProfile(u)).toBe(true);
    expect(await saveTravellers(u, DOC, 4)).toEqual({ kind: "conflict" });
    expect((await loadProfile(u)).exists).toBe(false);
  });

  it("keeps the bookkeeping in the trigger: consent, saved time, setup and a forged revision", async () => {
    const u = U("touch");
    // setup skipped first: a row with no travellers, revision 0, no consent
    const done = await finishSetup(u);
    let p = await loadProfile(u);
    expect(p).toMatchObject({ exists: true, revision: 0, travellers: null, travellersConsentedAt: null, travellersConsentVersion: null, travellersSavedAt: null });
    expect(p.setupDoneAt).toBe(done);
    // finishing again keeps the first time; it never moves the revision
    expect(await finishSetup(u)).toBe(done);
    // the first save over that row is at revision 0, and records consent with its wording
    expect(await saveTravellers(u, DOC, 0, CONSENT)).toEqual({ kind: "saved", revision: 1 });
    p = await loadProfile(u);
    expect(p.travellersConsentedAt).not.toBeNull();
    expect(p.travellersConsentVersion).toBe(TRAVELLERS_CONSENT_VERSION);
    expect(p.travellersSavedAt).not.toBeNull();
    const consent = p.travellersConsentedAt;
    // the same document again does not move the revision; a later save without consent ("Looks right") keeps the record
    expect(await saveTravellers(u, DOC, 1)).toEqual({ kind: "saved", revision: 1 });
    expect(await saveTravellers(u, DOC2, 1)).toEqual({ kind: "saved", revision: 2 });
    expect((await loadProfile(u)).travellersConsentedAt).toBe(consent);
    // removal keeps the consent record; setup, revision and consent cannot be forged by an update
    await removeTravellers(u, 2);
    await withUserTransaction(u, (ctx) =>
      ctx.query("update account_profile set setup_done_at = null, revision = 99, travellers_consented_at = null, travellers_consent_version = null where user_id = $1", [u]),
    );
    p = await loadProfile(u);
    expect(p.travellersConsentedAt).toBe(consent);
    expect(p.travellersConsentVersion).toBe(TRAVELLERS_CONSENT_VERSION);
    expect(p.setupDoneAt).toBe(done);
    expect(p.revision).toBe(3);
    // a forged revision or consent on insert is ignored
    const v = U("forge");
    await withUserTransaction(v, (ctx) =>
      ctx.query("insert into account_profile(user_id, revision, travellers_consented_at, travellers_consent_version) values ($1, 42, now(), $2)", [v, TRAVELLERS_CONSENT_VERSION]),
    );
    expect(await loadProfile(v)).toMatchObject({ revision: 0, travellersConsentedAt: null, travellersConsentVersion: null });
  });

  it("S3: a save that creates travellers needs the consent wording; a re-save after a removal is stamped again", async () => {
    const u = U("consent");
    // no consent: refused (the seed or "Looks right" path cannot make a consent where none exists), and nothing is stored
    expect(await saveTravellers(u, DOC, 0)).toEqual({ kind: "rejected", issues: ["$: consent_required"] });
    expect((await loadProfile(u)).exists).toBe(false);
    await expect(withUserTransaction(u, (ctx) => ctx.query("insert into account_profile(user_id, travellers) values ($1, $2::jsonb)", [u, JSON.stringify(DOC)]))).rejects.toMatchObject({
      code: CONSENT_REQUIRED_SQLSTATE,
    });
    // a wording outside the allow-list is refused by the CHECK, even from the owner
    await expect(
      admin.query("insert into account_profile(user_id, travellers, travellers_consent_version) values ($1, $2::jsonb, 'made-up')", [u, JSON.stringify(DOC)]),
    ).rejects.toMatchObject({ code: "23514" });
    expect(await saveTravellers(u, DOC, 0, CONSENT)).toEqual({ kind: "saved", revision: 1 });
    const first = (await loadProfile(u)).travellersConsentedAt!;
    expect(await removeTravellers(u, 1)).toEqual({ kind: "saved", revision: 2 });
    // after a removal, saving again without consent is refused; with it, the consent time moves
    expect(await saveTravellers(u, DOC, 2)).toEqual({ kind: "rejected", issues: ["$: consent_required"] });
    await new Promise((r) => setTimeout(r, 20));
    expect(await saveTravellers(u, DOC, 2, CONSENT)).toEqual({ kind: "saved", revision: 3 });
    const again = await loadProfile(u);
    expect(Date.parse(again.travellersConsentedAt!)).toBeGreaterThan(Date.parse(first));
    expect(again.travellersConsentVersion).toBe(TRAVELLERS_CONSENT_VERSION);
  });

  it("N4: accepts the largest valid document (8 children, 12 adults' ages, each with a date of birth) under the 2 KB CHECK", async () => {
    const u = U("big");
    const child = { age: 9, age_as_of: TODAY, dob: "2017-01-01" };
    const adult = { age: 40, age_as_of: TODAY, dob: "1986-01-01" };
    // ages that agree with their dob as of today, as Zod requires
    const ageOf = (dob: string) => {
      const [y, m, d] = dob.split("-").map(Number);
      const [ty, tm, td] = TODAY.split("-").map(Number);
      return ty! - y! - (tm! < m! || (tm === m && td! < d!) ? 1 : 0);
    };
    const doc = {
      schema: TRAVELLERS_SCHEMA,
      adults: 12,
      adult_ages: Array.from({ length: 12 }, () => ({ ...adult, age: ageOf(adult.dob) })),
      children: Array.from({ length: 8 }, () => ({ ...child, age: ageOf(child.dob) })),
    };
    expect(await saveTravellers(u, doc, 0, CONSENT)).toEqual({ kind: "saved", revision: 1 });
    const size = await admin.query("select pg_column_size(travellers) as n, octet_length(travellers::text) as t from account_profile where user_id = $1", [u]);
    expect(size.rows[0].n).toBeLessThanOrEqual(2048);
  });
});
