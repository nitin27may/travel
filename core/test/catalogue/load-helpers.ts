// Test helpers for the seed engine (LOCAL-2): an in-memory Db that understands the engine's statements, and a FileSource that
// overlays edited file text on the real files. Not a test file.
import path from "node:path";
import { loadMigrations } from "../../src/db/loader.ts";
import type { Db } from "../../src/catalogue/postgres/load/engine.ts";
import { fsSource, type FileSource } from "../../src/catalogue/postgres/load/files.ts";

export const REPO = path.resolve(import.meta.dirname, "..", "..", "..");
export const COMMIT = "a".repeat(40);
export const FACTS = { commit: COMMIT, target: { name: "local", kind: "local", host: "127.0.0.1" } } as const;

type Row = Record<string, unknown>;
type Settled = { rows: Row[]; rowCount: number };

/** The working tree, with `edit(file, text) => text` applied to the files named in `edits`; a file in `drop` is not listed. */
export function overlay(edits: Record<string, (text: string) => string> = {}, drop: readonly string[] = []): FileSource {
  const base = fsSource(REPO);
  return {
    label: "test-overlay",
    expand: (inputs) => {
      const r = base.expand(inputs);
      return { files: r.files.filter((f) => !drop.includes(f)), denied: r.denied };
    },
    read: (file) => {
      const text = base.read(file);
      return edits[file] ? edits[file]!(text) : text;
    },
  };
}

/** Edit a JSON file: `fn` gets the parsed document and mutates it. */
export const editJson = (fn: (doc: any) => void) => (text: string): string => {
  const doc = JSON.parse(text);
  fn(doc);
  return JSON.stringify(doc);
};

const unquote = (s: string): string => s.replace(/"/g, "");

/** The ` and t."col" = $2` scope predicate of an update or delete, as a row filter (every row when there is none). */
function scopeOf(where: string, params: readonly unknown[]): (r: Row) => boolean {
  const m = /t\."(\w+)" = \$2/.exec(where);
  return m ? (r) => r[m[1]!] === params[1] : () => true;
}

/** An in-memory stand-in for the target: rows are stored in the shape the engine reads them back in. */
export class MemoryDb implements Db {
  tables = new Map<string, Row[]>();
  missing = new Set<string>();
  log: string[] = [];
  statements: string[] = [];
  lockFree = true;
  failOn?: (sql: string) => boolean;
  private snapshot?: Map<string, Row[]>;
  private readOnly = false;

  constructor(initial: Record<string, Row[]> = {}) {
    for (const [t, rows] of Object.entries(initial)) this.tables.set(t, rows.map((r) => ({ ...r })));
  }

  rows(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }

  async query<R extends Row = Row>(sql: string, params: readonly unknown[] = []): Promise<{ rows: R[]; rowCount: number }> {
    this.log.push(sql);
    const r = this.run(sql.trim(), params);
    return r as unknown as { rows: R[]; rowCount: number };
  }

  private run(sql: string, params: readonly unknown[]): Settled {
    const ok: Settled = { rows: [], rowCount: 0 };
    if (this.failOn?.(sql)) throw new Error("injected failure");
    if (/^begin/.test(sql)) {
      this.snapshot = new Map([...this.tables].map(([t, rows]) => [t, rows.map((r) => ({ ...r }))]));
      this.readOnly = /read only/.test(sql);
      return ok;
    }
    if (sql === "commit") {
      this.snapshot = undefined;
      this.readOnly = false;
      return ok;
    }
    if (sql === "rollback") {
      if (this.snapshot) this.tables = this.snapshot;
      this.snapshot = undefined;
      this.readOnly = false;
      return ok;
    }
    if (sql.includes("pg_try_advisory_xact_lock")) return { rows: [{ ok: this.lockFree }], rowCount: 1 };
    if (sql.startsWith("select to_regclass")) {
      const t = String(params[0]).replace("public.", "");
      return { rows: [{ reg: this.missing.has(t) ? null : `public.${t}` }], rowCount: 1 };
    }
    if (sql.includes("from schema_migrations")) return { rows: loadMigrations().map((m) => ({ version: m.version })), rowCount: 0 };
    // a scoped table (contract `scope`) adds ` where "col" = $1` to its reads and counts
    const scoped = (t: string, col: string | undefined, value: unknown): Row[] => this.rows(t).filter((r) => col === undefined || r[col] === value);
    let m = /^select count\(\*\)::int as n from \(select 1 from "(\w+)"(?: where "(\w+)" = \$1)? limit 1\) s$/.exec(sql);
    if (m) return { rows: [{ n: Math.min(1, scoped(m[1]!, m[2], params[0]).length) }], rowCount: 1 };
    m = /^select .* from "(\w+)"(?: where "(\w+)" = \$1)?$/.exec(sql);
    if (m) {
      const rows = scoped(m[1]!, m[2], params[0]);
      return { rows: rows.map((r) => ({ ...r })), rowCount: rows.length };
    }

    this.statements.push(sql);
    if (this.readOnly) throw new Error("cannot execute a write in a read-only transaction");
    m = /^insert into "(\w+)" \(([^)]*)\) select .* from jsonb_to_recordset/.exec(sql);
    if (m) {
      const t = m[1]!;
      const batch = JSON.parse(params[0] as string) as Row[];
      this.tables.set(t, [...this.rows(t), ...batch]);
      return { rows: [], rowCount: batch.length };
    }
    m = /^insert into catalogue_meta \(key, value\) values/.exec(sql);
    if (m) {
      const rows = this.rows("catalogue_meta");
      const at = rows.find((r) => r.key === params[0]);
      if (at) at.value = params[1];
      else rows.push({ key: params[0], value: params[1] });
      this.tables.set("catalogue_meta", rows);
      return { rows: [], rowCount: 1 };
    }
    m = /^update "(\w+)" t set (.*) from jsonb_to_recordset\(\$1::jsonb\) as x\(.*\) where (.*)$/.exec(sql);
    if (m) {
      const t = m[1]!;
      const keys = [...m[3]!.matchAll(/t\."(\w+)" = x/g)].map((k) => k[1]!);
      const inScope = scopeOf(m[3]!, params);
      const batch = JSON.parse(params[0] as string) as Row[];
      for (const b of batch) {
        const at = this.rows(t).find((r) => inScope(r) && keys.every((k) => r[k] === b[k]));
        if (at) Object.assign(at, b);
      }
      return { rows: [], rowCount: batch.length };
    }
    m = /^delete from "(\w+)" t using jsonb_to_recordset\(\$1::jsonb\) as x\(.*\) where (.*)$/.exec(sql);
    if (m) {
      const t = m[1]!;
      const keys = [...m[2]!.matchAll(/t\."(\w+)" = x/g)].map((k) => k[1]!);
      const inScope = scopeOf(m[2]!, params);
      const batch = JSON.parse(params[0] as string) as Row[];
      this.tables.set(t, this.rows(t).filter((r) => !(inScope(r) && batch.some((b) => keys.every((k) => r[k] === b[k])))));
      return { rows: [], rowCount: batch.length };
    }
    throw new Error(`MemoryDb: unhandled statement ${unquote(sql).slice(0, 80)}`);
  }

  /** The tables the write statements touched, in order, without repeats of the same table in a row. */
  writeOrder(kind: "insert" | "update" | "delete"): string[] {
    const out: string[] = [];
    for (const s of this.statements) {
      const m = new RegExp(`^${kind} (?:into |from )?"(\\w+)"`).exec(s);
      if (m && out[out.length - 1] !== m[1]) out.push(m[1]!);
    }
    return out;
  }
}
