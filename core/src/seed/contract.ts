// The seed contract (LOCAL-C; docs/v2/features/local-database-and-seed-sync.md 2.1, 2.4, 2.5, 6.2 to 6.5). What a seed run IS,
// as data the engine, the drift gate and the tests read. No I/O here: the engine (LOCAL-2, RIS-L) reads files and talks to Postgres;
// this module only says which tables it may touch, from which files, in which order, keyed how, and what it does with a row the
// seed no longer has.
//
// The rules, in one place:
//   1. The JSON in git is the seed of record. A row is a pure function of one commit of data/**.
//   2. A table not in SEED_TABLES is never read, written or truncated by the engine. NOT_SEEDED classifies every other table of the
//      migrations, with the reason; a test fails when a migration adds a table that is in neither list.
//   3. Retire, never delete: a row other tables point at (a user's saved place, a booking, a retired row's own references) is never
//      deleted by a sync. `onMissing` says what happens to a target row the seed no longer has.
//   4. Idempotent: the same commit gives the same rows and the same content hashes (./hash.ts); a second sync writes 0 rows.
//   5. Stamped: every row the engine writes on a META_TABLES table carries meta.run_id and meta.imported_from (after the RowMeta
//      migration lands; until then the run is recorded as the catalogue_meta key SEED_COMMIT_KEY).
import { META_TABLES } from "../schema/rowMeta.ts";

/** Bump when a table, key, order or rule below changes meaning. The engine writes it into the run record. */
export const SEED_CONTRACT_VERSION = 1;

/** Which table family a seed table belongs to (spec 2.4, 6.5). */
export const SEED_FAMILIES = [
  "vocab", "geography", "reference", "catalogue", "sidecar", "source_tier", "evidence", "research", "cache", "rules", "projection",
  "revision",
] as const;
export type SeedFamily = (typeof SEED_FAMILIES)[number];

/**
 * How a table is kept in step with the seed.
 *   mirror       insert, update, and `onMissing` for rows the seed no longer has
 *   append_only  insert only; a row is never updated (its key is its content hash) and never removed (evidence history)
 *   cache        mirror, but the rows are a cache the engine may rebuild (stored legs)
 *   derived      computed from the seed by the same core code JsonStore uses; written after every source table
 *   revision     the catalogue revision key-value rows, written last in the same transaction
 */
export type SeedMode = "mirror" | "append_only" | "cache" | "derived" | "revision";

/**
 * What a sync does with a target row whose key the seed no longer has.
 *   retire  set `retire.column` to `retire.value`; the row stays, so every reference to it stays (saved_place cascades on delete)
 *   keep    leave the row as it is and count it as retained (no status column yet, or append-only history)
 *   delete  delete it (catalogue-owned rows nothing outside the seed points at)
 */
export type OnMissing = "retire" | "keep" | "delete";

/** The task that writes the table's family (spec section 8). */
export type SeedOwner = "LOCAL-2" | "RIS-L" | "STY-L";

/** How a row's own key is formed, for the record ids the plan prints (spec 2.5). */
export type SeedIdentity =
  | "ref" // the capture ref, verbatim (entity.id = ref; never rewritten)
  | "id" // the file's own id (type node, area, town, source registry id, run id, changeset id)
  | "key" // a vocabulary key
  | "path" // a repository path (dataset_file.id, track.id)
  | "slug" // a pinned slug from the slug registry (projections); never minted by the engine
  | "derived" // a stable id the engine derives from natural parts with derivedId() (./hash.ts)
  | "content_hash" // the sha256 of the row's canonical content (append-only evidence)
  | "composite"; // the primary key is more than one column

/**
 * A repository path pattern the family reads. `*` matches within one path segment (no `**`). `sections` limits what is read from
 * a JSON file to these top-level keys (the locations store: its public country, region and area chain only).
 */
export interface SeedInput {
  glob: string;
  exclude?: readonly string[];
  sections?: readonly string[];
  /** the folder may not exist yet (a family whose files are still planned) */
  optional?: boolean;
}

