// The operation catalogue (plan 5.1-5.3, 5.7, 5.8, 0A.2): one entry per operation. The HTTP API, the ops CLI and the
// MCP servers are all generated from it, so a field change in an entity schema reaches every surface. P2b writes the
// catalogue (names, schemas, phases); P4a writes the logic behind each name.
//
//   phase  1 = available in Phase 1 (git and files, the local server and the stdio MCP server)
//          2 = Phase 2 (the Worker)
//   mcp    the tool name and phase when the operation is also an MCP tool (5.7)
import { z } from "zod";
import * as E from "../schema/enums.ts";
import { SLUG_RE } from "../schema/meta.ts";
import type { Table } from "../schema/meta.ts";
import { tableOf } from "../schema/index.ts";

export type OpKind = "read" | "write";

export interface OpEntry {
  name: string;
  summary: string;
  kind: OpKind;
  phase: 1 | 2;
  /** tables touched, as "<family>.<table>" (reads list what they read) */
  tables: string[];
  input: z.ZodType;
  output: z.ZodType;
  mcp?: { tool: string; phase: 1 | 2 };
}

// ----------------------------------------------------------------------------- building blocks
/** who is asking: the owner, an agent lane or a skill, and through which door (changelog.actor_via) */
export const actor = z.strictObject({
  id: z.string().min(1).describe('"u_owner" or "agent:<lane>"'),
  via: z.string().regex(/^(ui|cli|mcp|api|import|skill:[a-z0-9-]+)$/).describe('"ui", "cli", "mcp", "api", "import" or "skill:<name>"'),
});

/** every write carries this envelope (plan 5.3): the actor, an idempotency key and optimistic concurrency */
export const envelope = {
  actor,
  client_op_id: z.string().min(1).optional().describe("repeat the same value to retry a write safely"),
  expected_rev: z.union([z.string().min(1), z.number().int()]).optional().describe("the rev (D1) or file hash (git) the caller last saw; a mismatch returns E_STALE"),
};

const slug = z.string().regex(SLUG_RE).describe("trip slug");
const id = z.string().min(1);
const day = z.number().int().min(0);
const record = z.record(z.string(), z.unknown());
const tripTable = (name: string): Table => tableOf("trip", name);
const catTable = (name: string): Table => tableOf("catalog", name);
const patchOf = (t: Table): z.ZodType => (t.schema as z.ZodObject<Record<string, z.ZodType>>).partial();
const locTable = (name: string): Table => tableOf("locations", name);

const warning = z.strictObject({ code: z.string(), message: z.string(), where: z.string() });
/** what every write returns (plan 5.3) */
export const writeResult = z.strictObject({
  ok: z.boolean(),
  changed: z.array(z.string()),
  warnings: z.array(warning),
  changelog_seq: z.number().int(),
});

const catalogEntity = z.enum(["trails", "activities", "stays", "eateries", "offers", "legs", "area_guides"]);

// ----------------------------------------------------------------------------- definitions
const ops: OpEntry[] = [];

function def(e: Omit<OpEntry, "input" | "output"> & { input?: Record<string, z.ZodType>; output?: z.ZodType }): void {
  const fields = e.input ?? {};
  const input = z.strictObject(e.kind === "write" ? { ...envelope, ...fields } : fields);
  const output = e.output ?? (e.kind === "write" ? writeResult : z.strictObject({}));
  ops.push({ name: e.name, summary: e.summary, kind: e.kind, phase: e.phase, tables: e.tables, mcp: e.mcp, input, output });
}

const read = (name: string, summary: string, tables: string[], input: Record<string, z.ZodType>, output: z.ZodType, mcp?: OpEntry["mcp"], phase: 1 | 2 = 1): void =>
  def({ name, summary, kind: "read", phase, tables, input, output, mcp });

const write = (name: string, summary: string, tables: string[], input: Record<string, z.ZodType>, mcp?: OpEntry["mcp"], phase: 1 | 2 = 1, output?: z.ZodType): void =>
  def({ name, summary, kind: "write", phase, tables, input, output, mcp });

/** a write whose input is a slug plus one full row of a trip table */
function upsertRow(name: string, tableName: string, summary: string, mcp?: OpEntry["mcp"]): void {
  write(name, summary, [`trip.${tableName}`], { slug, row: tripTable(tableName).schema }, mcp);
}

