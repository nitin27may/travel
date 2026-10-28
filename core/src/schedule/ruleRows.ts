// The generated rows a person can remove from a day (STEP2-E1B; edit-mode-spec 5 "Any row can be removed"). The day scheduler writes
// rows from rules: the start of the day, collecting the hire car, check-in and check-out, meals, rests, breaks, a booking's check-in
// slot and the end of the day. None of them is stored, so a removed one is remembered by a RULE KEY that survives the day re-flowing:
// the lane, the kind and sub, and for a row that precedes a stop (a rest, a break, a slot) that stop's id. A row there is one of per
// day (start, check-in, check-out, the hire car, the end, each meal) carries no anchor, so it stays removed whatever moves around it.
//
// The template delta records it as a removal with `rule:` before the key (`{ day: 2, item: "rule:all-car-hire" }`): the plan
// document's `removed` list already holds schedule ids of this form, so no schema changes and every older reader skips it as a stop
// that is not on the day. Legs and the sun are not rows: a leg is the connector between two rows and re-flows with them; removing the
// end of the day also removes the drive to it after the day's last stop ("the drive back"). Outside the page entry (browser.ts).
import type { TimelineEntry } from "./types.ts";

/** What a `removed` item starts with when it names a generated row, not a stop. */
export const RULE_PREFIX = "rule:";

/** The fields of a timeline entry the key is read from. */
export type RuleRowEntry = Pick<TimelineEntry, "id" | "day" | "kind" | "sub" | "addedBy" | "sourceItemId" | "lane">;

const ONE_A_DAY = new Set<string>(["start", "checkout", "checkin", "end"]);

/** The lane token of a generated id (`5-all-meal-lunch` is `all`), or null for an id the scheduler did not make on this day. */
function tailOf(e: RuleRowEntry): { lane: string; tail: string } | null {
  const pre = `${e.day}-`;
  if (!e.id.startsWith(pre)) return null;
  const tail = e.id.slice(pre.length);
  const dash = tail.indexOf("-");
  return dash > 0 ? { lane: tail.slice(0, dash), tail } : null;
}

/**
 * The key that removes a generated row, or null for a row that is not one (a stop of the plan or a place added, a leg, the sun, a
 * condensed day's block). `all-meal-lunch`, `all-car-hire`, `all-checkin`, `all-rest-at-base-moraine-lake`, `A-break-coffee-x`.
 */
export function ruleKeyOf(e: RuleRowEntry): string | null {
  if (e.addedBy !== "scheduler" || e.sourceItemId !== null || e.kind === "sun" || e.kind === "leg") return null;
  const t = tailOf(e);
  if (!t) return null;
  if (ONE_A_DAY.has(e.kind)) return `${t.lane}-${e.kind}`;
  if (e.kind === "visit" && e.sub === "car-hire") return `${t.lane}-car-hire`;
  return t.tail;
}

/** True when an item of the delta's `removed` list names a generated row. */
export const isRuleItem = (item: string): boolean => item.startsWith(RULE_PREFIX);
/** The removal item of a generated row: `rule:all-car-hire`. */
export const ruleItemOf = (key: string): string => `${RULE_PREFIX}${key}`;

/**
 * The entries of a day the rule keys hide: each row whose key is listed, and with a lane's `end`, the drive to it (the legs and their
 * stretch breaks after the lane's last stop). `entries` are a day's timeline entries in time order.
 */
export function rowsOfKeys(entries: readonly TimelineEntry[], keys: readonly string[]): TimelineEntry[] {
  if (!keys.length) return [];
  const out: TimelineEntry[] = [];
  for (const [i, e] of entries.entries()) {
    const k = ruleKeyOf(e);
    if (k !== null && keys.includes(k)) {
      out.push(e);
      continue;
    }
    const t = tailOf(e);
    if (!t || !keys.includes(`${t.lane}-end`)) continue;
    if ((e.kind === "leg" || (e.kind === "break" && e.sub === "leg-stretch")) && e.addedBy === "scheduler" && closing(entries, i)) out.push(e);
  }
  return out;
}

/** The entry at `i` comes after the last stop of its lane (a stop: an entry with a source id, not inside another). */
function closing(entries: readonly TimelineEntry[], i: number): boolean {
  const lane = entries[i]!.lane;
  for (let j = entries.length - 1; j > i; j--) {
    const x = entries[j]!;
    if (x.lane === lane && x.sourceItemId && !x.insideOf && x.kind !== "sun") return false;
  }
  return true;
}