export interface SeedTableSpec {
  table: string;
  family: SeedFamily;
  owner: SeedOwner;
  /** the files the rows come from; empty for derived and revision tables, which are computed */
  inputs: readonly SeedInput[];
  /** the primary or natural key columns, in key order */
  key: readonly string[];
  identity: SeedIdentity;
  mode: SeedMode;
  onMissing: OnMissing;
  /** the column and value a retire writes (only with onMissing `retire`) */
  retire?: { column: string; value: string; live: string };
  /** array columns whose order carries no meaning: sorted before hashing so a reorder is not a change (spec 2.1 rule 3) */
  setColumns?: readonly string[];
  /** geometry columns: hashed as WKT with SEED_COORD_DECIMALS (./hash.ts) */
  geometryColumns?: readonly string[];
  /** a short note for the reader of the plan */
  note?: string;
}

// ---- inputs, named once ------------------------------------------------------------------------------------------------------------
const LANES: SeedInput = {
  glob: "data/capture/*/*.json",
  exclude: ["data/capture/runs/*.json", "data/capture/splits/*.json", "data/capture/changesets/*.json"],
};
const SUITABILITY: SeedInput = { glob: "data/suitability/*/*.json" };
const RELEVANCE: SeedInput = {
  glob: "data/relevance/*/*.json",
  exclude: ["data/relevance/derived/*.json", "data/relevance/inputs/*.json", "data/relevance/signals/*.json"],
};
const POINTS: SeedInput = { glob: "data/capture/points.json" };
const SLUGS: SeedInput = { glob: "data/catalogue/slugs.json" };
const RUNS: SeedInput = { glob: "data/capture/runs/*.json" };
const CHANGESETS: SeedInput = { glob: "data/capture/changesets/*.json", optional: true };
const TRIP_LEVEL: readonly SeedInput[] = [
  { glob: "data/windows/*.json" },
  { glob: "data/base-plans/*.json" },
  { glob: "data/seasons/*.json" },
  { glob: "data/capture/splits/*.json" },
];
/** Every file whose verbatim copy goes to the source tier (dataset_file, record_doc). */
const SOURCE_TIER_FILES: readonly SeedInput[] = [LANES, SUITABILITY, RELEVANCE, ...TRIP_LEVEL];

const live = { column: "status", value: "retired", live: "published" } as const;

/**
 * Every table a seed run may touch, IN APPLY ORDER (spec 6.5). Inserts and updates run top to bottom inside one transaction under
 * SEED_ADVISORY_LOCK_KEY; deletes run bottom to top (DELETE_ORDER), so a child row goes before the row it points at. catalogue_meta
 * (the revision) is last, so a reader sees one revision. The order is a topological order of the foreign keys in the migrations
 * (tested).
 */
