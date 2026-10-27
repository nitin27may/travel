// The researched travel windows of a trip for "When to go" (spec trip-and-places-ux-fixes.md 6.2 items 3 and 4; UXB-4 review C1). The one
// boundary (P9): the Summary never reads data/** itself. Reads data/windows/<trip>.json (trip-windows/1) at build time, server only, no zod (the
// browser start chunk never sees it), and hands the page light rows: the label, the verdict, the crowd level with its source's publisher, one plus and
// one minus, and the month the window starts in. Nothing is invented: a row that does not read as a window is dropped, a crowd level is shown only
// with the level the file states, and text that carries a calendar date is dropped under the public dateless rule (never rewritten). Only public
// fields leave this file: no source URLs, no affects refs, no household or plan-day detail beyond the file's own wording.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { travelRoot } from '../data/root';
import { isDated } from './dateless';

export type WindowVerdict = 'best' | 'good' | 'workable';
const VERDICTS: readonly WindowVerdict[] = ['best', 'good', 'workable'];

export interface WindowRow {
  id: string;
  label: string;
  verdict: WindowVerdict;
  /** The crowd level as the file states it ("lower", "high", "rising"), with the publisher of its first source and the pattern year; null when the file has none. */
  crowd: { level: string; source: string | null; year: number | null } | null;
  plus: string | null;
  minus: string | null;
  /** The month the window starts in (1 to 12), for the strip; null when the file gives none. */
  startMonth: number | null;
  /** The window the plan is written for (the file's `default`). */
  isDefault: boolean;
}

export interface TripWindows {
  rows: WindowRow[];
}

interface RawItem { text?: unknown }
interface RawWindow {
  id?: unknown; label?: unknown; verdict?: unknown; start?: { month?: unknown };
  crowd?: { level?: unknown; src?: unknown; pattern_year?: unknown };
  plus?: RawItem[]; minus?: RawItem[];
}
interface RawDoc { schema?: unknown; trip?: unknown; default?: unknown; sources?: { id?: unknown; publisher?: unknown }[]; windows?: RawWindow[] }

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** The first line of a list that reads as plain text and carries no calendar date. */
const firstText = (items: RawItem[] | undefined): string | null => {
  for (const i of items ?? []) {
    const t = str(i?.text);
    if (t && !isDated(t)) return t;
  }
  return null;
};

/** Builds one trip's rows from a parsed file; null when the file is not this trip's trip-windows/1 or has no usable window. Exported for the tests. */
export function tripWindowsFrom(doc: RawDoc, slug: string): TripWindows | null {
  if (doc.schema !== 'trip-windows/1' || doc.trip !== slug) return null;
  const publisher = new Map((doc.sources ?? []).flatMap((s) => (str(s.id) && str(s.publisher) ? [[str(s.id)!, str(s.publisher)!] as const] : [])));
  const rows: WindowRow[] = [];
  for (const w of doc.windows ?? []) {
    const id = str(w.id);
    const label = str(w.label);
    const verdict = VERDICTS.find((v) => v === w.verdict);
    if (!id || !label || !verdict || isDated(label)) continue;
    const level = str(w.crowd?.level);
    const src = Array.isArray(w.crowd?.src) ? str((w.crowd!.src as unknown[])[0]) : null;
    const year = typeof w.crowd?.pattern_year === 'number' ? w.crowd.pattern_year : null;
    const m = w.start?.month;
    rows.push({
      id,
      label,
      verdict,
      crowd: level ? { level, source: src ? (publisher.get(src) ?? null) : null, year } : null,
      plus: firstText(w.plus),
      minus: firstText(w.minus),
      startMonth: typeof m === 'number' && Number.isInteger(m) && m >= 1 && m <= 12 ? m : null,
      isDefault: id === doc.default,
    });
  }
  return rows.length ? { rows } : null;
}

const cache = new Map<string, TripWindows | null>();

/** The windows of `slug`, or null when the trip has no windows file (13 of 14 today): the page then keeps its honest gap lines. */
export function tripWindowsFor(slug: string, root: string = travelRoot()): TripWindows | null {
  const key = `${root}\0${slug}`;
  if (cache.has(key)) return cache.get(key)!;
  const file = path.join(root, 'data', 'windows', `${slug}.json`);
  let out: TripWindows | null = null;
  if (/^[a-z0-9-]+$/.test(slug) && existsSync(file)) out = tripWindowsFrom(JSON.parse(readFileSync(file, 'utf8')) as RawDoc, slug);
  cache.set(key, out);
  return out;
}
