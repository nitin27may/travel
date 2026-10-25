// Trip-level files: windows (trip-windows/1), base plans (trip-base-plans/1) and seasons (trip-season-basic/1). None has a core
// schema yet (OVR-Ca, STY-Ca, D6a-W), so the rules read the files as they are and the validators come later.
//
// 4.2 "Basis": one target vocabulary, SUIT_BASIS, plus `method`:
//   official            -> official_info (official_rule when the text states a rule)
//   operator            -> operator_info (operator_rule for limits and booking rules)
//   computed            -> our_inference, method "computed", the tool named in `note` when the sources name it
//   plan                -> our_inference, method "owner" (see DECISIONS NEEDED: the spec says `editorial`, which SUIT_BASIS does not hold)
//   searched_none (a basis) -> state searched_none, basis null
// 4.2 "Value shape": a season's `{value, basis, src, on}` becomes a Val `{v, state, basis, src, read}`; plus and minus points,
// events and unknown entries stay claims (`text` plus provenance) because their text is the displayed thing.
//
// W_KEEP_UNREAD (spec 2, "How it is tested"): a key no adapter reads. No adapter exists for these families yet, so READ_KEYS is the
// shape the specs name (trip-overview-and-customisation.md 2.2, stay-bases-and-optimisation.md 9.2, the D6a seasons shape); when
// OVR-C, STY-Ca and D6a-W land their schemas, the schema replaces this table.
import { SUIT_BASIS } from "../schema/enums.ts";
import { Sink, isObj, seg, startMeta, type Obj } from "./common.ts";
import { normaliseDate } from "./dates.ts";
import type { Family } from "./types.ts";

const SUIT: ReadonlySet<string> = new Set(SUIT_BASIS);

/** Words that make an official claim a rule (a pass is required, a road is closed) and an operator claim a limit or booking rule. */
const OFFICIAL_RULE = /\b(?:required|requires?|must|mandatory|closed|closes|closure|prohibited|not allowed|banned|ban on|permit|restricted|restriction|no entry|reservation[s]? (?:is|are) required)\b/i;
const OPERATOR_RULE = /\b(?:limit|limits|maximum|minimum|max\.?|min\.?|at least|at most|up to|only|must|required|requires?|booking|book |reserv|advance|sold out|capacity|age|weight|under \d|over \d)\b/i;

export type BasisMap = { from: string; to: string };

/** The text a claim shows: the first of its text keys. */
const claimText = (o: Obj): string => [o.text, o.rule, o.why, o.item, o.level].filter((x): x is string => typeof x === "string").join(" ");

/** The tool a computed claim names, read from the source rows its `src` ids resolve to (the run never invents one). */
function toolOf(o: Obj, sources: Map<string, Obj>): string | null {
  const ids = Array.isArray(o.src) ? o.src : [];
  for (const id of ids) {
    const s = typeof id === "string" ? sources.get(id) : undefined;
    const url = typeof s?.url === "string" ? s.url : "";
    if (/^core\/bin\/sun\.ts/.test(url)) return "core/bin/sun.ts";
    if (/openrouteservice|\bors\b/i.test(url) || /openrouteservice|\bORS\b/.test(String(s?.title ?? ""))) return "OpenRouteService (ORS)";
  }
  return null;
}

/** Maps one basis value. Null when the value is already a SUIT_BASIS value or unknown. */
export function mapBasis(basis: string, o: Obj): { to: string | null; method?: string; searchedNone?: boolean } {
  const text = claimText(o);
  switch (basis) {
    case "official":
      return { to: OFFICIAL_RULE.test(text) ? "official_rule" : "official_info" };
    case "operator":
      return { to: OPERATOR_RULE.test(text) ? "operator_rule" : "operator_info" };
    case "computed":
      return { to: "our_inference", method: "computed" };
    case "plan":
      return { to: "our_inference", method: "owner" };
    case "searched_none":
      return { to: null, searchedNone: true };
    default:
      return { to: null };
  }
}

/** Whether `o` is the season shape `{value, basis, ...}` (and not yet a Val). */
const isSeasonShape = (o: Obj): boolean => "value" in o && "basis" in o && !("v" in o);