// ---- schema and operations (reads)
read("schema.list_types", "List the entity types with row counts and schema ids.", ["trip.*", "catalog.*", "locations.*"], {},
  z.strictObject({ types: z.array(z.strictObject({ id: z.string(), family: z.string(), table: z.string(), rows: z.number().int() })) }),
  { tool: "list_entity_types", phase: 1 });
read("schema.get", "The exported JSON Schema of one entity type, with its ui, private, sql and rules metadata.", [], { type: z.string().describe('"<family>.<table>", for example "trip.items"') },
  z.strictObject({ schema: record }), { tool: "get_entity_schema", phase: 1 });
read("ops.list", "List every operation with its kind, phase and MCP tool name.", [], {},
  z.strictObject({ operations: z.array(z.strictObject({ name: z.string(), summary: z.string(), kind: z.enum(["read", "write"]), phase: z.number().int(), mcp: z.strictObject({ tool: z.string(), phase: z.number().int() }).optional() })) }),
  { tool: "list_operations", phase: 1 });
read("ops.describe", "Describe one operation: summary, tables, input and output JSON Schema.", [], { name: z.string() },
  z.strictObject({ operation: record }), { tool: "describe_operation", phase: 1 });
write("ops.apply", "Apply any write operation by name; the input is validated against that operation's schema (the long tail of 5.7).", [], { name: z.string(), input: record },
  { tool: "apply_operation", phase: 2 }, 2);

// ---- reads over data
read("rows.query", "Query rows of any entity type with the filter grammar of plan 4.2 given as JSON.", ["trip.*", "catalog.*", "locations.*"], {
  type: z.string().describe('"<family>.<table>", for example "locations.places"'),
  filter: record.optional().describe('{"all": [{"field": "kid_fit", "op": "in", "value": ["yes"]}]}'),
  sort: z.array(z.strictObject({ field: z.string(), dir: z.enum(["asc", "desc"]) })).optional(),
  fields: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  cursor: z.string().optional(),
}, z.strictObject({ rows: z.array(record), total: z.number().int(), next_cursor: z.string().nullable() }), { tool: "query_rows", phase: 1 });
read("trip.get", "A trip with all its tables; with resolve true, real dates, ages, book-by dates and sun times for an edition.", ["trip.*"], {
  slug, edition: z.string().optional(), resolve: z.boolean().default(false),
}, z.strictObject({ trip: record }), { tool: "get_trip", phase: 1 });
read("trip.validate", "Run the validator and the day checks on a stored trip or on candidate JSON; returns errors and warnings.", ["trip.*"], {
  slug: slug.optional(), candidate: record.optional().describe("a whole trip document; give this or slug"),
}, z.strictObject({ ok: z.boolean(), errors: z.array(z.strictObject({ code: z.string(), path: z.string(), message: z.string() })), warnings: z.array(z.strictObject({ code: z.string(), path: z.string(), message: z.string() })) }),
{ tool: "validate_trip", phase: 1 });
read("place.get", "One place with its sources, tags and the trips that use it.", ["locations.places"], { id }, z.strictObject({ place: record }), { tool: "get_place", phase: 1 });
read("trail.get", "One trail with its house grade, local grade and links; with geometry true, the geometry sidecar.", ["catalog.trails"], { id, geometry: z.boolean().default(false) },
  z.strictObject({ trail: record }), { tool: "get_trail", phase: 1 });
