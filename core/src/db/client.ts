// Lazy Postgres connection pool and a single-pool runtime client.
//
// `pg` is loaded with a dynamic import so that pure modules (loader, runner, inventory) and their
// tests never require the driver, and so the package stays an app-lane dependency (owned by the app
// lane). The runtime app and the migration CLI both obtain their pool here. Secrets are read from
// the environment at call time and never logged.
//
// Two distinct connection intents:
//   - MIGRATIONS run as the database owner (neondb_owner) over a *direct* (unpooled) connection,
//     because DDL and advisory locks want a stable session. Use DATABASE_URL_UNPOOLED.
//   - RUNTIME traffic runs over the *pooled* connection (DATABASE_URL) and, inside every
//     transaction, drops to the non-owner, NOBYPASSRLS role so RLS applies (see tx.ts).

/** A result row. Column names are not known at compile time, so values are `unknown` (not `any`). */
export type QueryRow = Record<string, unknown>;

/** The subset of `pg`'s `QueryResult` the lane relies on, parameterised by the row shape. */
export interface QueryResultLike<Row extends QueryRow = QueryRow> {
  rows: Row[];
  /** Number of rows affected; `null` for statements that do not report it (mirrors `pg`). */
  rowCount: number | null;
  command: string;
}

/** Structural view of `pg.Pool` with a row-generic `query` (satisfied by the real pg Pool). */
export interface PgLike {
  query<Row extends QueryRow = QueryRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResultLike<Row>>;
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
}

/** Structural view of `pg.PoolClient` / `pg.Client`. */
export interface PgClientLike {
  query<Row extends QueryRow = QueryRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResultLike<Row>>;
  release(): void;
}

/** A direct `pg.Client`: a client that must be explicitly connected and ended. */
export interface PgDirectClient extends Omit<PgClientLike, "release"> {
  connect(): Promise<void>;
  end(): Promise<void>;
}

type PgModule = {
  Pool: new (config: { connectionString: string; max?: number }) => PgLike;
  Client: new (config: { connectionString: string }) => PgDirectClient;
};

let pgModulePromise: Promise<PgModule> | undefined;

// A non-literal specifier so the type checker does not try to resolve `pg` (the app lane owns that
// dependency); at runtime Node still resolves the string "pg".
const PG_SPECIFIER = "pg";

/** Dynamically import `pg`, with a clear error if the app lane has not added the dependency yet. */
export async function loadPg(): Promise<PgModule> {
  if (!pgModulePromise) {
    pgModulePromise = import(PG_SPECIFIER).then(
      (m: any) => (m.default ?? m) as PgModule,
      (err: unknown) => {
        pgModulePromise = undefined;
        throw new Error(
          `the 'pg' driver is not installed. The app lane owns package manifests; ask it to add ` +
            `'pg' (and '@types/pg') to the core workspace root. Underlying error: ${(err as Error).message}`,
        );
      },
    );
  }
  return pgModulePromise;
}

const pools = new Map<string, PgLike>();

/** Resolve the connection string for an intent from the environment. */
export function connectionString(intent: "runtime" | "migration" = "runtime"): string {
  const key = intent === "migration" ? "DATABASE_URL_UNPOOLED" : "DATABASE_URL";
  const url = process.env[key] ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(`${key} is not set; cannot connect to Postgres for ${intent}.`);
  }
  return url;
}

/**
 * Get (or lazily create) a shared pool for the given connection string. Pools are cached so the
 * runtime app reuses one pool per process. Pass an explicit string in tests.
 */
export async function getPool(url = connectionString("runtime")): Promise<PgLike> {
  let pool = pools.get(url);
  if (!pool) {
    const { Pool } = await loadPg();
    pool = new Pool({ connectionString: url, max: 10 });
    pools.set(url, pool);
  }
  return pool;
}

/** Open a single direct client (for migrations). Caller must call `.end()`/release. */
export async function getClient(url = connectionString("migration")): Promise<PgDirectClient> {
  const { Client } = await loadPg();
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * Extract a Postgres SQLSTATE code from an error for *safe* logging. Returns only the five-character
 * SQLSTATE (or `"unknown"`) — never the message, query text, parameters, or connection secrets.
 */
export function pgErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Za-z]{5}$/.test(code)) return code;
  }
  return "unknown";
}

/** Close every cached pool (tests, graceful shutdown). */
export async function closePools(): Promise<void> {
  await Promise.all([...pools.values()].map((p) => p.end().catch(() => {})));
  pools.clear();
}
