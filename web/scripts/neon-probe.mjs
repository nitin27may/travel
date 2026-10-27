// Opt-in Neon service readiness probe. Prints only booleans/counts/names — never secret values.
// Run via the root-env wrapper so it sees the real (mode-600) env:
//   node web/scripts/with-root-env.mjs node web/scripts/neon-probe.mjs
import { Client } from 'pg';

const out = {};

async function checkDb() {
  const url = process.env.DATABASE_URL;
  out.databaseUrlPresent = !!url;
  if (!url) return;
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    out.dbConnect = true;
    const t = await client.query(
      "SELECT to_regclass('public.plan_draft') IS NOT NULL AS exists",
    );
    out.plannerDraftTable = t.rows[0].exists;
    if (t.rows[0].exists) {
      const cols = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='plan_draft' ORDER BY ordinal_position",
      );
      out.plannerDraftColumns = cols.rows.map((r) => `${r.column_name}:${r.data_type}`);
      const rls = await client.query(
        "SELECT relrowsecurity FROM pg_class WHERE oid='public.plan_draft'::regclass",
      );
      out.plannerDraftRls = rls.rows[0]?.relrowsecurity ?? null;
    }
    const role = process.env.NEON_APP_ROLE;
    out.appRoleEnvPresent = !!role;
    if (role) {
      const r = await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
      out.appRoleExists = r.rowCount === 1;
    }
  } catch (e) {
    out.dbConnect = false;
    out.dbError = e.message;
  } finally {
    await client.end().catch(() => {});
  }
}

async function checkAuth() {
  const base = process.env.NEON_AUTH_BASE_URL;
  out.authBaseUrlPresent = !!base;
  if (!base) return;
  try {
    const res = await fetch(new URL('/api/auth/ok', base), { method: 'GET' }).catch(() => null);
    out.authReachable = !!res;
    if (res) out.authStatus = res.status;
  } catch (e) {
    out.authReachable = false;
    out.authError = e.message;
  }
}

await checkDb();
await checkAuth();
out.realtimeUrlPresent = !!process.env.NEON_REALTIME_URL;
out.realtimeSecretPresent = !!process.env.NEON_REALTIME_SECRET;
console.log(JSON.stringify(out, null, 2));
