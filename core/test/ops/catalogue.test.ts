import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOGUE, OPS_BY_NAME, buildOpsJson, mcpTools, opsJsonText } from "../../src/ops/catalogue.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const owner = { id: "u_owner", via: "cli" };

/** plan 5.7 and 5.8, tool -> [operation, phase] */
const PLAN_TOOLS: Record<string, [string, 1 | 2]> = {
  list_entity_types: ["schema.list_types", 1],
  get_entity_schema: ["schema.get", 1],
  list_operations: ["ops.list", 1],
  describe_operation: ["ops.describe", 1],
  query_rows: ["rows.query", 1],
  get_trip: ["trip.get", 1],
  get_place: ["place.get", 1],
  get_trail: ["trail.get", 1],
  search: ["search", 1],
  list_due_bookings: ["bookings.due", 1],
  validate_trip: ["trip.validate", 1],
  get_coverage: ["catalog.coverage", 1],
  list_backlog: ["backlog.list", 1],
  suggest_breaks: ["route.suggest_breaks", 1],
  search_along_route: ["search.along_route", 1],
  create_trip: ["trip.create", 2],
  add_place: ["place.add", 2],
  add_item: ["item.add", 2],
  update_item: ["item.update", 2],
  upsert_trip_booking: ["trip_booking.upsert", 2],
  upsert_trail: ["trail.upsert", 2],
  set_trip_activity: ["trip_activity.set", 2],
  apply_operation: ["ops.apply", 2],
  propose_research_changes: ["research.propose", 2],
  apply_proposal: ["proposal.apply", 2],
  inbox_add: ["inbox.add", 2],
  inbox_resolve: ["inbox.resolve", 2],
  propose_catalog_change: ["catalog.propose", 2],
};

/** plan 5.3, 5.8 and 0A.2: every operation name, in families */
const PLAN_OPS = [
  "schema.list_types", "schema.get", "ops.list", "ops.describe", "rows.query", "trip.get", "place.get", "trail.get", "search", "bookings.due",
  "place.resolve", "place.add", "place.edit", "place.visit_add", "tag.add", "tag.alias", "trip.create", "trip.update", "trip.adopt_place",
  "edition.add", "edition.update", "edition.choose", "base.set", "day.add", "day.update", "day.swap", "day.remove", "item.add", "item.update",
  "item.move", "item.remove", "track.set", "trail.upsert", "trail.link", "trip_activity.set", "trip_booking.upsert", "trip_booking.set_status",
  "hazard.upsert", "weather_rule.upsert", "budget.upsert", "document.upsert", "emergency.upsert", "question.add", "question.answer",
  "knowledge.add", "gotcha.add", "fare.add_window", "fare.add_quote", "research.add_ref", "research.propose", "trip.import",
  "proposal.apply", "proposal.reject", "inbox.add", "inbox.resolve", "inbox.dismiss", "trip.copy", "note.add", "note.update", "note.remove",
  "custom_item.add", "custom_item.update", "custom_item.propose", "item.pin", "item.unpin", "day.optimise", "route.set", "route.compute",
  "route.suggest_breaks", "route.insert_break", "search.near", "search.along_route", "catalog.add", "catalog.edit", "catalog.merge",
  "catalog.retire", "catalog.verify", "catalog.propose", "catalog.apply", "catalog.coverage", "backlog.list", "backlog.add", "planner.draft",
];