read("search", "Grouped substring hits (name and alias) across places, trails, activities, stays, eateries and trips.", ["locations.*", "catalog.*", "trip.trip"], {
  q: z.string().min(1), types: z.array(z.string()).optional(),
}, z.strictObject({ groups: z.array(z.strictObject({ type: z.string(), hits: z.array(record) })) }), { tool: "search", phase: 1 });
read("bookings.due", "Bookings across trips ordered by resolved book-by date, with their state.", ["trip.trip_bookings", "catalog.offers"], {
  within_days: z.number().int().min(0).default(90), trip: slug.optional(),
}, z.strictObject({ bookings: z.array(record) }), { tool: "list_due_bookings", phase: 1 });
read("place.resolve", "Resolve a place name to candidates with parent chains (external lookup, writes nothing).", ["locations.places"], {
  name: z.string().min(1), country: z.string().length(2).optional(), region: z.string().optional(), lat: z.number().optional(), lon: z.number().optional(),
}, z.strictObject({ candidates: z.array(record) }));
read("search.near", "Catalog rows within a radius of a point.", ["locations.places", "catalog.*"], {
  lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), radius_km: z.number().positive(), types: z.array(z.string()).optional(),
}, z.strictObject({ hits: z.array(record) }));
read("search.along_route", "Catalog rows within a corridor along a stored route.", ["trip.routes", "catalog.*"], {
  slug, route_id: id, corridor_km: z.number().positive(), types: z.array(z.string()).optional(),
}, z.strictObject({ hits: z.array(record) }), { tool: "search_along_route", phase: 1 });
read("route.suggest_breaks", "Ranked break and overnight candidates with detour minutes for a route; writes nothing.", ["trip.routes", "catalog.*"], {
  slug, route_id: id, overrides: record.optional(),
}, z.strictObject({ candidates: z.array(record) }), { tool: "suggest_breaks", phase: 1 });
read("catalog.coverage", "Coverage of the catalog per area and entity: counts, freshness and gaps.", ["catalog.*"], {
  area_id: z.string().optional(),
}, z.strictObject({ coverage: z.array(record) }), { tool: "get_coverage", phase: 1 });
read("backlog.list", "The research backlog, optionally for one area, reason or status.", ["catalog.backlog"], {
  area_id: z.string().optional(), reason: z.enum(E.BACKLOG_REASON).optional(), status: z.enum(E.BACKLOG_STATUS).optional(),
}, z.strictObject({ backlog: z.array(record) }), { tool: "list_backlog", phase: 1 });
read("planner.draft", "Draft a trip from a brief using the catalog only; returns the draft and writes nothing.", ["catalog.*", "locations.*"], {
  brief: record,
}, z.strictObject({ draft: record, gaps: z.array(z.string()) }));

// ---- places and tags
const placeFields = {
  kind: z.enum(E.PLACE_KIND).optional(), tags: z.array(z.string()).optional(), season: z.array(z.string()).optional(),
  kid_fit: z.enum(E.KID_FIT).optional(), stats: z.record(z.string(), z.union([z.string(), z.number()])).optional(), note: z.string().optional(),
  source: z.string().regex(/^https?:\/\/\S+$/).optional(), source_type: z.enum(E.LOCATION_SOURCE_TYPES).optional(), source_note: z.string().optional(),
  screenshot: z.string().startsWith("research/inbox/").optional(), lat: z.number().min(-90).max(90).optional(), lon: z.number().min(-180).max(180).optional(),
  trip: z.string().optional(), unconfirmed: z.boolean().optional(),
};
write("place.add", "Add a place to the laundry list; Wikidata then Nominatim resolve coordinates and the country > region > area chain.", ["locations.places", "locations.place_tags", "locations.sources"], {
  name: z.string().min(1), country: z.string().length(2).optional(), region: z.string().optional(), area: z.string().optional(),
  display_name: z.string().optional(), alias: z.string().optional(), ...placeFields,
}, { tool: "add_place", phase: 2 });
write("place.edit", "Change a place: status, kind, tags, notes, coordinates, trip or sources.", ["locations.places", "locations.place_tags", "locations.sources"], {
  id, name: z.string().optional(), status: z.enum(E.PLACE_STATUS).optional(), area: z.string().optional(), no_trip: z.boolean().optional(),
  tags_add: z.array(z.string()).optional(), tags_remove: z.array(z.string()).optional(), note_append: z.string().optional(), ...placeFields,
});
write("place.visit_add", "Record a visit to a place; its status becomes visited.", ["locations.visits", "locations.places"], {
  id, date: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/), end: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).optional(), trip: z.string().optional(), note: z.string().optional(),
});
write("tag.add", "Add a tag to the shared vocabulary.", ["locations.tags"], { row: locTable("tags").schema });
write("tag.alias", "Make a spelling an alias of a canonical tag and rewrite the rows that used it.", ["locations.tags", "locations.place_tags"], {
  alias: z.string().min(1), canonical: z.string().min(1),
});

