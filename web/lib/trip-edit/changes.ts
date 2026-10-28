// "Changes from our plan" (edit-mode-spec 10; README 5.2, ruling C4): one row per template entry, with what and where, and one button that
// names its own action. Pure: the document and a name lookup in, rows out.
import type { PlanOp, PlanDraft } from './model';
import type { PlanDayOp } from '@travel/core/schema/plan-draft.ts';
import { dayWordOf, type DayRef } from './dayMap';
import { isRuleItem, ruleWords } from './ruleRows';

export interface ChangeRow {
  key: string;
  /** "Removed Moose Lake Loop from Day 5" */
  text: string;
  /** the button's word: Remove it, Put it back, Move it back, Remove note, Use our version, Remove day */
  verb: 'Remove it' | 'Put it back' | 'Move it back' | 'Remove note' | 'Use our version' | 'Remove day';
  ops: PlanOp[];
  /** what the toast says after the button: "Put Moose Lake Loop back on Day 5" */
  done: string;
}

export interface Names {
  /** a published stop's title by its schedule id */
  item: (id: string) => string | null;
  /** a place's name by its slug */
  place: (slug: string) => string | null;
  /** a row the rules made, by its day and `rule:` item (STEP2-E1B): "Collect the hire car", "the drive back to Banff" */
  rule?: (day: number, item: string) => string | null;
}

/** A removed entry's name: a stop's title, or a rule row's (its plain words when no timeline shows it). */
const removedName = (day: number, item: string, n: Names, fallback: string): string =>
  isRuleItem(item) ? (n.rule?.(day, item) ?? ruleWords(item.slice(item.indexOf(':') + 1))) : (n.item(item) ?? fallback);

const human = (slug: string): string => slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const placeName = (ref: string, n: Names): string => {
  const slug = ref.replace(/^place\//, '');
  return n.place(slug) ?? human(slug);
};
/** A day of a row, as the page labels it now (Day n, by the copy's day edits); an added day says so. */
const dayWord = (d: DayRef, ops: readonly PlanDayOp[]): string => {
  const w = dayWordOf(ops, d);
  return typeof d === 'number' || w === 'a day you added' ? w : `${w} (added)`;
};

/** The rows for a template document, each list newest first (the lists carry no clock, so kinds are grouped: added, removed, moved, Maybe, days, versions, notes). */
export function changeRows(d: PlanDraft, names: Names, newId: () => string): ChangeRow[] {
  const t = d.template;
  if (!t) return [];
  const ins = t.days;
  const rows: ChangeRow[] = [];
  const back = (target: string): PlanOp[] => [{ kind: 'deleteEntry', id: newId(), target }];
  for (const a of [...t.added].reverse()) rows.push({ key: a.op, text: `Added ${placeName(a.ref, names)} to ${dayWord(a.day, ins)}`, verb: 'Remove it', done: `Removed ${placeName(a.ref, names)} from ${dayWord(a.day, ins)}`, ops: [{ kind: 'removePlace', id: newId(), added: a.op }] });
  for (const r of [...t.removed].reverse()) rows.push({ key: r.op, text: `Removed ${removedName(r.day, r.item, names, 'a stop')} from ${dayWord(r.day, ins)}`, verb: 'Put it back', done: isRuleItem(r.item) ? `Restored ${removedName(r.day, r.item, names, '')} on ${dayWord(r.day, ins)}` : `Put ${removedName(r.day, r.item, names, 'the stop')} back on ${dayWord(r.day, ins)}`, ops: back(r.op) });
  for (const m of [...t.moved].reverse()) {
    const same = m.toDay === m.day;
    rows.push({ key: m.op, text: `${same ? 'Reordered' : 'Moved'} ${names.item(m.item) ?? 'a stop'}${same ? ` on ${dayWord(m.day, ins)}` : ` from ${dayWord(m.day, ins)} to ${dayWord(m.toDay, ins)}`}`, verb: 'Move it back', done: `Moved ${names.item(m.item) ?? 'the stop'} back`, ops: back(m.op) });
  }
  for (const m of [...t.maybe].reverse()) rows.push({ key: m.op, text: `${placeName(m.ref, names)} is in Maybe`, verb: 'Put it back', done: `Put ${placeName(m.ref, names)} back`, ops: back(m.op) });
  for (const x of [...t.days].reverse()) {
    if (x.kind === 'insert') rows.push({ key: x.op, text: `Added ${dayWord(x.op, ins).replace(' (added)', '')}`, verb: 'Remove day', done: 'Removed the added day', ops: back(x.op) });
    else rows.push({ key: x.op, text: `Dropped Day ${x.day} of our plan`, verb: 'Put it back', done: `Put Day ${x.day} back`, ops: back(x.op) });
  }
  for (const [day, key] of Object.entries(t.overrides)) rows.push({ key: `v${day}`, text: `${dayWord(Number(day), ins)} uses version ${key}`, verb: 'Use our version', done: `${dayWord(Number(day), ins)} is back to our version`, ops: [{ kind: 'setVariant', id: newId(), day: Number(day), variant: null }] });
  for (const [key, text] of Object.entries(t.notes)) {
    const stop = /^(\d+):(.+)$/.exec(key);
    const where = /^\d+$/.test(key) ? dayWord(Number(key), ins) : stop ? removedName(Number(stop[1]), stop[2]!, names, 'a stop') : 'a stop';
    rows.push({ key: `n${key}`, text: `Note on ${where}: ${text.length > 60 ? `${text.slice(0, 57)}...` : text}`, verb: 'Remove note', done: 'Removed the note', ops: [{ kind: 'setNote', id: newId(), key: key as never, text: null }] });
  }
  return rows;
}
