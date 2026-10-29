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
});