// ---- trips
write("trip.create", "Create data/trips/<slug>/ from a trip, profile, travellers, tags and optional editions.", ["trip.*"], {
  trip: tripTable("trip").schema, profile: tripTable("profile").schema, travellers: z.array(tripTable("travellers").schema),
  trip_tags: z.array(tripTable("trip_tags").schema), editions: z.array(tripTable("editions").schema).optional(),
}, { tool: "create_trip", phase: 2 });
write("trip.update", "Patch the trip, profile or travellers of a trip.", ["trip.trip", "trip.profile", "trip.travellers"], {
  slug, trip: patchOf(tripTable("trip")).optional(), profile: patchOf(tripTable("profile")).optional(),
  travellers: z.array(tripTable("travellers").schema).optional(),
});
write("trip.adopt_place", "Set a place's trip and status planned, and queue it as a stop candidate in the trip's research.", ["locations.places", "trip.trip"], { slug, place_id: id });
write("trip.import", "Propose creating a whole trip from a PLAN.md and research paths; writes nothing until the proposal is applied.", ["trip.*"], {
  slug, plan_md: z.string(), research_paths: z.array(z.string()),
});
write("trip.copy", "Copy a trip as references only: no private data, booking statuses or edition.", ["trip.*"], {
  from_slug: slug, new_slug: slug, include: z.array(z.enum(["items", "notes"])).default([]),
});

// ---- editions, bases, days, items
write("edition.add", "Add an edition (a candidate set of dates).", ["trip.editions"], { slug, row: tripTable("editions").schema });
write("edition.update", "Patch an edition; stores conditions_trigger.", ["trip.editions"], { slug, id, patch: patchOf(tripTable("editions")) });
write("edition.choose", "Choose an edition; at most one edition is chosen or booked.", ["trip.editions"], { slug, id });
write("base.set", "Replace the night split: the bases, validated to cover every night.", ["trip.bases"], { slug, bases: z.array(tripTable("bases").schema) });
write("day.add", "Add a day.", ["trip.days"], { slug, row: tripTable("days").schema });
write("day.update", "Patch a day.", ["trip.days"], { slug, n: day, patch: patchOf(tripTable("days")) });
write("day.swap", "Swap two days; renumbers the items' day.", ["trip.days", "trip.items", "trip.day_tracks"], { slug, a: day, b: day });
write("day.remove", "Remove a day and its items.", ["trip.days", "trip.items", "trip.day_tracks"], { slug, n: day });
write("day.optimise", "Reorder the non-pinned items of a day and track by nearest neighbour; returns the new order as a proposal.", ["trip.items"], {
  slug, day, track: z.enum(E.TRACK).nullable(),
});
write("item.add", "Add an item to a day and track; seq stays contiguous.", ["trip.items"], { slug, row: tripTable("items").schema }, { tool: "add_item", phase: 2 });
write("item.update", "Patch an item.", ["trip.items"], { slug, id, patch: patchOf(tripTable("items")) }, { tool: "update_item", phase: 2 });
write("item.move", "Move an item to a seq, day or track; seq stays contiguous.", ["trip.items"], {
  slug, id, seq: z.number().int().min(1).optional(), day: day.optional(), track: z.enum(E.TRACK).nullable().optional(),
});
write("item.remove", "Remove an item; seq stays contiguous.", ["trip.items"], { slug, id });
write("item.pin", "Pin an item so a regenerate keeps it.", ["trip.items"], { slug, id });
write("item.unpin", "Unpin an item.", ["trip.items"], { slug, id });
write("track.set", "Set a day track row.", ["trip.day_tracks"], { slug, row: tripTable("day_tracks").schema });

// ---- catalog-facing trip rows
write("trail.upsert", "Add or replace a trail row in the catalog; optionally queues or runs the geometry fetch.", ["catalog.trails"], {
  row: catTable("trails").schema, osm_relation: z.string().optional(), gpx_upload: z.string().optional(),
}, { tool: "upsert_trail", phase: 2 });
write("trail.link", "Link a catalog trail to a trip with a role.", ["trip.trip_trails"], { slug, row: tripTable("trip_trails").schema });
write("trip_activity.set", "Set a trip's verdict on an activity.", ["trip.trip_activities"], { slug, row: tripTable("trip_activities").schema }, { tool: "set_trip_activity", phase: 2 });
write("trip_booking.upsert", "Add or replace a booking row; the book-by is recomputed.", ["trip.trip_bookings"], { slug, row: tripTable("trip_bookings").schema }, { tool: "upsert_trip_booking", phase: 2 });
write("trip_booking.set_status", "Set a booking's status.", ["trip.trip_bookings"], { slug, id, status: z.enum(E.BOOKING_STATUS) });

