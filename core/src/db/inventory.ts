// Canonical table inventory for the application schema.
//
// PROPOSAL_TABLES is the exact set of 62 application tables from docs/v2/schema.sql (the 17 Oct
// proposal), excluding the `auth.users` test stub. The migrations must create every one of these.
// NEW_TABLES are the additional tables introduced by the accepted schema diff (M1–M15, see
// research/reports/schema-diff-2026-10.md) plus the planner_draft integration table. The inventory
// test asserts that every name here exists in the public schema with row-level security enabled.
//
// Managed Better Auth owns the `neon_auth` schema; those provider tables are never created here and
// are intentionally absent from this inventory.

/** The 62 application tables of the proposal (schema.sql), excluding the auth.users stub. */
export const PROPOSAL_TABLES: readonly string[] = [
  "app_user",
  "area",
  "attachment",
  "backlog",
  "budget_line",
  "calendar_feed",
  "calendar_window",
  "change",
  "changeset",
  "check_dismissal",
  "condition_report",
  "coverage",
  "day_note",
  "day_state",
  "document_rule",
  "entity",
  "entity_link",
  "event_occurrence",
  "evidence",
  "expense",
  "freshness_rule",
  "fx_rate",
  "household",
  "household_member",
  "inbound_address",
  "inbound_email",
  "item_memory",
  "lane",
  "leg_cache",
  "mcp_token",
  "media",
  "membership",
  "notification_pref",
  "offer",
  "op_event",
  "pack_template",
  "person",
  "push_subscription",
  "relation",
  "reminder",
  "research_gap",
  "research_job",
  "reservation",
  "reservation_secret",
  "reservation_segment",
  "reservation_traveller",
  "saved_place",
  "saved_view",
  "share_link",
  "source",
  "task",
  "template_update_decision",
  "track",
  "travel_goal",
  "traveller",
  "trip",
  "trip_candidate",
  "trip_item",
  "trip_list",
  "trip_member",
  "trip_type",
  "user_settings",
] as const;

/** Tables added by the accepted schema diff (M1–M15) and the planner_draft integration contract. */
export const NEW_TABLES: readonly string[] = [
  // M1 source tier
  "dataset_file",
  "record_doc",
  "catalogue_meta",
  // M2 vocab
  "type_node",
  "tag",
  "relevance_class",
  // M4 towns, M6 operators
  "town",
  "operator",
  // M5 aliases
  "entity_alias",
  // M9 serving derivations
  "suitability",
  "relevance",
  "relevance_derived",
  "relevance_signal",
  // M11 source mapping, M12 supersede
  "source_local",
  "capture_supersede",
  // M13 projections
  "place_row",
  "place_page",
  "trip_row",
  "trip_page",
  // M14 private household
  "saved_source",
  "visit",
  "collection",
  "collection_place",
  // planner_draft integration contract (NEON-SETUP.md)
  "planner_draft",
  // auth guard quotas and the owner-alert budget (migration 0011, EML-Q): RLS on, no policy, reached only through definer functions
  "quota_bucket",
] as const;

/** Every application table that the migrations create. */
export const ALL_APP_TABLES: readonly string[] = [...PROPOSAL_TABLES, ...NEW_TABLES];

/**
 * Relations intentionally created with row-level security OFF. The ONLY entry is the content-free
 * invalidation stream `planner_draft_signal` (migration 0010), under the coordinator exception in
 * NEON-SETUP.md: Neon Realtime (pre-GA) rejects any subscription to an RLS-enabled relation, so the
 * private, RLS-protected `planner_draft` cannot be read live. This table carries NO draft content —
 * only the columns in SIGNAL_COLUMNS — and the app role gets no grant on it. Kept separate from
 * ALL_APP_TABLES so the "every application table has RLS" invariant stays exact and this single,
 * reviewed exemption is explicit and guarded (exactly one, content-free).
 */
export const RLS_EXEMPT_TABLES: readonly string[] = ["planner_draft_signal"] as const;

/** The exact, content-free columns of `planner_draft_signal`. No draft title or body ever appears. */
export const SIGNAL_COLUMNS: readonly string[] = ["user_id", "version", "changed_at"] as const;

/**
 * Serving-tier tables that carry a public SELECT policy (catalogue read for anon/app). Everything
 * else is RLS-on with no policy (private household/planner, internal source tier), except
 * planner_draft, which has owner-predicate policies keyed on the transaction-local app.user_id.
 */
export const PUBLIC_READ_TABLES: readonly string[] = [
  "area",
  "entity",
  "offer",
  "relation",
  "entity_link",
  "track",
  "condition_report",
  "event_occurrence",
  "source",
  "media",
  "type_node",
  "tag",
  "relevance_class",
  "town",
  "operator",
  "suitability",
  "relevance",
  "relevance_derived",
  "relevance_signal",
  "entity_alias",
  "place_row",
  "place_page",
  "trip_row",
  "trip_page",
  "catalogue_meta",
] as const;
