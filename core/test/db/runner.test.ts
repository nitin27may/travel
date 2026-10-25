// Runner tests — pure `plan()` logic plus `migrate()` against an in-memory fake executor.
import { describe, expect, it } from "vitest";
import type { Migration } from "../../src/db/loader.ts";
import { checksum } from "../../src/db/loader.ts";
import { migrate, MigrationError, plan, planAgainst, type AppliedRow, type Executor } from "../../src/db/runner.ts";

function mig(version: string, name: string, sql: string): Migration {
  return { version, name, file: `${version}_${name}.sql`, sql, checksum: checksum(sql) };
}
function applied(m: Migration): AppliedRow {
  return { version: m.version, name: m.name, checksum: m.checksum };
}

/** Minimal in-memory Postgres stand-in: records executed migration SQL and the ledger. */
class FakeDb implements Executor {
  ledger: AppliedRow[] = [];
  ran: string[] = [];
  /** Any statement that writes schema state (ledger DDL or inserts) — must stay empty for plans. */
  writes: string[] = [];
  failOn?: string;
  /** When true, the advisory-lock acquisition throws (simulates a busy/denied lock). */
  lockError = false;
  private ledgerExists = false;
  async query(sql: string, params: unknown[] = []): Promise<{ rows: any[] }> {
    const s = sql.trim();
    if (s.includes("pg_advisory_lock")) {
      if (this.lockError) throw Object.assign(new Error("lock not available"), { code: "55P03" });
      return { rows: [{}] };
    }
    if (s.includes("pg_advisory")) return { rows: [{}] }; // unlock
    if (s.startsWith("select to_regclass")) {
      return { rows: [{ reg: this.ledgerExists ? "public.schema_migrations" : null }] };
    }
    if (s.startsWith("create table if not exists schema_migrations")) {
      this.ledgerExists = true;
      this.writes.push("ensure-ledger");
      return { rows: [] };
    }
    if (s.startsWith("select version, name, checksum")) {
      return { rows: this.ledger.map((r) => ({ ...r })) };
    }
    if (s.startsWith("insert into schema_migrations")) {
      this.writes.push("insert-ledger");
      this.ledger.push({ version: params[0] as string, name: params[1] as string, checksum: params[2] as string });
      this.ledger.sort((a, b) => a.version.localeCompare(b.version));
      return { rows: [] };
    }
    if (s === "begin" || s === "commit" || s === "rollback") return { rows: [] };
    // Otherwise it is a migration body.
    if (this.failOn && s.includes(this.failOn)) throw new Error("boom");
    this.ran.push(s);
    return { rows: [] };
  }
}

const A = mig("0001", "a", "create table a();");
const B = mig("0002", "b", "create table b();");
const C = mig("0003", "c", "create table c();");

describe("plan()", () => {
  it("returns pending in order with nothing applied", () => {
    const p = plan([A, B, C], []);
    expect(p.pending.map((m) => m.version)).toEqual(["0001", "0002", "0003"]);
  });

  it("skips already-applied migrations", () => {
    const p = plan([A, B, C], [applied(A)]);
    expect(p.pending.map((m) => m.version)).toEqual(["0002", "0003"]);
  });

  it("rejects checksum drift on an applied migration (destructive edit)", () => {
    const edited = { ...applied(A), checksum: "deadbeef" };
    expect(() => plan([A, B], [edited])).toThrow(MigrationError);
    expect(() => plan([A, B], [edited])).toThrow(/checksum drift/);
  });

  it("rejects a missing migration file for an applied version", () => {
    expect(() => plan([B, C], [applied(A), applied(B)])).toThrow(/missing migration/);
  });

  it("rejects a new migration inserted before an applied one (out of order)", () => {
    const inserted = mig("0002", "late", "create table late();");
    // 0001 and 0003 applied; 0002 is new but sorts before 0003.
    expect(() => plan([A, inserted, C], [applied(A), applied(C)])).toThrow(/out-of-order/);
  });
});

describe("migrate()", () => {
  it("applies all pending and records the ledger", async () => {
    const db = new FakeDb();
    const res = await migrate(db, { migrations: [A, B, C] });
    expect(res.applied).toEqual(["0001", "0002", "0003"]);
    expect(db.ran).toEqual([A.sql, B.sql, C.sql]);
    expect(db.ledger.map((r) => r.version)).toEqual(["0001", "0002", "0003"]);
  });

  it("is idempotent: a second run applies nothing", async () => {
    const db = new FakeDb();
    await migrate(db, { migrations: [A, B, C] });
    const again = await migrate(db, { migrations: [A, B, C] });
    expect(again.applied).toEqual([]);
    expect(db.ran.length).toBe(3);
  });

  it("dryRun reports pending without writing", async () => {
    const db = new FakeDb();
    const res = await migrate(db, { migrations: [A, B, C], dryRun: true });
    expect(res.applied).toEqual(["0001", "0002", "0003"]);
    expect(db.ran.length).toBe(0);
    expect(db.ledger.length).toBe(0);
  });

  it("rolls back and stops on a failing migration (not recorded)", async () => {
    const db = new FakeDb();
    db.failOn = "table b";
    await expect(migrate(db, { migrations: [A, B, C] })).rejects.toThrow(/0002_b\.sql failed/);
    expect(db.ledger.map((r) => r.version)).toEqual(["0001"]); // only A committed
    expect(db.ran).toEqual([A.sql]); // C never ran
  });

  it("fails closed when the advisory lock cannot be acquired (no DDL runs)", async () => {
    const db = new FakeDb();
    db.lockError = true;
    await expect(migrate(db, { migrations: [A, B, C] })).rejects.toThrow(/lock not available/);
    expect(db.ran).toEqual([]); // no migration body ran
    expect(db.writes).toEqual([]); // ledger never created or written
    expect(db.ledger).toEqual([]);
  });
});

describe("read-only inspection", () => {
  it("planAgainst never writes when the ledger is absent", async () => {
    const db = new FakeDb();
    const p = await planAgainst(db, [A, B, C]);
    expect(p.applied).toEqual([]);
    expect(p.pending.map((m) => m.version)).toEqual(["0001", "0002", "0003"]);
    expect(db.writes).toEqual([]); // did not create the ledger
    expect(db.ran).toEqual([]);
  });

  it("dryRun reports the plan without creating the ledger", async () => {
    const db = new FakeDb();
    const res = await migrate(db, { migrations: [A, B, C], dryRun: true });
    expect(res.applied).toEqual(["0001", "0002", "0003"]);
    expect(db.writes).toEqual([]); // no ensure-ledger, no inserts
    expect(db.ledger).toEqual([]);
  });
});