// ---- the other trip row upserts
upsertRow("hazard.upsert", "hazards", "Add or replace a hazard.");
upsertRow("weather_rule.upsert", "weather_rules", "Add or replace a weather rule.");
upsertRow("budget.upsert", "budget", "Add or replace a budget row.");
upsertRow("document.upsert", "documents", "Add or replace a travel document requirement.");
upsertRow("emergency.upsert", "emergency", "Add or replace the emergency contacts of a base.");
upsertRow("question.add", "questions", "Add an open question.");
write("question.answer", "Answer a question.", ["trip.questions"], { slug, id, answer: z.string().min(1) });
upsertRow("knowledge.add", "knowledge", "Add a knowledge claim with its status.");
upsertRow("gotcha.add", "gotchas", "Add a gotcha.");
write("fare.add_window", "Add a fare window.", ["trip.fare_windows"], { slug, row: tripTable("fare_windows").schema });
write("fare.add_quote", "Add a fare quote to a window.", ["trip.fare_quotes"], { slug, row: tripTable("fare_quotes").schema });

// ---- notes, custom items, routes
write("note.add", "Add a note to a trip, day, item or place.", ["trip.notes"], { slug, row: tripTable("notes").schema });
write("note.update", "Patch a note.", ["trip.notes"], { slug, id, patch: patchOf(tripTable("notes")) });
write("note.remove", "Remove a note.", ["trip.notes"], { slug, id });
write("custom_item.add", "Add a trip-local custom item.", ["trip.custom_items"], { slug, row: tripTable("custom_items").schema });
write("custom_item.update", "Patch a custom item.", ["trip.custom_items"], { slug, id, patch: patchOf(tripTable("custom_items")) });
write("custom_item.propose", "Propose a custom item to the shared catalog as a catalog.propose change.", ["trip.custom_items", "catalog.*"], { slug, id });
write("route.set", "Store a route request.", ["trip.routes"], { slug, row: tripTable("routes").schema });
write("route.compute", "Compute a route: an estimate or stored geometry in Phase 1, a provider call in Phase 2; writes geometry_file and catalog legs.", ["trip.routes", "catalog.legs"], { slug, route_id: id });
write("route.insert_break", "Insert a break or overnight candidate into a route and recompute the legs.", ["trip.routes", "trip.items", "trip.custom_items"], {
  slug, route_id: id, candidate: z.union([z.strictObject({ catalog_id: id }), z.strictObject({ osm_id: z.string() }), z.strictObject({ lat: z.number(), lon: z.number() })]),
});

// ---- research and proposals
write("research.add_ref", "Index a research file (and its sidecar) on a trip.", ["trip.research_refs"], {
  slug, path: z.string().startsWith("research/"), lane: z.string().min(1), title: z.string().min(1),
});
write("research.propose", "Propose the trip changes a set of research files implies; writes nothing until applied.", ["trip.*", "catalog.*"], {
  slug, refs: z.array(id).optional(),
}, { tool: "propose_research_changes", phase: 2 }, 2);
write("proposal.apply", "Apply the chosen changes of a proposal by running their operations.", ["trip.*", "catalog.*"], {
  proposal_id: id, change_ids: z.array(id).optional(),
}, { tool: "apply_proposal", phase: 2 }, 2);
write("proposal.reject", "Reject a proposal or some of its changes.", ["trip.*"], { proposal_id: id, change_ids: z.array(id).optional() });

