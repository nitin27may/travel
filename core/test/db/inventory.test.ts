// Pure inventory tests — assert the exact proposal table names and the integration additions.
import { describe, expect, it } from "vitest";
import {
  ALL_APP_TABLES,
  NEW_TABLES,
  PROPOSAL_TABLES,
  PUBLIC_READ_TABLES,
  RLS_EXEMPT_TABLES,
  SIGNAL_COLUMNS,
} from "../../src/db/inventory.ts";

// The exact 62 application table names from docs/v2/schema.sql (minus the auth.users stub),
// pinned here so a rename or drop fails loudly (brief: complete table inventory).
const EXPECTED_62 = [
  "app_user", "area", "attachment", "backlog", "budget_line", "calendar_feed", "calendar_window",
  "change", "changeset", "check_dismissal", "condition_report", "coverage", "day_note", "day_state",
  "document_rule", "entity", "entity_link", "event_occurrence", "evidence", "expense",
  "freshness_rule", "fx_rate", "household", "household_member", "inbound_address", "inbound_email",
  "item_memory", "lane", "leg_cache", "mcp_token", "media", "membership", "notification_pref",
  "offer", "op_event", "pack_template", "person", "push_subscription", "relation", "reminder",
  "research_gap", "research_job", "reservation", "reservation_secret", "reservation_segment",
  "reservation_traveller", "saved_place", "saved_view", "share_link", "source", "task",
  "template_update_decision", "track", "travel_goal", "traveller", "trip", "trip_candidate",
  "trip_item", "trip_list", "trip_member", "trip_type", "user_settings",
].sort();

describe("table inventory", () => {
  it("covers exactly the 62 proposal tables", () => {
    expect(PROPOSAL_TABLES.length).toBe(62);
    expect([...PROPOSAL_TABLES].sort()).toEqual(EXPECTED_62);
  });

  it("never includes the auth.users stub or any neon_auth provider table", () => {
    for (const t of ALL_APP_TABLES) {
      expect(t.startsWith("auth")).toBe(false);
      expect(t.includes("neon_auth")).toBe(false);
    }
    expect(PROPOSAL_TABLES).not.toContain("users");
  });

  it("adds plan_draft and the accepted schema-diff tables, with no overlap", () => {
    expect(NEW_TABLES).toContain("plan_draft");
    const overlap = NEW_TABLES.filter((t) => (PROPOSAL_TABLES as readonly string[]).includes(t));
    expect(overlap).toEqual([]);
    expect(new Set(ALL_APP_TABLES).size).toBe(ALL_APP_TABLES.length);
  });

  it("marks only serving-tier tables as public-read (plan_draft is not public)", () => {
    expect(PUBLIC_READ_TABLES).not.toContain("plan_draft");
    expect(PUBLIC_READ_TABLES).not.toContain("trip");
    expect(PUBLIC_READ_TABLES).not.toContain("household");
    expect(PUBLIC_READ_TABLES).toContain("entity");
    for (const t of PUBLIC_READ_TABLES) expect(ALL_APP_TABLES).toContain(t);
  });

  it("exempts exactly one content-free relation from RLS (the invalidation stream)", () => {
    // The coordinator exception is a single, named, content-free table — not a general escape hatch.
    expect(RLS_EXEMPT_TABLES).toEqual(["plan_draft_signal"]);
    // It is NOT an RLS-on application table, and it carries no draft content.
    expect(ALL_APP_TABLES).not.toContain("plan_draft_signal");
    expect(PUBLIC_READ_TABLES).not.toContain("plan_draft_signal");
    expect(SIGNAL_COLUMNS).toEqual(["user_id", "version", "changed_at"]);
    // Guard against ever leaking private draft fields into the non-RLS stream.
    for (const content of ["title", "created_at", "id", "body", "note"]) {
      expect(SIGNAL_COLUMNS).not.toContain(content);
    }
  });
});
