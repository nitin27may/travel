// What the seed refuses to carry (spec 6.2, PRIV1). Pure. The engine runs both checks before it writes anything; a refusal names a
// path (a file, or a key path inside a row), never the value, because the value is the thing that must not leak.
import { ORIGIN_REF } from "../privacy/detect.ts";
import { NEVER_READ_INPUTS, SEED_FORBIDDEN_KEYS } from "./contract.ts";
import { globMatch } from "./glob.ts";

export interface SeedRefusal {
  code: "E_SEED_DENIED_INPUT" | "E_SEED_ORIGIN" | "E_SEED_PRIVATE_KEY";
  /** a repository path, or `<table>.<key path>` inside a row */
  where: string;
}

/** The deny-list pattern a resolved input path matches, or undefined when the file may be read. */
export function deniedInput(path: string): string | undefined {
  return NEVER_READ_INPUTS.find((p) => globMatch(p, path));
}

/** Refusals for one input file path. */
export function inputRefusals(path: string): SeedRefusal[] {
  return deniedInput(path) ? [{ code: "E_SEED_DENIED_INPUT", where: path }] : [];
}

/**
 * Refusals for one row about to be written: a forbidden key at any depth (the owner's list fields), or a private-list origin
 * (`loc:` or `proto:`) in any key or string. At most `limit` refusals.
 */
export function rowRefusals(table: string, row: unknown, limit = 20): SeedRefusal[] {
  const out: SeedRefusal[] = [];
  const walk = (v: unknown, path: string): void => {
    if (out.length >= limit) return;
    if (typeof v === "string") {
      if (ORIGIN_REF.test(v)) out.push({ code: "E_SEED_ORIGIN", where: path });
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const p = `${path}.${k}`;
        if (SEED_FORBIDDEN_KEYS.includes(k)) out.push({ code: "E_SEED_PRIVATE_KEY", where: p });
        else if (ORIGIN_REF.test(k)) out.push({ code: "E_SEED_ORIGIN", where: p });
        walk(x, p);
        if (out.length >= limit) return;
      }
    }
  };
  walk(row, table);
  return out;
}
