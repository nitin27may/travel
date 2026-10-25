// Pure loader tests — no database required.
import { describe, expect, it } from "vitest";
import {
  checksum,
  loadMigrations,
  migrationsDir,
  parseMigrations,
} from "../../src/db/loader.ts";

describe("migration loader", () => {
  it("checksum is stable and content-sensitive", () => {
    expect(checksum("select 1")).toBe(checksum("select 1"));
    expect(checksum("select 1")).not.toBe(checksum("select 2"));
    expect(checksum("")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("parses, orders and validates filenames", () => {
    const parsed = parseMigrations([
      { file: "0002_b.sql", sql: "b" },
      { file: "0001_a.sql", sql: "a" },
      { file: "0010_c.sql", sql: "c" },
    ]);
    expect(parsed.map((m) => m.version)).toEqual(["0001", "0002", "0010"]);
    expect(parsed[0].name).toBe("a");
  });

  it("rejects a malformed filename", () => {
    expect(() => parseMigrations([{ file: "nope.sql", sql: "x" }])).toThrow(/NNNN_name/);
    expect(() => parseMigrations([{ file: "1_a.sql", sql: "x" }])).toThrow(/NNNN_name/);
  });

  it("rejects a duplicate version", () => {
    expect(() =>
      parseMigrations([
        { file: "0001_a.sql", sql: "a" },
        { file: "0001_b.sql", sql: "b" },
      ]),
    ).toThrow(/duplicate migration version 0001/);
  });

  it("loads the on-disk migrations in order with distinct, increasing versions", () => {
    const ms = loadMigrations(migrationsDir());
    expect(ms.length).toBeGreaterThanOrEqual(9);
    const versions = ms.map((m) => m.version);
    expect([...versions].sort()).toEqual(versions); // already sorted
    expect(new Set(versions).size).toBe(versions.length); // unique
    expect(versions[0]).toBe("0001");
    // Every file carries a 64-hex checksum of its bytes.
    for (const m of ms) expect(m.checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});