/** The Val a season shape becomes. Key order is the Val's: v, state, basis, src, read, then the rest as written. */
function toVal(o: Obj, basisTo: string | null, searched: boolean): Obj {
  const { value, basis: _b, src, on, ...rest } = o;
  const out: Obj = { v: searched ? null : value, state: searched ? "searched_none" : "value", basis: searched ? null : basisTo, src: Array.isArray(src) ? src : [] };
  if (typeof on === "string") {
    if (searched) out.on = on;
    else out.read = normaliseDate(on).iso ?? on;
  }
  for (const [k, v] of Object.entries(rest)) out[k] = v;
  return out;
}

/** Applies the basis vocabulary and the season shape to `doc` in place; counts each mapping on the sink. */
export function normaliseBasis(doc: Obj, sink: Sink): void {
  const sources = new Map<string, Obj>();
  if (Array.isArray(doc.sources)) for (const s of doc.sources) if (isObj(s) && typeof s.id === "string") sources.set(s.id, s);
  const visit = (x: unknown, at: string, parentKey: string): void => {
    if (Array.isArray(x)) {
      x.forEach((y, i) => {
        if (isObj(y) && parentKey !== "sources") {
          const r = rewrite(y, `${at}/${i}`);
          if (r) x[i] = r;
        }
        visit(x[i], `${at}/${i}`, parentKey);
      });
    } else if (isObj(x)) {
      for (const [k, y] of Object.entries(x)) {
        if (k === "meta" || k === "sources") continue;
        if (isObj(y)) {
          const r = rewrite(y, `${at}/${seg(k)}`);
          if (r) x[k] = r;
        }
        visit(x[k], `${at}/${seg(k)}`, k);
      }
    }
  };
  /** Rewrites one object that carries a `basis`; returns a replacement object when its shape changes (a Val), else edits in place. */
  const rewrite = (o: Obj, path: string): Obj | null => {
    if (typeof o.basis !== "string") return null;
    const from = o.basis;
    if (SUIT.has(from)) return isSeasonShape(o) ? shape(o, from, false, path) : null;
    const m = mapBasis(from, o);
    if (m.searchedNone) {
      sink.change("basis", `${path}/basis`, `${from} to searched_none (state)`);
      if (isSeasonShape(o)) return shape(o, null, true, path);
      o.state = "searched_none";
      o.basis = null;
      return null;
    }
    if (m.to === null) {
      sink.find("W_NORM_BASIS", "warn", `${path}/basis`, `"${from}" is not a basis the normaliser maps; left as written`);
      return null;
    }
    sink.change("basis", `${path}/basis`, `${from} to ${m.to}`);
    if (m.method) {
      if (isSeasonShape(o)) {
        // the Val has no method key; the claim shape would, but a Val is closed, so the method stays in the note
        const val = shape(o, m.to, false, path);
        addMethodNote(val, m.method, toolOf(o, sources));
        return val;
      }
      if (o.method === undefined) {
        o.method = m.method;
        sink.change("method", `${path}/method`, m.method);
      }
      if (m.method === "computed" && o.note === undefined) {
        const tool = toolOf(o, sources);
        if (tool) o.note = `Computed with ${tool}.`;
        else sink.find("W_NORM_COMPUTED_TOOL", "info", path, "a computed claim with no note and no source that names the tool; add the tool to the note");
      }
    }
    if (isSeasonShape(o)) return shape(o, m.to, false, path);
    o.basis = m.to;
    return null;
  };
  const shape = (o: Obj, basisTo: string | null, searched: boolean, path: string): Obj => {
    sink.change("season_shape", path, "{value, basis} to a Val");
    return toVal(o, basisTo, searched);
  };
  const addMethodNote = (val: Obj, method: string, tool: string | null): void => {
    if (typeof val.note === "string" && val.note.length > 0) return;
    if (method === "computed") val.note = tool ? `Computed with ${tool}.` : undefined;
    if (method === "owner") val.note = "The plan's own statement.";
    if (val.note === undefined) delete val.note;
  };
  // the root itself is never a claim; its children are
  visit(doc, "", "");
  // a mapped file notes the run that wrote it (the file-level `meta` of FAMILY_META)
  if (sink.changes.length > 0 && doc.meta === undefined) {
    const m = startMeta(doc, sink.run);
    if (m) sink.change("meta", "/meta", "started");
  }
}

