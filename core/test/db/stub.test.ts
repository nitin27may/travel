// The neon_auth stub (tools/db/init/03-neon-auth-stub.sql) must keep the column list of the real Managed
// Better Auth tables. The expected lists were read from the Neon child branch on 25 Oct 2026. Pointed at the
// child, this test is the drift check; pointed at the local container it also asserts the roles.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const run = describe.skipIf(!url);

const EXPECTED: Record<string, string[]> = {
  user: ["id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "role", "banned", "banReason", "banExpires"],
  session: ["id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress", "userAgent", "userId", "impersonatedBy", "activeOrganizationId"],
  account: ["id", "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope", "password", "createdAt", "updatedAt"],
};

const loopback = !!url && ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);

run("neon_auth stub shape", () => {
  let admin: any;
  beforeAll(async () => {
    const pgSpec = "pg";
    const { Client } = (await import(pgSpec)) as any;
    admin = new Client({ connectionString: url });
    await admin.connect();
  });
  afterAll(async () => {
    await admin?.end();
  });

  for (const [table, cols] of Object.entries(EXPECTED)) {
    it(`neon_auth.${table} has the real column list, in order`, async () => {
      const { rows } = await admin.query(
        // pg_attribute, not information_schema: the latter hides columns the role has no privilege on.
        `select a.attname as column_name from pg_attribute a join pg_class c on c.oid=a.attrelid
           where c.relnamespace='neon_auth'::regnamespace and c.relname=$1 and a.attnum>0 and not a.attisdropped
           order by a.attnum`,
        [table],
      );
      expect(rows.map((r: any) => r.column_name)).toEqual(cols);
    });
  }

  it("the owner role can read neon_auth.user and delete sessions (as EML-1's revoke does)", async () => {
    const { rows } = await admin.query(
      `select has_table_privilege(current_user, 'neon_auth."user"', 'SELECT') as sel,
              has_table_privilege(current_user, 'neon_auth.session', 'DELETE') as del`,
    );
    expect(rows[0]).toEqual({ sel: true, del: true });
  });
});

describe.skipIf(!url || !loopback)("local roles match production", () => {
  let admin: any;
  beforeAll(async () => {
    const pgSpec = "pg";
    const { Client } = (await import(pgSpec)) as any;
    admin = new Client({ connectionString: url });
    await admin.connect();
  });
  afterAll(async () => {
    await admin?.end();
  });

  it("the owner bypasses RLS as neondb_owner does on Neon; the app role does not", async () => {
    const { rows } = await admin.query(
      "select rolname, rolbypassrls, rolsuper, rolcanlogin from pg_roles where rolname in ('neondb_owner','travel_app') order by rolname",
    );
    expect(rows).toEqual([
      { rolname: "neondb_owner", rolbypassrls: true, rolsuper: false, rolcanlogin: true },
      { rolname: "travel_app", rolbypassrls: false, rolsuper: false, rolcanlogin: false },
    ]);
  });

  it("runs Postgres 18 with PostGIS 3.6", async () => {
    const v = await admin.query("show server_version");
    expect(v.rows[0].server_version).toMatch(/^18\./);
    const e = await admin.query("select extname, extversion from pg_extension where extname in ('postgis','pg_trgm','unaccent','ltree')");
    const m = new Map(e.rows.map((r: any) => [r.extname, r.extversion]));
    expect(String(m.get("postgis"))).toMatch(/^3\.6\./);
    for (const x of ["pg_trgm", "unaccent", "ltree"]) expect(m.has(x), x).toBe(true);
  });
});
