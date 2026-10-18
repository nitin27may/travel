// Migration helper (lane CF): operator_rule is for rules (hard limits and the second-list rules). Every other field an
// operator publishes (hours, altitude, kit, ride time, last up and down, season, food) is operator_info. This rewrites the
// basis of a Val, and of its conflicts, when the field it sits under is not a rule field. Pure: the input is not changed.
// A research pass applies it to the lane files; nothing runs it on commit.
import { isRuleField } from "./types.ts";

export interface RebaseOptions {
  /** more field names to leave as operator_rule (a rule the shared lists do not know yet) */
  keep?: readonly string[];
}
export interface RebaseResult<T> {
  doc: T;
  /** Val bases and conflict bases rewritten */
  changed: number;
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isVal = (x: unknown): x is Obj => isObj(x) && "state" in x && "v" in x && "src" in x;

export function rebaseOperatorInfo<T>(doc: T, opts: RebaseOptions = {}): RebaseResult<T> {
  const keep = new Set(opts.keep ?? []);
  let changed = 0;
  const walk = (x: unknown, field: string | null): unknown => {
    if (Array.isArray(x)) return x.map((y) => walk(y, field));
    if (!isObj(x)) return x;
    if (isVal(x)) {
      const rule = field !== null && (isRuleField(field) || keep.has(field));
      const out: Obj = { ...x };
      if (!rule && out.basis === "operator_rule") {
        out.basis = "operator_info";
        changed++;
      }
      if (Array.isArray(out.conflicts)) {
        out.conflicts = out.conflicts.map((c) => {
          if (!rule && isObj(c) && c.basis === "operator_rule") {
            changed++;
            return { ...c, basis: "operator_info" };
          }
          return c;
        });
      }
      return out;
    }
    const out: Obj = {};
    for (const [k, v] of Object.entries(x)) out[k] = walk(v, k);
    return out;
  };
  const next = walk(doc, null) as T;
  return { doc: next, changed };
}
