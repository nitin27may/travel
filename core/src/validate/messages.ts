// Plain-English messages with an example of a valid value (plan 4.7 style).
import type { Table } from "../schema/meta.ts";

const EXAMPLES: Record<string, string> = {
  text: '"Laguna de los Tres"',
  int: "3",
  real: "21.5",
  bool: "true",
  json: "[]",
  date: '"2027-03-05"',
  datetime: '"2027-03-05T09:30:00-03:00"',
  month: "9",
  hhmm: '"07:15"',
  offset: "-88",
  tz: '"America/Argentina/Buenos_Aires"',
  pdate: '"2026-10" (a year, a month or a day)',
};

export function columnType(t: Table, col: string): string {
  const m = t.shape[col]?.meta() as Record<string, unknown> | undefined;
  return String(m?.["x-type"] ?? "text");
}

export function exampleFor(t: Table, col: string): string {
  return EXAMPLES[columnType(t, col)] ?? '"..."';
}

const show = (v: unknown): string => {
  const s = JSON.stringify(v);
  return s === undefined ? "undefined" : s.length > 60 ? `${s.slice(0, 57)}...` : s;
};

export interface ZodLikeIssue {
  code: string;
  path: PropertyKey[];
  message: string;
  expected?: string;
  values?: unknown[];
  keys?: string[];
  format?: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
}

/** One sentence naming the field, what is wrong, and a valid example. */
export function describeZodIssue(t: Table, issue: ZodLikeIssue, row: unknown): string {
  const [col, ...rest] = issue.path;
  const field = col === undefined ? "the row" : `"${String(col)}"${rest.length ? ` (inside ${rest.join(".")})` : ""}`;
  const got = col !== undefined && row && typeof row === "object" ? show((row as Record<string, unknown>)[String(col)]) : "";
  const example = col !== undefined && typeof col === "string" ? exampleFor(t, col) : "";
  switch (issue.code) {
    case "invalid_value":
      return `${field} must be one of ${(issue.values ?? []).map((v) => JSON.stringify(v)).join(", ")}, got ${got}.`;
    case "invalid_type": {
      if (rest.length > 0) return `${field} must be a ${issue.expected}, got ${got}.`;
      const moneyHint =
        typeof col === "string" && col.endsWith("_amount") && got.startsWith("{")
          ? " Money is two columns, <name>_amount (a number) and <name>_currency (like \"CAD\"), never an object."
          : "";
      return `${field} must be a ${issue.expected}, got ${got}. Example: ${example}.${moneyHint}`;
    }
    case "invalid_format":
      return `${field} is not in the expected format, got ${got}. Example: ${example}.`;
    case "too_small":
    case "too_big": {
      const bound = issue.code === "too_small" ? `at least ${String(issue.minimum)}` : `at most ${String(issue.maximum)}`;
      return `${field} must be ${bound}, got ${got}. Example: ${example}.`;
    }
    case "unrecognized_keys":
      return `unknown column${(issue.keys ?? []).length > 1 ? "s" : ""} ${(issue.keys ?? []).map((k) => `"${k}"`).join(", ")}. Remove ${(issue.keys ?? []).length > 1 ? "them" : "it"} or check the spelling against data/schema/generated/schema.json.`;
    default:
      return `${field}: ${issue.message}. Example: ${example}.`;
  }
}

export function describeMissing(t: Table, col: string): string {
  const m = t.shape[col]?.meta() as Record<string, unknown> | undefined;
  const nullable = t.shape[col]!.safeParse(null).success;
  const type = String(m?.["x-type"] ?? "text");
  return `column "${col}" is missing. ${nullable ? "Add it with null when there is no value, or a value like " : "Add it with a value like "}${EXAMPLES[type] ?? '"..."'}.`;
}
