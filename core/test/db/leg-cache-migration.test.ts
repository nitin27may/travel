// TB-L / DT-L: migration 0014 (leg_cache_server_write) is on disk, in order, and holds the privacy shape. It is HELD for the owner's go:
// this test reads the file only and never touches a database.
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { loadMigrations, migrationsDir } from "../../src/db/loader.ts";

describe("migration 0014 leg_cache_server_write", () => {
  const ms = loadMigrations();
  const m = ms.find((x) => x.name === "leg_cache_server_write");

  it("the loaded list and the files on disk agree, and the versions run without a gap", () => {
    const files = readdirSync(migrationsDir()).filter((f) => f.endsWith(".sql")).sort();
    expect(ms.map((x) => x.file)).toEqual(files);
    ms.forEach((x, i) => expect(Number(x.version)).toBe(i + 1));
    expect(m?.version).toBe("0014");
  });

  it("adds the DT-L columns, three policies on the public key grammar, and no delete grant", () => {
    const sql = m!.sql;
    for (const c of ["profile", "engine", "engine_version", "flags", "hits", "last_used"]) expect(sql).toMatch(new RegExp(`add column if not exists ${c} `));
    for (const p of ["leg_cache_read", "leg_cache_insert", "leg_cache_update"]) expect(sql).toContain(`create policy ${p}`);
    expect(sql).toContain("grant select, insert, update on leg_cache to travel_app");
    expect(sql).not.toMatch(/grant[^;]*delete[^;]*leg_cache/);
    expect(sql).toContain("revoke all on leg_cache from public");
    expect(sql).toMatch(/r:\[a-z0-9\]/);
    expect(sql).toMatch(/t:\[1-9\]/);
    expect(sql).toMatch(/g:\[0-9bcdefghjkmnpqrstuvwxyz\]\{6\}/);
  });

  it("marks who wrote a row (SEEDC): existing rows backfilled 'seed', new rows 'server', the app role may write only 'server' rows", () => {
    const sql = m!.sql;
    expect(sql).toMatch(/add column if not exists origin text not null default 'seed' check \(origin in \('seed', 'server'\)\)/);
    // the default flips only after the column exists, so the backfill is 'seed' and every later insert without an origin is the server's
    expect(sql.indexOf("alter column origin set default 'server'")).toBeGreaterThan(sql.indexOf("add column if not exists origin"));
    expect(sql).toMatch(/add constraint leg_cache_origin_keys\s+check \(\(origin = 'server'\) = \(public\.leg_cache_key_ok\(from_cell\) and public\.leg_cache_key_ok\(to_cell\)\)\)/);
    const policy = (name: string) => new RegExp(`create policy ${name}[^;]*;`).exec(sql)![0];
    expect(policy("leg_cache_insert")).toMatch(/with check \(origin = 'server' and/);
    expect(policy("leg_cache_update")).toMatch(/using \(origin = 'server' and/);
    expect(policy("leg_cache_update")).toMatch(/with check \(origin = 'server' and/);
    // the prune drops server rows only; the seed sync owns its own
    expect(/create or replace function leg_cache_prune[\s\S]*?\$\$;/.exec(sql)![0]).toMatch(/where origin = 'server'/);
  });
});