export const SEED_TABLES: readonly SeedTableSpec[] = [
  // vocab
  { table: "type_node", family: "vocab", owner: "LOCAL-2", inputs: [{ glob: "data/vocab/types.json" }], key: ["id"], identity: "id", mode: "mirror", onMissing: "keep", setColumns: ["records"], note: "kept: a retired entity still points at its type" },
  { table: "tag", family: "vocab", owner: "LOCAL-2", inputs: [{ glob: "data/vocab/tags.json" }], key: ["id"], identity: "key", mode: "mirror", onMissing: "delete" },
  { table: "relevance_class", family: "vocab", owner: "LOCAL-2", inputs: [{ glob: "data/vocab/relevance-classes.json" }], key: ["key"], identity: "key", mode: "mirror", onMissing: "delete" },
  // geography and reference
  {
    table: "area", family: "geography", owner: "LOCAL-2",
    inputs: [{ glob: "data/reference/countries.json" }, { glob: "data/locations/locations.json", sections: ["countries", "regions", "areas"] }],
    key: ["id"], identity: "id", mode: "mirror", onMissing: "keep", geometryColumns: ["centre", "boundary"],
    note: "kept: trips, candidates and coverage point at areas; no status column",
  },
  {
    table: "town", family: "geography", owner: "LOCAL-2",
    inputs: [{ glob: "data/reference/towns/*.json", exclude: ["data/reference/towns/anchors.json"] }],
    key: ["id"], identity: "id", mode: "mirror", onMissing: "keep", geometryColumns: ["point"],
    note: "kept: a retired entity still points at its near town",
  },
  { table: "operator", family: "reference", owner: "LOCAL-2", inputs: [{ glob: "data/capture/operators.json" }], key: ["ref"], identity: "ref", mode: "mirror", onMissing: "keep", note: "kept: a retired offer still points at its operator" },
  { table: "source", family: "reference", owner: "LOCAL-2", inputs: [{ glob: "data/sources/registry.json" }], key: ["id"], identity: "id", mode: "mirror", onMissing: "keep", note: "generated file: read only after the source registry check passes; kept: evidence history and document rules point at sources" },
  // catalogue
  {
    table: "entity", family: "catalogue", owner: "RIS-L", inputs: [LANES, POINTS, SLUGS, { glob: "data/capture/placement.json" }, { glob: "data/capture/type-map.json" }],
    key: ["id"], identity: "ref", mode: "mirror", onMissing: "retire", retire: live, setColumns: ["tags"], geometryColumns: ["point", "shape"],
    note: "id = ref verbatim; slug only from the slug registry; never deleted (saved_place, trip_item, reservation point here)",
  },
  { table: "offer", family: "catalogue", owner: "RIS-L", inputs: [LANES], key: ["entity_id"], identity: "ref", mode: "mirror", onMissing: "retire", retire: live, note: "never deleted (trip_item and reservation point here)" },
  { table: "entity_alias", family: "catalogue", owner: "RIS-L", inputs: [SLUGS], key: ["alias"], identity: "id", mode: "mirror", onMissing: "delete", note: "merged and former keys of the slug registry" },
  { table: "relation", family: "catalogue", owner: "RIS-L", inputs: [LANES], key: ["from_id", "to_id", "kind"], identity: "composite", mode: "mirror", onMissing: "delete" },
  { table: "entity_link", family: "catalogue", owner: "RIS-L", inputs: [LANES, { glob: "data/sources/links.json" }], key: ["id"], identity: "derived", mode: "mirror", onMissing: "delete", setColumns: ["src"], note: "id = derivedId('lnk', [entity_id, kind, url or query])" },
  { table: "media", family: "catalogue", owner: "RIS-L", inputs: [LANES], key: ["id"], identity: "derived", mode: "mirror", onMissing: "delete", note: "id = derivedId('med', [entity_id, storage, key]); a row points at a file, never the bytes" },
  { table: "track", family: "catalogue", owner: "RIS-L", inputs: [{ glob: "data/tracks/*.json", exclude: ["data/tracks/inputs.json"] }], key: ["id"], identity: "path", mode: "mirror", onMissing: "delete", geometryColumns: ["geom"] },
  // sidecars
  { table: "suitability", family: "sidecar", owner: "RIS-L", inputs: [SUITABILITY], key: ["ref"], identity: "ref", mode: "mirror", onMissing: "delete" },
  { table: "relevance", family: "sidecar", owner: "RIS-L", inputs: [RELEVANCE], key: ["ref"], identity: "ref", mode: "mirror", onMissing: "delete" },
  { table: "relevance_signal", family: "sidecar", owner: "RIS-L", inputs: [{ glob: "data/relevance/signals/*.json" }], key: ["source", "key"], identity: "composite", mode: "mirror", onMissing: "delete" },
  // source tier (verbatim)
  { table: "dataset_file", family: "source_tier", owner: "RIS-L", inputs: SOURCE_TIER_FILES, key: ["id"], identity: "path", mode: "mirror", onMissing: "delete", note: "id = repo path; deleting one cascades its record_doc and source_local rows" },
  { table: "record_doc", family: "source_tier", owner: "RIS-L", inputs: SOURCE_TIER_FILES, key: ["file_id", "ref"], identity: "composite", mode: "mirror", onMissing: "delete" },
  { table: "source_local", family: "source_tier", owner: "RIS-L", inputs: [LANES, SUITABILITY, RELEVANCE], key: ["file_id", "local_id"], identity: "composite", mode: "mirror", onMissing: "delete" },
  { table: "capture_supersede", family: "source_tier", owner: "RIS-L", inputs: [{ glob: "data/capture/supersedes.json" }], key: ["id"], identity: "id", mode: "mirror", onMissing: "delete" },
  // evidence (append only)
  { table: "evidence", family: "evidence", owner: "RIS-L", inputs: [LANES, SUITABILITY, RELEVANCE, POINTS], key: ["id"], identity: "content_hash", mode: "append_only", onMissing: "keep", note: "never updated, never removed; a refreshed reading is a new row and the old one gets superseded_at" },
  // research
  { table: "research_job", family: "research", owner: "RIS-L", inputs: [RUNS], key: ["id"], identity: "id", mode: "mirror", onMissing: "delete", note: "id = the run id" },
  { table: "changeset", family: "research", owner: "RIS-L", inputs: [CHANGESETS], key: ["id"], identity: "id", mode: "mirror", onMissing: "delete" },
  { table: "change", family: "research", owner: "RIS-L", inputs: [CHANGESETS], key: ["id"], identity: "derived", mode: "mirror", onMissing: "delete", note: "id = derivedId('chg', [changeset id, index])" },
  { table: "research_gap", family: "research", owner: "RIS-L", inputs: [RUNS], key: ["id"], identity: "derived", mode: "mirror", onMissing: "delete", note: "id = derivedId('gap', [run id, ref, field])" },
  // cache and rules
  { table: "leg_cache", family: "cache", owner: "STY-L", inputs: [{ glob: "data/schedules/legs/*.json", exclude: ["data/schedules/legs/*.unrouted.json"] }], key: ["from_cell", "to_cell", "mode"], identity: "composite", mode: "cache", onMissing: "delete" },
  { table: "freshness_rule", family: "rules", owner: "RIS-L", inputs: [{ glob: "data/schema/freshness.json" }], key: ["field_prefix"], identity: "key", mode: "mirror", onMissing: "delete" },
  // projections (computed by the public-data code, never hand-loaded)
  { table: "place_row", family: "projection", owner: "RIS-L", inputs: [], key: ["slug"], identity: "slug", mode: "derived", onMissing: "delete", geometryColumns: ["point"] },
  { table: "place_page", family: "projection", owner: "RIS-L", inputs: [], key: ["slug"], identity: "slug", mode: "derived", onMissing: "delete" },
  { table: "trip_row", family: "projection", owner: "RIS-L", inputs: [], key: ["slug"], identity: "slug", mode: "derived", onMissing: "delete" },
  { table: "trip_page", family: "projection", owner: "RIS-L", inputs: [], key: ["slug"], identity: "slug", mode: "derived", onMissing: "delete" },
  { table: "relevance_derived", family: "projection", owner: "RIS-L", inputs: [], key: ["trip_slug", "ref"], identity: "composite", mode: "derived", onMissing: "delete", note: "rebuilt from the sidecars, not loaded from data/relevance/derived" },
  // revision, last
  { table: "catalogue_meta", family: "revision", owner: "LOCAL-2", inputs: [], key: ["key"], identity: "key", mode: "revision", onMissing: "keep", note: "the revision and SEED_COMMIT_KEY, written last in the same transaction" },
];

