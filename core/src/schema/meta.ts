// Column and table helpers for the schema source (plan 2.1, 2.5).
//
// Subset rule: nothing here or in the other schema files may use features that do not export to
// JSON Schema. Cross-field rules go in `meta.rules` and are implemented by the validator.
import { z } from "zod";

export type Family = "trip" | "catalog" | "locations" | "sidecar";
export type ColType =
  | "text" | "int" | "real" | "bool" | "json" | "date" | "datetime"
  | "month" | "hhmm" | "offset" | "tz" | "pdate";

export interface Ui {
  label?: string;
  facet?: boolean;
  group?: string;
  [key: string]: unknown;
}

export interface ColOpts {
  /** the column may be null (it is still required to be present in a row) */
  null?: boolean;
  /** foreign key target as "sqlTable.column" */
  fk?: string;
  /** never written to the static export */
  private?: boolean;
  ui?: Ui;
}

/** A declarative cross-field rule. The validator implements each `code`. */
export interface Rule {
  code: string;
  kind: "pair" | "contiguous" | "custom";
  /** one line of plain English, copied into the export */
  describe: string;
  columns?: string[];
  groupBy?: string[];
}

export interface TableMeta {
  pk: string[];
  family: Family;
  /** exactly one object (trip, profile) instead of an array of rows */
  single?: boolean;
  sql?: {
    name?: string;
    checks?: string[];
    indexes?: string[][];
    /** extra leading columns for the DDL (catalog tables that are scoped by country) */
    lead?: { name: string; ddl: string }[];
  };
  ui?: Ui;
  private?: string[];
  rules?: Rule[];
}

export interface ResolvedMeta extends TableMeta {
  sql: NonNullable<TableMeta["sql"]>;
  ui: Ui;
  private: string[];
  rules: Rule[];
}

export interface Table {
  name: string;
  family: Family;
  key: string;
  shape: Record<string, z.ZodType>;
  schema: z.ZodType;
  meta: ResolvedMeta;
}

function build(type: ColType, inner: z.ZodType, o: ColOpts): z.ZodType {
  const base = o.null ? inner.nullable() : inner;
  const meta: Record<string, unknown> = { "x-type": type };
  if (o.fk) meta["x-fk"] = o.fk;
  if (o.private) meta["x-private"] = true;
  if (o.ui) meta["x-ui"] = o.ui;
  return base.meta(meta);
}

export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const text = (o: ColOpts & { pattern?: RegExp; min?: number } = {}) => {
  let s = z.string();
  if (o.pattern) s = s.regex(o.pattern);
  if (o.min !== undefined) s = s.min(o.min);
  return build("text", s, o);
};
export const pattern = (re: RegExp, o: ColOpts = {}) => text({ ...o, pattern: re });
export const iso2 = (o: ColOpts = {}) => text({ ...o, pattern: /^[A-Z]{2}$/ });
export const currency = (o: ColOpts = {}) => text({ ...o, pattern: /^[A-Z]{3}$/ });
export const url = (o: ColOpts = {}) => text({ ...o, pattern: /^https?:\/\/\S+$/ });
export const enumOf = (values: readonly [string, ...string[]], o: ColOpts = {}) => build("text", z.enum(values), o);
export const int = (o: ColOpts & { min?: number; max?: number } = {}) => {
  let s = z.number().int();
  if (o.min !== undefined) s = s.min(o.min);
  if (o.max !== undefined) s = s.max(o.max);
  return build("int", s, o);
};
export const real = (o: ColOpts & { min?: number; max?: number } = {}) => {
  let s = z.number();
  if (o.min !== undefined) s = s.min(o.min);
  if (o.max !== undefined) s = s.max(o.max);
  return build("real", s, o);
};
export const bool = (o: ColOpts = {}) => build("bool", z.boolean(), o);
export const json = (inner: z.ZodType, o: ColOpts = {}) => build("json", inner, o);
export const date = (o: ColOpts = {}) => build("date", z.iso.date(), o);
export const datetime = (o: ColOpts = {}) => build("datetime", z.iso.datetime({ offset: true }), o);
/** partial date: YYYY, YYYY-MM or YYYY-MM-DD (visits) */
export const pdate = (o: ColOpts = {}) => build("pdate", z.string().regex(/^\d{4}(-(0[1-9]|1[0-2])(-\d{2})?)?$/), o);
export const month = (o: ColOpts = {}) => build("month", z.number().int().min(1).max(12), o);
export const hhmm = (o: ColOpts = {}) => build("hhmm", z.string().regex(HHMM_RE), o);
export const offset = (o: ColOpts = {}) => build("offset", z.number().int(), o);
/** IANA zone; membership in Intl.supportedValuesOf('timeZone') is checked by the validator (E_TZ) */
export const tz = (o: ColOpts = {}) => build("tz", z.string().min(1), o);

/** a pair of scalar columns for one amount (plan 2.1: no money objects) */
export function moneyPair(name: string, o: { null?: boolean; private?: boolean } = {}): Record<string, z.ZodType> {
  return {
    [`${name}_amount`]: real({ null: o.null, private: o.private }),
    [`${name}_currency`]: currency({ null: o.null, private: o.private }),
  };
}

export const idList = (o: ColOpts = {}) => json(z.array(z.string()), o);
export const monthList = (o: ColOpts = {}) => json(z.array(z.number().int().min(1).max(12)), o);
export const weekdayList = (o: ColOpts = {}) => json(z.array(z.number().int().min(1).max(7)), o);
export const strList = (o: ColOpts = {}) => json(z.array(z.string()), o);
export const linkList = (o: ColOpts = {}) =>
  json(z.array(z.strictObject({ label: z.string(), url: z.string(), kind: z.string() })), o);

export function table(name: string, shape: Record<string, z.ZodType>, meta: TableMeta): Table {
  const priv = new Set(meta.private ?? []);
  for (const [col, schema] of Object.entries(shape)) {
    const m = (schema as z.ZodType).meta() as Record<string, unknown> | undefined;
    if (m?.["x-private"]) priv.add(col);
  }
  for (const col of meta.pk) {
    if (!(col in shape)) throw new Error(`table ${name}: primary key column ${col} is not in the shape`);
  }
  const full = {
    ...meta,
    sql: meta.sql ?? {},
    ui: meta.ui ?? { label: name },
    private: [...priv].sort(),
    rules: meta.rules ?? [],
  };
  return {
    name,
    family: meta.family,
    key: `${meta.family}.${name}`,
    shape,
    schema: z.strictObject(shape),
    meta: full,
  };
}