// ---- W_KEEP_UNREAD ----

type Keys = Readonly<Record<string, readonly string[]>>;
const SOURCE_KEYS = ["id", "url", "title", "publisher", "kind", "read", "page_modified", "method"] as const;
const CLAIM = ["text", "factor", "basis", "src", "on", "pattern_year", "note", "method", "v", "state", "read", "tried", "quote", "applies_to"] as const;

/** The keys the specs name per path pattern (`[]` is an array element). A pattern not listed is not checked. */
export const READ_KEYS: Readonly<Record<"windows" | "base-plans" | "seasons", Keys>> = {
  windows: {
    "": ["schema", "trip", "researched", "agent", "model", "length_days", "default", "sources", "windows", "meta"],
    "sources[]": SOURCE_KEYS,
    "windows[]": ["id", "label", "start", "sun", "verdict", "best_for", "crowd", "plus", "minus", "events", "affects", "unknown"],
    "windows[].crowd": ["level", "basis", "src", "note", "pattern_year", "method"],
    "windows[].plus[]": CLAIM,
    "windows[].minus[]": CLAIM,
    "windows[].events[]": ["rule", "effect", "basis", "src", "on", "pattern_year", "note", "method"],
    "windows[].affects[]": ["ref", "state", "why", "basis", "src", "pattern_year", "note", "method"],
    "windows[].unknown[]": ["text", "searched", "tried"],
  },
  "base-plans": {
    "": ["schema", "trip", "researched", "agent", "model", "nights", "gateway", "bases", "default", "sources", "strategies", "swaps", "checked_not_fit", "meta"],
    "sources[]": SOURCE_KEYS,
    "strategies[]": ["id", "label", "kind", "review", "suits", "stays", "plus", "minus", "unknown", "day_map", "left_out", "requires"],
    "strategies[].plus[]": CLAIM,
    "strategies[].minus[]": CLAIM,
    "strategies[].requires[]": CLAIM,
    "strategies[].left_out[]": ["item", "from_day", "why", "basis", "note", "method", "src", "on"],
    "swaps[]": ["id", "replace", "with", "review", "plus", "minus"],
    "swaps[].plus[]": CLAIM,
    "swaps[].minus[]": CLAIM,
    "checked_not_fit[]": ["kind", "text", "basis", "note", "method", "src", "on"],
  },
  seasons: {
    "": ["schema", "trip", "legacy_folder", "researched", "agent", "model", "length_days", "default", "months_basis", "sources", "points", "season", "windows", "meta"],
    "sources[]": SOURCE_KEYS,
    "points[]": ["id", "name", "lat", "lon", "elev_m", "zone", "src", "note"],
    "windows[]": ["id", "label", "start", "sun", "verdict", "verdict_note", "best_for", "crowd", "plus", "minus", "events", "affects", "unknown"],
    "windows[].plus[]": CLAIM,
    "windows[].minus[]": CLAIM,
    "windows[].unknown[]": ["text", "searched", "tried"],
  },
};

/** W_KEEP_UNREAD for the keys of `doc` no adapter reads, at the path patterns READ_KEYS lists. One finding per (pattern, key). */
export function unreadKeys(doc: Obj, family: Family, sink: Sink): void {
  if (family !== "windows" && family !== "base-plans" && family !== "seasons") return;
  const table = READ_KEYS[family];
  const seen = new Set<string>();
  const visit = (x: unknown, pattern: string, at: string): void => {
    if (Array.isArray(x)) {
      x.forEach((y, i) => visit(y, `${pattern}[]`, `${at}/${i}`));
      return;
    }
    if (!isObj(x)) return;
    const allowed = table[pattern];
    for (const [k, y] of Object.entries(x)) {
      if (allowed && !allowed.includes(k)) {
        const tag = `${pattern}|${k}`;
        if (!seen.has(tag)) {
          seen.add(tag);
          sink.find("W_KEEP_UNREAD", "warn", `${at}/${seg(k)}`, `"${pattern ? `${pattern}.` : ""}${k}" is read by no adapter (${family} has no core schema yet); keep it in the research archive or give it a home`);
        }
      }
      visit(y, pattern ? `${pattern}.${k}` : k, `${at}/${seg(k)}`);
    }
  };
  visit(doc, "", "");
}