describe("operation catalogue", () => {
  it("has unique names, sorted, with the plan's full operation list", () => {
    const names = CATALOGUE.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const n of PLAN_OPS) expect(OPS_BY_NAME.has(n), n).toBe(true);
  });

  it("gives every entry a summary, tables, an input and an output schema", () => {
    for (const o of CATALOGUE) {
      expect(o.summary.length, o.name).toBeGreaterThanOrEqual(8);
      expect([1, 2]).toContain(o.phase);
      expect(["read", "write"]).toContain(o.kind);
      expect(o.input.safeParse(undefined).success, o.name).toBe(false);
      expect(o.output).toBeDefined();
    }
  });

  it("carries every MCP tool of plan 5.7 and 5.8 with the stated phase, and no others", () => {
    const got = Object.fromEntries(mcpTools().map((t) => [t.tool, [t.op.name, t.phase]]));
    expect(got).toEqual(PLAN_TOOLS);
    expect(new Set(mcpTools().map((t) => t.tool)).size).toBe(mcpTools().length);
  });

  it("makes every Phase 1 MCP tool a read", () => {
    for (const t of mcpTools().filter((x) => x.phase === 1)) expect(t.op.kind, t.tool).toBe("read");
  });

  it("puts the inbox in Phase 2", () => {
    for (const n of ["inbox.add", "inbox.resolve", "inbox.dismiss"]) expect(OPS_BY_NAME.get(n)!.phase).toBe(2);
  });

  it("rejects a write input without actor, for every write", () => {
    for (const o of CATALOGUE.filter((x) => x.kind === "write")) {
      const r = o.input.safeParse({ client_op_id: "x" });
      expect(r.success, o.name).toBe(false);
      const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
      expect(paths, `${o.name} must name actor`).toContain("actor");
    }
  });

  it("requires actor in the exported JSON Schema of every write and in no read", () => {
    for (const o of buildOpsJson().operations as any[]) {
      const required: string[] = o.input.required ?? [];
      if (o.kind === "write") {
        expect(required, o.name).toContain("actor");
        expect(Object.keys(o.input.properties), o.name).toEqual(expect.arrayContaining(["actor", "client_op_id", "expected_rev"]));
      } else expect(Object.keys(o.input.properties ?? {}), o.name).not.toContain("actor");
      expect(o.input.additionalProperties, o.name).toBe(false);
    }
  });

  it("accepts a well-formed write and checks the actor's shape", () => {
    const rm = OPS_BY_NAME.get("item.remove")!;
    expect(rm.input.safeParse({ actor: owner, slug: "patagonia-feb-mar-2027", id: "d08-i01" }).success).toBe(true);
    expect(rm.input.safeParse({ actor: owner, slug: "patagonia-feb-mar-2027", id: "d08-i01", client_op_id: "a1", expected_rev: "abc" }).success).toBe(true);
    expect(rm.input.safeParse({ slug: "patagonia-feb-mar-2027", id: "d08-i01" }).success).toBe(false);
    expect(rm.input.safeParse({ actor: { id: "u_owner", via: "carrier-pigeon" }, slug: "x", id: "d08-i01" }).success).toBe(false);
    expect(rm.input.safeParse({ actor: owner, slug: "Not A Slug", id: "d08-i01" }).success).toBe(false);
    expect(rm.input.safeParse({ actor: { id: "agent:trails", via: "skill:trip-planner" }, slug: "x", id: "d08-i01" }).success).toBe(true);
  });

  it("builds input schemas from the entity schemas, so a field change propagates", () => {
    const add = buildOpsJson().operations.find((o: any) => o.name === "item.add");
    const row = add.input.properties.row;
    expect(Object.keys(row.properties)).toContain("leg_minutes");
    expect(row.required).toContain("duration_min");
    const upd = buildOpsJson().operations.find((o: any) => o.name === "item.update");
    expect(upd.input.properties.patch.required ?? []).toEqual([]);
  });

  it("matches the committed data/schema/generated/ops.json byte for byte", () => {
    expect(readFileSync(join(REPO, "data/schema/generated/ops.json"), "utf8")).toBe(opsJsonText());
  });

  it("exports operations sorted by name with input and output JSON Schema", () => {
    const ops = buildOpsJson().operations as any[];
    expect(ops.map((o) => o.name)).toEqual([...ops.map((o) => o.name)].sort((a, b) => a.localeCompare(b)));
    for (const o of ops) {
      expect(o.input.type, o.name).toBe("object");
      expect(o.output.type, o.name).toBe("object");
    }
    const place = ops.find((o) => o.name === "place.add");
    expect(place.input.properties.screenshot.pattern).toBe("^research\\/inbox\\/.*");
  });
});
