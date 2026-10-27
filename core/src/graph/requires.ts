// What a record needs and what it inherits (entity-graph 7). `requirementsOf` is 7.2: the access offers of the chain, filtered by visit
// mode, month and activity type, with exemptions applied, alternatives grouped and every need labelled with the chain record it came
// from and how the chain reached it (QG3). `inherited` is the four modes of 7.1 (union, bound, fallback, never). Nothing is copied into
// a member; the reader computes it. W_CAP_INHERITED_COPY (the validator) catches copies and stays the contract's.
import { typeUnder } from "../schema/capture/relations.ts";
import type { CaptureRecord } from "../schema/capture/records.ts";
import type { GraphIndex, Via } from "./build.ts";

export type VisitMode = "day" | "overnight_front" | "overnight_back" | (string & {});

export interface RequirementOpts {
  /** the visit mode (`entry.needed_for`); every mode when absent */
  mode?: VisitMode;
  /** 1 to 12: keep requirements whose season overlaps it; every month when absent */
  month?: number;
  /** activity type ids that count for `entry.for_types` besides the record's own type */
  types?: string[];
  /** exemption kinds that apply to this visit (`through_traffic`, `camper`) */
  exempt?: string[];
}

export interface Need {
  /** the requirement offer (the first of its alternatives, in ref order) */
  ref: string;
  /** the record of the chain that carries it ("Banff National Park: entry fee") */
  inheritedFrom: string;
  /** how the chain reached that record: container, start, payoff, end, access, primary, at, on, self */
  via: Via;
  /** the alternatives as one need, including `ref`; one entry when there is no alternative */
  options: { ref: string; inheritedFrom: string; via: Via }[];
  coveredBy: string[];
  includedIn: string[];
}

type Loose = Record<string, any>;
const loose = (r: CaptureRecord | undefined): Loose => (r ?? {}) as unknown as Loose;
const unwrap = (v: unknown): any => (v && typeof v === "object" && !Array.isArray(v) && "v" in (v as object) ? (v as { v: unknown }).v : v);

const mmdd = (s: string): number => Number(s.slice(0, 2)) * 100 + Number(s.slice(3, 5));
const inRange = (d: number, from: number, to: number): boolean => (from <= to ? d >= from && d <= to : d >= from || d <= to);
function monthTouches(rows: { from: string; to: string; status?: string }[], month: number): boolean {
  const a = month * 100 + 1, b = month * 100 + 31;
  return rows.some((r) => r.status !== "closed" && (inRange(a, mmdd(r.from), mmdd(r.to)) || inRange(b, mmdd(r.from), mmdd(r.to)) || inRange(mmdd(r.from), a, b)));
}

/** A sourced `access_cost: no_limit` on the record itself (7.1: overrides what it inherits; W_ENTRY_OVERRIDE lists these). */
export function entryOverride(g: GraphIndex, ref: string): boolean {
  const c = loose(g.recs.get(ref)).access_cost;
  if (!c) return false;
  const v = unwrap(c);
  const sourced = typeof c === "object" && c !== null && "src" in c && !!(c as { src?: unknown }).src;
  return v === "no_limit" && sourced;
}

/** Every record that overrides what its chain says about entry (the W_ENTRY_OVERRIDE list), sorted. */
export function entryOverrides(g: GraphIndex): string[] {
  return [...g.recs.keys()].filter((r) => entryOverride(g, r)).sort();
}

export function requirementsOf(g: GraphIndex, ref: string, opts: RequirementOpts = {}): Need[] {
  const self = g.recs.get(ref);
  const own = entryOverride(g, ref);
  const typesWanted = [...(opts.types ?? []), ...(self ? [self.type] : [])];
  const kept = g.reqOf(ref).filter((q) => {
    if (own && q.from !== ref) return false; // 7.1: a sourced no_limit on the record wins over the chain
    const r = g.recs.get(q.ref);
    const entry = loose(r).entry as Loose | undefined;
    if (opts.mode && Array.isArray(entry?.needed_for) && !entry!.needed_for.includes(opts.mode)) return false;
    if (Array.isArray(entry?.for_types) && !entry!.for_types.some((t: string) => typesWanted.some((w) => typeUnder(w, t)))) return false;
    if (opts.month) {
      const rows = unwrap(loose(r).season);
      if (Array.isArray(rows) && rows.length && !monthTouches(rows, opts.month)) return false;
    }
    const ex = Array.isArray(entry?.exemptions) ? entry!.exemptions.map((e: unknown) => (typeof e === "string" ? e : (e as Loose)?.kind)) : [];
    if (opts.exempt && ex.some((e: string) => opts.exempt!.includes(e))) return false;
    return true;
  });

  // alternatives: a symmetric pair is one need
  const keptRefs = new Set(kept.map((k) => k.ref));
  const parent = new Map<string, string>(kept.map((k) => [k.ref, k.ref]));
  const find = (x: string): string => { while (parent.get(x) !== x) x = parent.get(x)!; return x; };
  for (const k of kept) for (const a of g.inv.get(k.ref)?.alternative_to ?? []) if (keptRefs.has(a)) parent.set(find(a), find(k.ref));
  const groups = new Map<string, typeof kept>();
  for (const k of kept) { const root = find(k.ref); groups.set(root, [...(groups.get(root) ?? []), k]); }
  const needs: Need[] = [...groups.values()].map((list) => {
    const opts2 = list.map((k) => ({ ref: k.ref, inheritedFrom: k.from, via: k.via })).sort((a, b) => (a.ref < b.ref ? -1 : 1));
    const head = opts2[0]!;
    const refs = opts2.map((o) => o.ref);
    return {
      ...head,
      options: opts2,
      coveredBy: [...new Set(refs.flatMap((r) => (loose(g.recs.get(r)).covered_by as string[] | undefined) ?? []))].sort(),
      includedIn: [...new Set(refs.flatMap((r) => g.inv.get(r)?.included_in ?? []))].sort(),
    };
  });
  return needs.sort((a, b) => (a.ref < b.ref ? -1 : 1));
}

