// What the migrations say about tables, read from their SQL text (pure: the caller passes the text). The seed contract's tests use
// it to prove the contract against the schema instead of a second hand-kept list: every created table is classified, every key
// column exists, and every table another table points at is never deleted by a sync.
//
// The parser is deliberately small. It understands the migrations of this repository (`create table <name> ( ... );`, column
// lines, inline `references <table>(<col>)` with an optional `on delete cascade`), not SQL in general.

export interface TableRef {
  /** the referencing table */
  from: string;
  /** the referenced table */
  to: string;
  /** the referenced column */
  column: string;
  /** `on delete cascade` on the reference */
  cascade: boolean;
}

export interface CreatedTable {
  name: string;
  /** the text between the outer parentheses of the create statement */
  body: string;
  /** the version of the migration that created it (`0003`), when the caller passed one */
  version?: string;
}

const CREATE_RE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
const REF_RE = /references\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(\s*([a-z_][a-z0-9_"]*)\s*\)((?:\s+on\s+delete\s+(?:cascade|set\s+null|restrict|no\s+action))?)/gi;

/** Remove `-- ...` line comments so a word in a comment is not read as SQL. */
function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

/** Every `create table` of one migration's SQL, with its body (balanced parentheses). */
export function createdTables(sql: string, version?: string): CreatedTable[] {
  const text = stripComments(sql);
  const out: CreatedTable[] = [];
  for (const m of text.matchAll(CREATE_RE)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < text.length; i++) {
      const ch = text[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) throw new Error(`schemaRefs: unbalanced parentheses in create table ${m[1]}`);
    out.push({ name: m[1]!.toLowerCase(), body: text.slice(open + 1, end), ...(version ? { version } : {}) });
  }
  return out;
}

const RENAME_RE = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+rename\s+to\s+([a-z_][a-z0-9_]*)\s*;/gi;

/** Every `alter table <old> rename to <new>` of one migration's SQL, in order. */
export function renamedTables(sql: string): { from: string; to: string }[] {
  return [...stripComments(sql).matchAll(RENAME_RE)].map((m) => ({ from: m[1]!.toLowerCase(), to: m[2]!.toLowerCase() }));
}

/**
 * The tables the migrations leave, in order: each migration's `create table`s, then its renames applied to every table created so far
 * (0013 renames 0009's planner_draft and 0010's signal table; owner decision, 27 Oct 2026). A renamed table keeps its body and the
 * version that created it.
 */
export function schemaTables(migrations: readonly { sql: string; version?: string }[]): CreatedTable[] {
  const out: CreatedTable[] = [];
  for (const m of migrations) {
    out.push(...createdTables(m.sql, m.version));
    for (const r of renamedTables(m.sql)) for (const t of out) if (t.name === r.from) t.name = r.to;
  }
  return out;
}

/** Every inline foreign key of the given tables. */
export function tableReferences(tables: readonly CreatedTable[]): TableRef[] {
  const out: TableRef[] = [];
  for (const t of tables) {
    for (const m of t.body.matchAll(REF_RE)) {
      out.push({ from: t.name, to: m[1]!.toLowerCase(), column: m[2]!.replace(/"/g, ""), cascade: /cascade/i.test(m[3] ?? "") });
    }
  }
  return out;
}

/** True when the table body declares a column with this name (the first word of a column line, quoted or not). */
export function hasColumn(table: CreatedTable, column: string): boolean {
  const re = new RegExp(`(?:^|[(,\\n])\\s*"?${column.replace(/[^a-z0-9_]/gi, "")}"?\\s+[a-z]`, "i");
  return re.test(table.body);
}