/** Deletes run in the reverse of the apply order. */
export const DELETE_ORDER: readonly string[] = [...SEED_TABLES].reverse().map((t) => t.table);

/** Until the RowMeta migration adds `load_run`, the engine records the commit it loaded under this catalogue_meta key. */
export const SEED_COMMIT_KEY = "seed_commit";
/** The run-record table the RowMeta migration adds; not a seed table (the engine writes one row per run, never from the JSON). */
export const LOAD_RUN_TABLE = "load_run";

// ---- what is never seeded ----------------------------------------------------------------------------------------------------------
/**
 * Why a table is not seeded.
 *   account      accounts, sessions, tokens, settings: written only by sign-in and the account routes
 *   plan         the user's drafts, trips and everything under a trip
 *   household    household members, wishlist status, saved places and sources, visits, collections
 *   operational  counters, quotas, the op log, coverage and the work backlog: written by the running system
 *   unsourced    catalogue or reference tables with no JSON family yet; adding a family moves the table into SEED_TABLES on purpose
 */
export type NotSeededClass = "account" | "plan" | "household" | "operational" | "unsourced";
/** The classes that hold a person's data. A table of these classes is private: never read, written, truncated or exported. */
export const PRIVATE_CLASSES: readonly NotSeededClass[] = ["account", "plan", "household"];

