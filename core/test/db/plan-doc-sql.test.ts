// The `plan_doc` migration (EM-M) against the contract it implements, without a database: PLAN_DOC_MIGRATION in
// core/src/schema/api/account-plans.ts and the numbers in core/src/config/plans.ts. The behaviour is tested against Postgres in
// plan-doc.test.ts (skipped without TEST_DATABASE_URL); this file runs everywhere, so a constant changed on one side fails here.
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

  it("alters planner_draft only, and creates no table and no policy", () => {
    expect(flat).toMatch(/alter table planner_draft add column/);
    expect(flat).not.toMatch(/create table/i);
    expect(flat).not.toMatch(/create policy|alter policy|drop policy|disable row level security|bypassrls|security definer/i);
    expect(flat).not.toMatch(/to public|grant [a-z, ]+ on planner_draft to (?!travel_app)/i);
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
    expect("planner_draft_revision_t" < "planner_draft_x_cap_t").toBe(true);
    expect(flat).toContain("create trigger planner_draft_x_cap_t before insert or update of deleted_at on planner_draft");
  });

  it("purges after the tombstone days, closed to the app role", () => {
    expect(flat).toContain(`coalesce(p_days, ${PLAN_SYNC.tombstoneDays})`);
    expect(flat).toContain(`planner_draft_purge(p_days integer default ${PLAN_SYNC.tombstoneDays})`);
    expect(flat).toContain("revoke all on function planner_draft_purge(integer) from public");
    expect(flat).not.toMatch(/grant execute on function planner_draft_purge/);
  });

  it("creates the contract's indexes", () => {
    expect(flat).toContain("on planner_draft (user_id, deleted_at, updated_at desc)");
    expect(flat).toContain("on planner_draft (user_id, source_trip, start) where deleted_at is null");
  });
});
