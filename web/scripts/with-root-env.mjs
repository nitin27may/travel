// Inject the root-level, git-ignored Neon env (written by `neon deploy`) into a child command's
// environment, so the Next.js app in web/ sees the connection strings at dev, build and start time
// without copying any secret into a tracked file. Root `npm run build`, `dev` and `start` delegate
// to the workspace web build through this wrapper.
//
// Precedence (highest wins):
//   1. the INHERITED process environment  (a real deployment / CI injects the vars directly and must
//      not be shadowed by a stale local file),
//   2. root `.env.local`                  (developer overrides; what `neon deploy` writes here),
//   3. root `.env`                         (the Neon CLI's base file, if present).
// So a value already present in the deployment environment is never overwritten by the local file.
//
// It never prints a secret value. It also mints a local Managed Better Auth cookie secret on first
// use (the one secret `neon deploy` does not provide) and appends it to the local file, mode 600.
//
// Usage: node web/scripts/with-root-env.mjs <command> [args...]

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(web, '..');
// Base first, then `.env.local` overrides it (standard dotenv precedence).
const baseEnvPath = path.join(root, '.env');
const localEnvPath = path.join(root, '.env.local');

/** Read and parse a dotenv file with node:util parseEnv; {} when the file is absent. */
function readEnvFile(file) {
  return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
}

// Merge the files (local over base). The inherited process.env is layered on top later, so it wins.
const fileEnv = { ...readEnvFile(baseEnvPath), ...readEnvFile(localEnvPath) };
if (!existsSync(baseEnvPath) && !existsSync(localEnvPath)) {
  console.warn(`[with-root-env] no ${path.relative(process.cwd(), localEnvPath)} or .env; running with the inherited environment only.`);
}

// The effective auth base url, honouring that inherited env wins over the file.
const authBaseUrl = process.env.NEON_AUTH_BASE_URL ?? fileEnv.NEON_AUTH_BASE_URL;
const cookieSecretPresent = Boolean(process.env.NEON_AUTH_COOKIE_SECRET || fileEnv.NEON_AUTH_COOKIE_SECRET);

// Mint the Managed Better Auth cookie secret locally if it is missing everywhere (never printed).
// Only when auth is configured and there is a local file to persist it to (so it is stable across runs).
if (!cookieSecretPresent && authBaseUrl) {
  const target = existsSync(localEnvPath) ? localEnvPath : existsSync(baseEnvPath) ? baseEnvPath : null;
  if (target) {
    const secret = randomBytes(32).toString('base64');
    appendFileSync(target, `\nNEON_AUTH_COOKIE_SECRET=${secret}\n`);
    chmodSync(target, 0o600);
    fileEnv.NEON_AUTH_COOKIE_SECRET = secret;
    console.warn('[with-root-env] minted a local NEON_AUTH_COOKIE_SECRET (value not printed).');
  } else {
    console.warn('[with-root-env] NEON_AUTH_COOKIE_SECRET is missing and no local env file exists to persist one; auth routes will fail closed.');
  }
}

// Inherited env wins over the file. NEXT_PUBLIC_SIGN_IN (a flag, not a secret) turns the account
// path on only when Managed Better Auth is configured; an explicit inherited value is respected.
const childEnv = { ...fileEnv, ...process.env };
if (childEnv.NEXT_PUBLIC_SIGN_IN === undefined || childEnv.NEXT_PUBLIC_SIGN_IN === '') {
  childEnv.NEXT_PUBLIC_SIGN_IN = authBaseUrl ? '1' : '';
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('[with-root-env] usage: node web/scripts/with-root-env.mjs <command> [args...]');
  process.exit(2);
}

const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: childEnv, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
