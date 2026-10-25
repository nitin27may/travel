// The checks a Zod object cannot hold for a RowMeta block (core/src/schema/rowMeta.ts; spec 3.3): which table a key may sit on, the
// 4 KB cap, raw_ref and privacy_class private only in private tables, searched_none never naming a registry property, and the privacy
// rules (never secrets, household data, the owner's private-list origin, third-party HTML). Pure: no file reads. Messages name the key,
// never the value, so a finding cannot leak what it found.
import { PLANNING_NOTE, ORIGIN_REF, STREET_ADDRESS } from "../privacy/detect.ts";
import { HOME_TOWN_RE } from "../privacy/home.ts";
import {
  ALL_META_TABLES, META_KEY_BY_NAME, META_MAX_BYTES, META_WARN_BYTES, PRIVATE_META_TABLES, rowMeta, type MetaTable,
} from "../schema/rowMeta.ts";
import type { Issue } from "./codes.ts";

export interface MetaFinding extends Issue {
  warning?: boolean;
}

export interface MetaCheckOptions {
  /** the table the row loads into (FAMILY_META[schema].table for a JSON family) */
  table: MetaTable;
  /** registry property keys (E_META_SN_PROP); absent: not checked */
  propertyKeys?: ReadonlySet<string>;
  /** freshness class ids of data/schema/freshness.json; absent: not checked */
  freshnessIds?: ReadonlySet<string>;
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
/** Credentials and connection strings in any spelling we have seen: a URL with a password, a bearer token, a key-shaped literal. */
const SECRET = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s]*@|\bBearer\s+[A-Za-z0-9._~+/-]{16,}|\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{12,}|\bre_[A-Za-z0-9]{20,}|\b(?:api[_-]?key|secret|token|password)\s*[=:]\s*\S{6,}|\bAKIA[0-9A-Z]{16}\b/i;
const HTML = /<\s*(?:[a-z][a-z0-9]*)(?:\s[^>]*)?>|<\/\s*[a-z][a-z0-9]*\s*>/i;
const isPrivateTable = (t: MetaTable): boolean => (PRIVATE_META_TABLES as readonly string[]).includes(t);

/** Every string inside a value, with its pointer below `at`. */
function strings(x: unknown, at: string, out: [string, string][]): [string, string][] {
  if (typeof x === "string") out.push([at, x]);
  else if (Array.isArray(x)) x.forEach((y, i) => strings(y, `${at}/${i}`, out));
  else if (x && typeof x === "object") for (const [k, y] of Object.entries(x)) strings(y, `${at}/${k}`, out);
  return out;
}

/** The UTF-8 size of the block as JSON: a close stand-in for pg_column_size of the jsonb (which RIS-M checks in Postgres). */
export const metaBytes = (meta: unknown): number => Buffer.byteLength(JSON.stringify(meta) ?? "", "utf8");