// ---- catalog (0A.2)
const ROW_ENTITIES = ["trails", "activities", "stays", "eateries", "offers", "legs"] as const;
const catalogRow = z.union(ROW_ENTITIES.map((e) => catTable(e).schema) as unknown as [z.ZodType, z.ZodType, ...z.ZodType[]]);
const subject = { entity: catalogEntity, id };
write("catalog.add", "Add a row to the shared catalog; lands as review_status proposed, confidence stated.", ["catalog.*"], { entity: z.enum(ROW_ENTITIES), row: catalogRow, reason: z.string().optional() });
write("catalog.edit", "Edit catalog fields with a reason; records the before and after in catalog_changes.", ["catalog.*"], { ...subject, patch: record, reason: z.string().min(1), source: z.string().nullable().optional() });
write("catalog.merge", "Merge a duplicate catalog row into another; the duplicate id goes to merged_from.", ["catalog.*"], { entity: catalogEntity, keep: id, drop: id, reason: z.string().min(1) });
write("catalog.retire", "Retire a catalog row (never a delete); needs the owner's confirmation.", ["catalog.*"], { ...subject, reason: z.string().min(1), confirmed: z.literal(true) });
write("catalog.verify", "Mark a catalog row verified by the actor, with the day.", ["catalog.*"], { ...subject, note: z.string().optional() });
write("catalog.propose", "Propose catalog changes from a research sidecar or a trip; writes nothing until applied.", ["catalog.*"], {
  sidecar: z.string().startsWith("research/").optional(), slug: slug.optional(), changes: z.array(record).optional(),
}, { tool: "propose_catalog_change", phase: 2 }, 2);
write("catalog.apply", "Apply a catalog proposal's accepted changes and append catalog_changes rows.", ["catalog.*"], { proposal_id: id, change_ids: z.array(id).optional() });
write("backlog.add", "Add a research backlog row.", ["catalog.backlog"], { row: catTable("backlog").schema });

// ---- inbox (Phase 2, plan section 9)
const inboxFields = { id, note: z.string().optional() };
write("inbox.add", "Add a capture (a shared link, a screenshot reference or text) to the inbox.", ["locations.places"], {
  text: z.string().optional(), url: z.string().regex(/^https?:\/\/\S+$/).optional(), screenshot: z.string().startsWith("research/inbox/").optional(),
}, { tool: "inbox_add", phase: 2 }, 2);
write("inbox.resolve", "Resolve an inbox capture into a place or trip row.", ["locations.places"], { ...inboxFields, place_id: id.optional() }, { tool: "inbox_resolve", phase: 2 }, 2);
write("inbox.dismiss", "Dismiss an inbox capture.", ["locations.places"], inboxFields, undefined, 2);

// ----------------------------------------------------------------------------- exports
/** the catalogue, sorted by name */
export const CATALOGUE: readonly OpEntry[] = [...ops].sort((a, b) => a.name.localeCompare(b.name));

export const OPS_BY_NAME: ReadonlyMap<string, OpEntry> = new Map(CATALOGUE.map((o) => [o.name, o]));

/** MCP tools: name -> {operation, phase} */
export function mcpTools(): { tool: string; phase: 1 | 2; op: OpEntry }[] {
  return CATALOGUE.filter((o) => o.mcp).map((o) => ({ tool: o.mcp!.tool, phase: o.mcp!.phase, op: o }));
}

// ----------------------------------------------------------------------------- JSON export
type Json = { [key: string]: any };

/** JSON Schema of an input or output schema (draft 2020-12, the same options as the entity export) */
export function opSchemaToJson(schema: z.ZodType, io: "input" | "output" = "input"): Json {
  const js = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    unrepresentable: "throw",
    override: (ctx) => {
      const s = ctx.jsonSchema as Json;
      if (s.format === "date" || s.format === "date-time") delete s.pattern;
      if (s.maximum === Number.MAX_SAFE_INTEGER) delete s.maximum;
      if (s.minimum === Number.MIN_SAFE_INTEGER) delete s.minimum;
    },
  }) as Json;
  delete js.$schema;
  return js;
}

/** data/schema/generated/ops.json: the catalogue sorted by name, input and output as JSON Schema */
export function buildOpsJson(): Json {
  return {
    $comment: "Generated by node core/bin/schema.ts generate from core/src/ops/catalogue.ts. Do not edit by hand.",
    operations: CATALOGUE.map((o) => ({
      name: o.name,
      summary: o.summary,
      kind: o.kind,
      phase: o.phase,
      tables: o.tables,
      ...(o.mcp ? { mcp: o.mcp } : {}),
      input: opSchemaToJson(o.input, "input"),
      output: opSchemaToJson(o.output, "output"),
    })),
  };
}

export function opsJsonText(): string {
  return JSON.stringify(buildOpsJson(), null, 2) + "\n";
}