export interface NotSeeded {
  class: NotSeededClass;
  reason: string;
}

/**
 * Every application table the engine never touches, with why (spec 6.2). Together with SEED_TABLES this covers ALL_APP_TABLES and
 * RLS_EXEMPT_TABLES exactly (tested), so a new private table cannot slip through unclassified.
 */
export const NOT_SEEDED: Readonly<Record<string, NotSeeded>> = {
  // accounts
  app_user: { class: "account", reason: "the account row, written at sign-in" },
  user_settings: { class: "account", reason: "a user's settings" },
  mcp_token: { class: "account", reason: "token hashes" },
  push_subscription: { class: "account", reason: "push endpoints and keys" },
  notification_pref: { class: "account", reason: "a user's notification choices" },
  inbound_address: { class: "account", reason: "a user's inbound mail address" },
  inbound_email: { class: "account", reason: "a user's forwarded mail" },
  // plans and drafts
  planner_draft: { class: "plan", reason: "a user's private draft" },
  planner_draft_signal: { class: "plan", reason: "the content-free live signal of a user's draft" },
  trip: { class: "plan", reason: "a user's trip (the public trip pages are the trip_row and trip_page projections)" },
  trip_member: { class: "plan", reason: "who is on a trip" },
  traveller: { class: "plan", reason: "a trip's travellers" },
  trip_candidate: { class: "plan", reason: "a trip's shortlist" },
  trip_list: { class: "plan", reason: "a trip's lists" },
  trip_item: { class: "plan", reason: "a trip's items" },
  reservation: { class: "plan", reason: "bookings" },
  reservation_secret: { class: "plan", reason: "confirmation codes" },
  reservation_segment: { class: "plan", reason: "booking segments" },
  reservation_traveller: { class: "plan", reason: "who a booking is for" },
  day_note: { class: "plan", reason: "a trip's notes" },
  task: { class: "plan", reason: "a trip's tasks" },
  reminder: { class: "plan", reason: "a trip's reminders" },
  attachment: { class: "plan", reason: "a trip's files" },
  budget_line: { class: "plan", reason: "a trip's budget" },
  expense: { class: "plan", reason: "a trip's spending" },
  day_state: { class: "plan", reason: "a trip day's live state" },
  check_dismissal: { class: "plan", reason: "a user's dismissed checks" },
  item_memory: { class: "plan", reason: "a user's memories of a trip item" },
  share_link: { class: "plan", reason: "share tokens" },
  calendar_feed: { class: "plan", reason: "calendar tokens" },
  template_update_decision: { class: "plan", reason: "a trip's template choices" },
  // household
  household: { class: "household", reason: "the household" },
  household_member: { class: "household", reason: "household members" },
  person: { class: "household", reason: "people: names, ages, heights, weights" },
  membership: { class: "household", reason: "who belongs to which household" },
  travel_goal: { class: "household", reason: "a household's goals" },
  saved_place: { class: "household", reason: "wishlist status on catalogue places (cascades on entity delete: hence retire, never delete)" },
  saved_view: { class: "household", reason: "a user's saved filters" },
  saved_source: { class: "household", reason: "the owner's saved posts (private list origin)" },
  visit: { class: "household", reason: "the owner's visits" },
  collection: { class: "household", reason: "the owner's collections" },
  collection_place: { class: "household", reason: "places in the owner's collections" },
  calendar_window: { class: "household", reason: "holiday windows; custom rows carry a household" },
  // operational
  op_event: { class: "operational", reason: "the operation log: actors, trips, inverses" },
  fx_rate: { class: "operational", reason: "rates fetched by the running system" },
  coverage: { class: "operational", reason: "computed coverage scores" },
  backlog: { class: "operational", reason: "the research work queue" },
  quota_bucket: { class: "operational", reason: "auth guard quotas (EML-Q)" },
  // unsourced: no JSON family yet
  condition_report: { class: "unsourced", reason: "closures and warnings: no JSON family until closures get a home (RIS-H)" },
  event_occurrence: { class: "unsourced", reason: "event dates: no JSON family yet" },
  pack_template: { class: "unsourced", reason: "packing templates: no JSON family yet" },
  document_rule: { class: "unsourced", reason: "entry document rules: no JSON family yet" },
  lane: { class: "unsourced", reason: "research lane contracts: no JSON family yet" },
  trip_type: { class: "unsourced", reason: "trip type defaults: no JSON family yet" },
};