/** Findings for one `meta` block at JSON pointer `at`. Empty when the block keeps the contract. */
export function metaFindings(meta: unknown, at: string, opts: MetaCheckOptions): MetaFinding[] {
  const out: MetaFinding[] = [];
  const E = (code: string, path: string, message: string): void => void out.push({ code, path, message });
  if (!(ALL_META_TABLES as readonly string[]).includes(opts.table)) {
    E("E_META_KEY", at, `table "${opts.table}" carries no meta (spec 3.3 lists the 27 tables). Remove the block.`);
    return out;
  }
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
    E("E_META_SCHEMA", at, `meta must be an object. Example: {"schema_version": 1, "run_id": "DATA-D7R", "review_state": "agent_checked"}.`);
    return out;
  }
  const o = meta as Record<string, unknown>;
  // the size first: a block over the cap is refused whatever it holds
  const bytes = metaBytes(o);
  if (bytes > META_MAX_BYTES) E("E_META_SIZE", at, `meta is ${bytes} bytes; the cap is ${META_MAX_BYTES}. Move prose to research/runs/ and point at it with research_ref.`);
  else if (bytes > META_WARN_BYTES) out.push({ code: "W_META_SIZE", path: at, message: `meta is ${bytes} bytes (above ${META_WARN_BYTES}). Keep row facts short; reasoning belongs in the research archive.`, warning: true });
  // unknown keys and keys outside their tables
  for (const k of Object.keys(o)) {
    const def = META_KEY_BY_NAME.get(k);
    if (!def) {
      E("E_META_KEY", `${at}/${k}`, `"${k}" is not a RowMeta key. Use one of the reserved keys (core/src/schema/rowMeta.ts META_KEYS), or add it there with "since" set to the next version.`);
      continue;
    }
    if (k === "raw_ref") continue; // its own code below
    if (!def.tables.includes(opts.table)) E("E_META_KEY", `${at}/${k}`, `"${k}" is not allowed on a ${opts.table} row; it belongs on ${def.tables.join(", ")}.`);
  }
  // structure (strict Zod, unknown keys already reported above)
  const known = Object.fromEntries(Object.entries(o).filter(([k]) => META_KEY_BY_NAME.has(k)));
  const parsed = rowMeta.safeParse(known);
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      const p = i.path.length ? `${at}/${i.path.join("/")}` : at;
      const what = String(i.path[0] ?? "schema_version");
      E("E_META_SCHEMA", p, `meta "${what}": ${i.message}. See data/schema/generated/row-meta.json.`);
    }
  }
  // raw_ref and privacy_class private live only in private tables
  if ("raw_ref" in o && !isPrivateTable(opts.table)) E("E_META_RAWREF", `${at}/raw_ref`, `raw_ref points into research/inbox/ (the owner's captures, PRIV1) and is allowed only on ${PRIVATE_META_TABLES.join(" and ")} rows. Remove it.`);
  if (o.privacy_class === "private" && !isPrivateTable(opts.table)) E("E_META_RAWREF", `${at}/privacy_class`, `privacy_class "private" is allowed only on ${PRIVATE_META_TABLES.join(" and ")} rows; a ${opts.table} row is internal at most.`);
  // a property's own search is its Val, never a row note
  if (opts.propertyKeys && Array.isArray(o.searched_none)) {
    o.searched_none.forEach((s, i) => {
      const what = s && typeof s === "object" ? (s as { what?: unknown }).what : undefined;
      if (typeof what === "string" && opts.propertyKeys!.has(what)) E("E_META_SN_PROP", `${at}/searched_none/${i}/what`, `"${what}" is a registry property: record its search as the property's Val (state searched_none with "on" and "tried"), not in meta.`);
    });
  }
  if (opts.freshnessIds && typeof o.freshness_class === "string" && !opts.freshnessIds.has(o.freshness_class)) {
    E("E_META_SCHEMA", `${at}/freshness_class`, `freshness_class "${o.freshness_class}" is not a class of data/schema/freshness.json.`);
  }
  // privacy: what meta must never hold, whatever key it sits under
  for (const [p, s] of strings(o, at, [])) {
    if (ORIGIN_REF.test(s)) E("E_META_PRIVACY", p, `a private origin key (wishlist or prototype id, PRIV1). Use the capture ref.`);
    if (HOME_TOWN_RE.test(s) || PLANNING_NOTE.test(s) || STREET_ADDRESS.test(s)) E("E_META_PRIVACY", p, `household text (a home, a stay idea, an address). Household data never enters meta.`);
    if (EMAIL.test(s)) E("E_META_PRIVACY", p, `an email address. Contact details never enter meta.`);
    if (SECRET.test(s)) E("E_META_PRIVACY", p, `something shaped like a secret, token or connection string. Remove it and rotate it if it was real.`);
    if (HTML.test(s)) E("E_META_PRIVACY", p, `page HTML. Third-party text lives only in Val.quote (at most 300 characters).`);
  }
  return out;
}