// ---- 7.1: the four inheritance modes -------------------------------------------------------------------------------------------------

export type InheritMode = "union" | "bound" | "fallback" | "never";
export interface InheritRule { mode: InheritMode; path: string[]; note: string }

/** The 7.1 table as data. Entry requirements are `requirementsOf` (union, with its own filters), not a row here. */
export const INHERITANCE: Readonly<Record<string, InheritRule>> = {
  season: { mode: "bound", path: ["season"], note: "a gated container bounds its members; the member's own season is cut to it" },
  closures: { mode: "union", path: ["hours", "closures"], note: "a park-wide closure shows on every member" },
  access_season: { mode: "fallback", path: ["access_season"], note: "the nearest one, labelled with its source" },
  conditions: { mode: "fallback", path: ["links", "conditions"], note: "alerts page" },
  status: { mode: "fallback", path: ["links", "status"], note: "status page" },
  booking: { mode: "fallback", path: ["links", "booking"], note: "reservation portal" },
  wildlife_hazards: { mode: "union", path: ["wildlife"], note: "area-wide hazards (safety, P2 exception)" },
  wildlife_rules: { mode: "fallback", path: ["ext", "wildlife"], note: "ext.wildlife.*" },
  run_by: { mode: "fallback", path: ["run_by"], note: "managed by, display only" },
  tz: { mode: "fallback", path: ["hours", "tz"], note: "time zone for hours" },
  summary: { mode: "never", path: ["summary"], note: "the visitor-centre toilets are not the lake's" },
  facilities: { mode: "never", path: ["facilities"], note: "never" },
  sources: { mode: "never", path: ["sources"], note: "every value carries its own src and licence" },
  offer_limits: { mode: "never", path: ["limits"], note: "never from a place to an offer (contract 2.4 rule 3)" },
};

export interface InheritedValue { from: string; via: Via; own: boolean; value: unknown }
export interface Inherited { fact: string; mode: InheritMode; values: InheritedValue[]; effective?: { from: string; to: string }[] }

function pick(rec: Loose, path: string[]): unknown {
  let cur: any = rec;
  for (const k of path) {
    cur = unwrap(cur);
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  const v = unwrap(cur);
  return v === undefined || v === null || (Array.isArray(v) && v.length === 0) ? undefined : v;
}

/** open days (1..366 by month*100+day ordinal) of season rows; status closed rows remove days */
function openDays(rows: { from: string; to: string; status?: string }[]): Set<number> {
  const out = new Set<number>();
  const mdays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= mdays[m - 1]!; d++) {
    const k = m * 100 + d;
    const hit = rows.filter((r) => inRange(k, mmdd(r.from), mmdd(r.to)));
    if (hit.length && hit.every((r) => r.status !== "closed")) out.add(k);
  }
  return out;
}
function toRanges(days: Set<number>): { from: string; to: string }[] {
  const mdays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const fmt = (k: number): string => `${String(Math.floor(k / 100)).padStart(2, "0")}-${String(k % 100).padStart(2, "0")}`;
  const out: { from: string; to: string }[] = [];
  let start: number | null = null, prev: number | null = null;
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= mdays[m - 1]!; d++) {
    const k = m * 100 + d;
    if (days.has(k)) { if (start === null) start = k; prev = k; }
    else if (start !== null) { out.push({ from: fmt(start), to: fmt(prev!) }); start = null; }
  }
  if (start !== null) out.push({ from: fmt(start), to: fmt(prev!) });
  return out;
}

/** The value of one fact for a record, by its mode (7.1), every value labelled with the chain record it came from. */
export function inherited(g: GraphIndex, ref: string, fact: string): Inherited {
  const rule = INHERITANCE[fact];
  if (!rule) throw new Error(`unknown inherited fact "${fact}"; the table is INHERITANCE in core/src/graph/requires.ts`);
  const chain = rule.mode === "never" ? [{ ref, via: "self" as Via }] : g.chainOf(ref);
  const found: InheritedValue[] = [];
  for (const c of chain) {
    const value = pick(loose(g.recs.get(c.ref)), rule.path);
    if (value !== undefined) found.push({ from: c.ref, via: c.via, own: c.ref === ref, value });
    if (rule.mode === "fallback" && found.length) break;
  }
  if (rule.mode === "never") return { fact, mode: "never", values: found.filter((v) => v.own) };
  const res: Inherited = { fact, mode: rule.mode, values: found };
  if (rule.mode === "bound" && fact === "season") {
    const rows = (v: InheritedValue) => v.value as { from: string; to: string; status?: string }[];
    const ownV = found.find((v) => v.own);
    const above = found.filter((v) => !v.own);
    let days: Set<number> | null = ownV ? openDays(rows(ownV)) : null;
    for (const a of above) {
      const d = openDays(rows(a));
      days = days ? new Set([...days].filter((x) => d.has(x))) : d;
    }
    if (days) res.effective = toRanges(days);
  }
  return res;
}