/**
 * Tables classified above that the migrations on main do not create yet, named by the specs that will add them. Listed so the branch
 * that adds one merges already classified (EML-1's quota table). A test checks every classified table is in the inventory or here.
 */
export const FUTURE_TABLES: readonly string[] = ["quota_bucket"];

/** Schemas the engine never reads or writes. `neon_auth` belongs to Managed Better Auth. */
export const NEVER_TOUCH_SCHEMAS: readonly string[] = ["neon_auth"];

/**
 * Files no seed family may read, whatever a glob says: the owner's private list and its derivatives, repository-only ledgers and
 * budgets, and local-only inputs. The engine refuses a resolved input path that matches one (E_SEED_DENIED_INPUT).
 */
export const NEVER_READ_INPUTS: readonly string[] = [
  "research/inbox/*",
  "data/capture/migration-ledger.json",
  "data/capture/gap-budget.json",
  "data/relevance/inputs/*.local.json",
  "data/reference/towns/anchors.json",
  "data/locations/WISHLIST.md",
];

/**
 * Keys that never appear in a seeded row at any depth: the owner's list origin and wishlist fields (PRIV1, spec 6.2). A row
 * carrying one, or a `loc:` or `proto:` key in any string (ORIGIN_REF in core/src/privacy/detect.ts), is refused (./privacy.ts).
 */
export const SEED_FORBIDDEN_KEYS: readonly string[] = [
  "location_status", "contributed_by", "post_date", "saved", "screenshot", "sourceTypes", "stayStatus", "notes_private",
];

// ---- lookups -----------------------------------------------------------------------------------------------------------------------
const BY_TABLE = new Map(SEED_TABLES.map((t) => [t.table, t]));

/** The seed spec of a table, or undefined when the engine must not touch it. */
export function seedSpec(table: string): SeedTableSpec | undefined {
  return BY_TABLE.get(table);
}

/** True when the table is one the engine may read and write. */
export const isSeedTable = (table: string): boolean => BY_TABLE.has(table);

/** True when the table holds a person's data (accounts, plans, household). */
export function isPrivateTable(table: string): boolean {
  const c = NOT_SEEDED[table]?.class;
  return c !== undefined && PRIVATE_CLASSES.includes(c);
}

/** True when the table carries a RowMeta `meta` column (after the RowMeta migration), so its rows are stamped. */
export const isStampedTable = (table: string): boolean => (META_TABLES as readonly string[]).includes(table);

export class SeedContractError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SeedContractError";
  }
}

/**
 * The engine calls this before any statement that touches a table. Throws for a table outside SEED_TABLES (private or not), so a
 * bug in a family can never write, truncate or delete a user's rows.
 */
export function assertSeedTable(table: string): SeedTableSpec {
  const spec = BY_TABLE.get(table);
  if (!spec) {
    const why = NOT_SEEDED[table];
    throw new SeedContractError(
      "E_SEED_TABLE",
      why ? `the seed never touches ${table} (${why.class}: ${why.reason})` : `${table} is not a seed table and is not classified`,
    );
  }
  return spec;
}

/**
 * The engine calls this before any DELETE. Refuses a table whose rows are retired or kept, and refuses TRUNCATE outright: a
 * truncate of a referenced table would cascade into private rows.
 */
export function assertDeletable(table: string): SeedTableSpec {
  const spec = assertSeedTable(table);
  if (spec.onMissing !== "delete") {
    throw new SeedContractError(
      "E_SEED_NEVER_DELETE",
      spec.onMissing === "retire"
        ? `rows of ${table} are retired (${spec.retire?.column} = '${spec.retire?.value}'), never deleted`
        : `rows of ${table} are kept, never deleted`,
    );
  }
  return spec;
}
