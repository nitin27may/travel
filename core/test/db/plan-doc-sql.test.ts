// The `plan_doc` migration (EM-M) against the contract it implements, without a database: PLAN_DOC_MIGRATION in
// core/src/schema/api/account-plans.ts and the numbers in core/src/config/plans.ts. The behaviour is tested against Postgres in
// plan-doc.test.ts (skipped without TEST_DATABASE_URL); this file runs everywhere, so a constant changed on one side fails here.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLAN_DOC_LIMITS, PLAN_SYNC } from "../../src/config/plans.ts";
import { loadMigrations } from "../../src/db/loader.ts";
import { PLAN_CAP_SQLSTATE } from "../../src/db/plans.ts";
import { ACCOUNT_PLANS_LIMITS, PLAN_DOC_MIGRATION } from "../../src/schema/api/account-plans.ts";

const all = loadMigrations();
const mig = all.find((m) => m.name === PLAN_DOC_MIGRATION.slug);
const sql = (mig?.sql ?? "").replace(/--[^\n]*/g, "");
const flat = sql.replace(/\s+/g, " ");

describe("migration plan_doc", () => {
  it("exists once, as the migration after account_profile", () => {
    expect(mig).toBeDefined();
    expect(all.filter((m) => m.name === PLAN_DOC_MIGRATION.slug)).toHaveLength(1);
    const i = all.indexOf(mig!);
    expect(all[i - 1]?.name).toBe("account_profile");
    expect(Number(mig!.version)).toBe(Number(all[i - 1]!.version) + 1);
  });

  it("alters plan_draft only, and creates no table and no policy", () => {
    expect(flat).toMatch(/alter table plan_draft add column/);
    expect(flat).not.toMatch(/create table/i);
    // a policy is only renamed (the table rename), never created, changed or dropped
    const policyStatements = flat.match(/(?:create|alter|drop) policy[^;]*;/gi) ?? [];
    expect(policyStatements).toHaveLength(4);
    for (const p of policyStatements) expect(p).toMatch(/^alter policy planner_draft_(select|insert|update|delete) on plan_draft rename to plan_draft_\1;$/);
    expect(flat).not.toMatch(/disable row level security|bypassrls/i);
    // the one SECURITY DEFINER body is 0010's signal function, written again with the new table name (no new privilege)
    expect(flat.match(/security definer/gi) ?? []).toHaveLength(1);
    expect(flat).toContain("create or replace function plan_draft_bump_signal() returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$");
    expect(flat).not.toMatch(/\bto public\b|grant [a-z, ]+ on plan_draft to (?!travel_app)/i);
    expect(flat).not.toMatch(/grant [a-z, ]+ on plan_draft_signal/i);
  });

  it("renames planner_draft and every object 0009 and 0010 named after it (owner decision, 27 Oct 2026)", () => {
    for (const st of [
      "alter table planner_draft rename to plan_draft;",
      "alter table plan_draft rename constraint planner_draft_pkey to plan_draft_pkey;",
      "alter table plan_draft rename constraint planner_draft_title_check to plan_draft_title_check;",
      "alter index planner_draft_user_id_updated_at_idx rename to plan_draft_user_id_updated_at_idx;",
      "alter trigger planner_draft_touch_t on plan_draft rename to plan_draft_touch_t;",
      "alter function planner_draft_touch() rename to plan_draft_touch;",
      "alter table planner_draft_signal rename to plan_draft_signal;",
      "alter table plan_draft_signal rename constraint planner_draft_signal_pkey to plan_draft_signal_pkey;",
      "alter trigger planner_draft_signal_t on plan_draft rename to plan_draft_signal_t;",
      "alter function planner_draft_bump_signal() rename to plan_draft_bump_signal;",
    ])
      expect(flat).toContain(st);
    // after the rename block, nothing names the old table
    expect(flat.slice(flat.indexOf("create or replace function plan_draft_bump_signal"))).not.toContain("planner_draft");
  });

  it("adds every column of the contract with its type, nullability and default", () => {
    const pgType: Record<string, string> = { jsonb: "jsonb", text: "text", date: "date", int: "integer", bigint: "bigint", timestamptz: "timestamptz" };
    for (const c of PLAN_DOC_MIGRATION.columns) {
      const def = "default" in c ? ` default ${c.default}` : "";
      const nul = c.nullable ? "" : " not null";
      expect(flat, c.name).toContain(`add column ${c.name} ${pgType[c.type]}${nul}${def}`);
    }
  });

  it("carries the contract's CHECK values: the document backstop, the kinds, the slug, the days, the revision and the row rules", () => {
    expect(flat).toContain("'^plan-draft/[1-9][0-9]{0,3}$'");
    expect(flat).toContain("(doc->>'id') <> id::text");
    expect(flat).toContain(`octet_length(doc::text) <= ${Math.floor(ACCOUNT_PLANS_LIMITS.docBytes * 1.5)}`);
    expect(flat).toContain("kind in ('template', 'built')");
    expect(flat).toContain("source_trip ~ '^[a-z0-9][a-z0-9-]{0,99}$'");
    expect(flat).toContain(`days between 1 and ${PLAN_DOC_LIMITS.templateDays}`);
    expect(flat).toContain("revision >= 0");
    for (const rule of PLAN_DOC_MIGRATION.checks) expect(flat).toContain(rule);
  });

  it("caps live rows at the contract's number, raising the SQLSTATE the module maps", () => {
    expect(flat).toContain(`if n >= ${PLAN_DOC_LIMITS.accountPlans} then`);
    expect(flat).toContain(`raise exception 'PLAN_CAP' using errcode = '${PLAN_CAP_SQLSTATE}'`);
    expect(flat).toContain("pg_advisory_xact_lock(");
    expect(flat).toContain("deleted_at is null");
    // the cap trigger fires after the revision trigger (name order), so it sees the insert's forced deleted_at
    expect("plan_draft_revision_t" < "plan_draft_x_cap_t").toBe(true);
    expect(flat).toContain("create trigger plan_draft_x_cap_t before insert or update of deleted_at on plan_draft");
  });

  it("purges after the tombstone days, closed to the app role", () => {
    expect(flat).toContain(`coalesce(p_days, ${PLAN_SYNC.tombstoneDays})`);
    expect(flat).toContain(`plan_draft_purge(p_days integer default ${PLAN_SYNC.tombstoneDays})`);
    expect(flat).toContain("revoke all on function plan_draft_purge(integer) from public");
    expect(flat).not.toMatch(/grant execute on function plan_draft_purge/);
  });

  it("keys the table per user (S1): the old key is dropped and (user_id, id) added; every module statement names the user", () => {
    expect(flat).toContain("alter table plan_draft drop constraint plan_draft_pkey");
    expect(flat).toContain(`add constraint plan_draft_pkey primary key (${PLAN_DOC_MIGRATION.primaryKey.join(", ")})`);
    const mod = readFileSync(fileURLToPath(new URL("../../src/db/plans.ts", import.meta.url)), "utf8");
    expect(mod).not.toMatch(/on conflict \(id\)/);
    // every statement that names an id names the user too
    for (const m of mod.matchAll(/`([^`]*\bplan_draft\b[^`]*)`/g)) {
      const q = m[1]!;
      if (/\bid = \$/.test(q)) expect(q, q).toMatch(/user_id = \$/);
    }
  });

  it("pins the bookkeeping in the trigger (S2): the id, the user, and a tombstone time the caller cannot choose", () => {
    expect(flat).toContain("new.id := old.id;");
    expect(flat).toContain("new.user_id := old.user_id;");
    expect(flat).toContain("if old.deleted_at is null and new.deleted_at is not null then new.deleted_at := now();");
    expect(flat).toContain("elsif old.deleted_at is not null and new.deleted_at is not null then new.deleted_at := old.deleted_at;");
    expect(flat).toContain(PLAN_DOC_MIGRATION.columns.find((c) => c.name === "start")!.check!);
  });

  it("bounds the list (B2): every live row and the newest tombstones fit one answer", () => {
    expect(ACCOUNT_PLANS_LIMITS.listRows).toBe(PLAN_DOC_LIMITS.accountPlans + ACCOUNT_PLANS_LIMITS.listTombstones);
    expect(ACCOUNT_PLANS_LIMITS.listTombstones).toBe(PLAN_SYNC.tombstoneCap);
  });

  it("creates the contract's indexes", () => {
    expect(flat).toContain("on plan_draft (user_id, deleted_at, updated_at desc)");
    expect(flat).toContain("on plan_draft (user_id, source_trip, start) where deleted_at is null");
  });
});
