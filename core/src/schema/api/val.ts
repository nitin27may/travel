// Provenance in API output: ONE value schema, `apiVal` (D-B4; schema diff 13.1 item 4).
//
// Storage keeps its own Val (`val()` in ../suitability.ts, reused by capture records and, as `rval`, by relevance); it is not
// duplicated here. The API shape differs from it in one way that matters: `src` holds REGISTRY ids only (`s-` plus 10 hex characters,
// data/sources/registry.json). The file-local `src-NNNN` ids of a lane file never leave the store; the store maps them through the
// source registry, and an id with no registry entry is an error (contract case K12), never silently dropped.
//
// The display words a page draws (basis label, rule/advice look) are not carried: they are derived from `basis` and `state` by the
// reader, so every store returns the same bytes for the same value.
import { z } from "zod";
import { SUIT_STATE } from "../enums.ts";
import { REL_BASIS } from "../relevance.ts";
import { apiDate } from "./common.ts";

/** A source registry id: "s-" plus the first 10 hex digits of the SHA-1 of the normalised url (sources/1). */
export const REGISTRY_ID_RE = /^s-[0-9a-f]{10}$/;
export const apiSourceId = z.string().regex(REGISTRY_ID_RE);

/** One source a value cites, as the provenance popover shows it. Keyed by registry id in `citations` of a detail. */
export const apiCitation = z.strictObject({
  id: apiSourceId,
  url: z.string().min(1),
  title: z.string(),
  publisher: z.string(),
  kind: z.string(),
  /** when it was last read */
  read: apiDate.nullable(),
});

/** A conflicting reading of the same value: what another source says. */
function apiConflict<T extends z.ZodType>(inner: T) {
  return z.strictObject({
    v: inner,
    basis: z.enum(REL_BASIS).nullable(),
    src: z.array(apiSourceId),
    note: z.string().optional(),
  });
}

/**
 * A sourced value in API output. `state` and `basis` are the storage enums (SUIT_STATE; REL_BASIS = SUIT_BASIS plus `editorial`).
 * `on` is the date a `searched_none` search ran; `read` the date the value was read; `tried` where we looked when nothing was found.
 */
export function apiVal<T extends z.ZodType>(inner: T) {
  return z.strictObject({
    v: inner.nullable(),
    state: z.enum(SUIT_STATE),
    basis: z.enum(REL_BASIS).nullable(),
    src: z.array(apiSourceId),
    read: apiDate.optional(),
    on: apiDate.optional(),
    quote: z.string().max(300).optional(),
    note: z.string().optional(),
    tried: z.array(z.string()).optional(),
    applies_to: z.string().regex(/^\d{4}$/).optional(),
    conflicts: z.array(apiConflict(inner)).optional(),
    /** the value is our estimate: the page shows the "Estimate" chip from this flag (RIS-C), never from the note text */
    estimate: z.boolean().optional(),
  });
}

/** The value schema for a field whose value type the contract does not narrow (a page row renders any value type). */
export const apiAnyVal = apiVal(z.unknown());

export type ApiVal<T = unknown> = {
  v: T | null;
  state: (typeof SUIT_STATE)[number];
  basis: (typeof REL_BASIS)[number] | null;
  src: string[];
  read?: string;
  on?: string;
  quote?: string;
  note?: string;
  tried?: string[];
  applies_to?: string;
  conflicts?: { v: T; basis: (typeof REL_BASIS)[number] | null; src: string[]; note?: string }[];
  estimate?: boolean;
};
export type ApiCitation = z.infer<typeof apiCitation>;

// ---- checks over any output ----------------------------------------------------------------------------------------------------

const STATES: ReadonlySet<string> = new Set(SUIT_STATE);

/**
 * True for an object shaped like a value, whatever else it holds: a `state` beside `v` (an apiVal), or beside `basisLabel` or
 * `value` and `basis` (the page's PVal, which must never reach API output unmapped). A page row (`state` and `value`, no `basis`) is
 * not a value; its `val` member is.
 */
export function looksLikeVal(x: unknown): x is Record<string, unknown> {
  if (typeof x !== "object" || x === null || Array.isArray(x) || !("state" in x) || typeof (x as { state: unknown }).state !== "string") return false;
  return "v" in x || "basisLabel" in x || ("value" in x && "basis" in x);
}

/** Every value-shaped object in an output, at any depth, with its JSON path. */
export function collectVals(out: unknown, path = "$", acc: { path: string; val: Record<string, unknown> }[] = []): { path: string; val: Record<string, unknown> }[] {
  if (Array.isArray(out)) out.forEach((x, i) => collectVals(x, `${path}[${i}]`, acc));
  else if (out && typeof out === "object") {
    if (looksLikeVal(out) && STATES.has(String(out.state))) acc.push({ path, val: out });
    for (const [k, x] of Object.entries(out)) collectVals(x, `${path}.${k}`, acc);
  }
  return acc;
}

/**
 * The provenance problems of an output (contract cases K12, K13): a value-shaped object that does not parse as `apiVal`, and a `src` id
 * (on a value, a conflict, or a `citations` key) that the registry does not hold. Empty when the output is clean.
 */
export function provenanceProblems(out: unknown, registryIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  for (const { path, val } of collectVals(out)) {
    const parsed = apiAnyVal.safeParse(val);
    if (!parsed.success) {
      problems.push(`${path}: not an apiVal (${parsed.error.issues.map((i) => `${i.path.join(".") || "."} ${i.message}`).join("; ")})`);
      continue;
    }
    const ids = [...parsed.data.src, ...(parsed.data.conflicts ?? []).flatMap((c) => c.src)];
    for (const id of ids) if (!registryIds.has(id)) problems.push(`${path}: source ${id} is not in the source registry`);
  }
  const walk = (x: unknown, p: string): void => {
    if (Array.isArray(x)) x.forEach((y, i) => walk(y, `${p}[${i}]`));
    else if (x && typeof x === "object") {
      for (const [k, y] of Object.entries(x)) {
        if (k === "citations" && y && typeof y === "object" && !Array.isArray(y)) {
          for (const id of Object.keys(y)) if (!registryIds.has(id)) problems.push(`${p}.citations: source ${id} is not in the source registry`);
        }
        walk(y, `${p}.${k}`);
      }
    }
  };
  walk(out, "$");
  return problems;
}
