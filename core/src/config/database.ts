// Database targets and the seed, each value defined once (LOCAL-C; docs/v2/features/local-database-and-seed-sync.md 3.1, 3.3,
// 6.1). Pure and framework-free: the seed guard (core/src/seed/guard.ts), the local target resolver and the seed engine read the
// same numbers. None of these is a secret. Neon endpoint and branch ids name a database; they open nothing without the password,
// which lives only in the ignored env file and is never read by this module.

/** The Neon project (Free plan, aws-us-east-2). */
export const NEON_PROJECT_ID = "damp-queen-64719841";
/** The production branch (`production`, the project's default branch). */
export const NEON_PRODUCTION_BRANCH_ID = "br-soft-glade-b4mkqyvd";
/**
 * The compute endpoint of the production branch: the first DNS label of its host, without the `-pooler` suffix of the pooled
 * host. Any host whose endpoint label equals this is production, whatever the caller calls it.
 */
export const NEON_PRODUCTION_ENDPOINT_ID = "ep-quiet-leaf-b4oz2a4v";
/** The one child branch (`srv-migrate-verify`, child of production): Auth and Realtime spikes, the child DB suite, rehearsals. */
export const NEON_CHILD_BRANCH_ID = "br-damp-breeze-b41mtvn5";
/** Every Neon host ends with this. A host with this suffix is never a local target. */
export const NEON_HOST_SUFFIX = ".neon.tech";
/** The pooled host of an endpoint is `<endpoint>-pooler.<region>...`; the label is stripped of this to get the endpoint id. */
export const NEON_POOLER_SUFFIX = "-pooler";

/** Hosts that are this machine. A loopback target is `local` (or `ci`, a service container mapped to loopback). */
export const LOOPBACK_HOSTS: readonly string[] = ["127.0.0.1", "localhost", "::1", "[::1]"];
/** The local Docker Postgres listens on loopback only, on this port (not 5432, where a Homebrew server could sit). */
export const LOCAL_DB_HOST = "127.0.0.1";
export const LOCAL_DB_PORT = 54329;

/**
 * The keys of the ignored root env file whose HOSTS are production. Only the host part of each value is ever read (never the user
 * or the password), so the guard knows production even if the endpoint above changes before this file does.
 */
export const PRODUCTION_ENV_KEYS: readonly string[] = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"];

/** The session advisory lock a seed or sync holds for its whole transaction. Different from the migration runner's key. */
export const SEED_ADVISORY_LOCK_KEY = 4873559201848n;

/**
 * Where a child rehearsal writes its evidence file, `<dir>/<commit>.json` (repo-relative, under the already ignored tool cache, so
 * it is never committed). The production guard reads it before any connection is made.
 */
export const REHEARSAL_EVIDENCE_DIR = "tools/.cache/db-rehearsal";
/** A rehearsal older than this does not count: production may have moved since (new accounts, a migration). */
export const REHEARSAL_MAX_AGE_HOURS = 72;
/** A rehearsal that finished more than this many minutes in the future (clock skew) is refused as impossible. */
export const REHEARSAL_CLOCK_SKEW_MIN = 5;

/** Decimal places of a coordinate in the canonical form of a geometry (WKT), so a read-back point hashes as the seed's did. */
export const SEED_COORD_DECIMALS = 7;
/** A dry run prints at most this many record ids per table and change kind (spec 6.4). */
export const PLAN_SAMPLE_IDS = 20;
