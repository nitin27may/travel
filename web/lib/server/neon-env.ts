import 'server-only';

/**
 * Runtime reader for the Neon service environment. Read at first use, never at module scope:
 * `next build` imports these modules without the runtime secrets, so reading eagerly would make
 * a public build fail. Every getter throws a clear, secret-free error when a required variable is
 * missing, so private routes fail closed instead of half-rendering.
 *
 * Secrets never cross to the browser: this file is `server-only`, and the Realtime URL is passed
 * to the client as a prop (never a `NEXT_PUBLIC_` copy of the secret).
 */

export class NeonNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Neon services are not configured: missing ${missing.join(', ')}.`);
    this.name = 'NeonNotConfiguredError';
  }
}

function require_(keys: string[]): Record<string, string> {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) throw new NeonNotConfiguredError(missing);
  return Object.fromEntries(keys.map((k) => [k, process.env[k] as string]));
}

/** True when the auth service is configured. Used to fail closed without throwing. */
export function authConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}

/** True when the Postgres + Realtime services are configured. */
export function dataConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.NEON_REALTIME_URL && process.env.NEON_REALTIME_SECRET);
}

export function authEnv(): { baseUrl: string; cookieSecret: string } {
  const e = require_(['NEON_AUTH_BASE_URL', 'NEON_AUTH_COOKIE_SECRET']);
  return { baseUrl: e.NEON_AUTH_BASE_URL, cookieSecret: e.NEON_AUTH_COOKIE_SECRET };
}

/**
 * The PostgreSQL database name, parsed from the pooled connection string (Realtime needs it).
 * Fails explicitly rather than guessing a fallback: a malformed or name-less URL means the service
 * is misconfigured, and silently defaulting would seal Realtime tokens against the wrong database.
 * The thrown error never echoes the connection string (it carries credentials).
 */
export function databaseName(connectionString: string): string {
  let pathname: string;
  try {
    pathname = new URL(connectionString).pathname;
  } catch {
    throw new NeonNotConfiguredError(['DATABASE_URL (not a valid URL)']);
  }
  const name = pathname.replace(/^\//, '');
  if (!name) throw new NeonNotConfiguredError(['DATABASE_URL (no database name)']);
  return name;
}

export function dataEnv(): { databaseUrl: string; realtimeUrl: string; realtimeSecret: string; database: string } {
  const e = require_(['DATABASE_URL', 'NEON_REALTIME_URL', 'NEON_REALTIME_SECRET']);
  return {
    databaseUrl: e.DATABASE_URL,
    realtimeUrl: e.NEON_REALTIME_URL,
    realtimeSecret: e.NEON_REALTIME_SECRET,
    database: databaseName(e.DATABASE_URL),
  };
}
