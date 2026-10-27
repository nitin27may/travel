import { PLACEHOLDER_TITLE } from '@travel/core/schema/copies.ts';
import type { CopyItem } from '@travel/core/schema/copies.ts';
import { addDays, formatDate, parseIso } from '@/lib/export/dates';
import { partyText } from './copies';

/**
 * The My trips rows' text, groups and Open link (NAV-2). Kept apart from `copies.ts` on purpose: the copy sheet (a lazy chunk of every
 * trip page) imports `copies.ts`, and the profile codec used here is also in the trip page's start chunk; any other chunk that imports it moves it
 * to a shared chunk and costs the trip page start JS (measured: +229 B). So `openQuery` below writes the codec's format itself, and
 * tests/mine/copies.test.ts pins it equal to `serialiseTimelineUrl` and readable by `parseTimelineUrl` for every field.
 */
const num = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

// ---- rows ----

const dayNumber = (iso: string): number => Math.round(parseIso(iso).getTime() / 86_400_000);

/** The name a row shows: a moved legacy copy carries the placeholder "Trip" until a refresh, so it reads its slug until then. */
export function rowTitle(c: Pick<CopyItem, 'title' | 'slug'>): string {
  if (c.title !== PLACEHOLDER_TITLE) return c.title;
  return c.slug.replace(/-/g, ' ').replace(/^./, (s) => s.toUpperCase());
}

export type Group = 'upcoming' | 'past';

export interface RowModel {
  item: CopyItem;
  title: string;
  href: string;
  /** Line 2: "Sat 3 Jul 2027 · in 251 days" */
  when: string;
  /** Line 3: "14 days · 2 adults, 1 child" */
  who: string;
  group: Group;
}

/** The countdown, neutral in tone (tokens 3.1 colours only due dates). `today` is the visitor's local date, `YYYY-MM-DD`. */
export function countdown(start: string, days: number | null, today: string): { text: string; group: Group } {
  const to = dayNumber(start) - dayNumber(today);
  const len = days ?? 1;
  if (to > 0) return { text: to === 1 ? 'tomorrow' : `in ${to} days`, group: 'upcoming' };
  const into = -to + 1;
  if (into <= len) return { text: days ? `Day ${into} of ${len} · now` : 'now', group: 'upcoming' };
  const ago = into - len;
  return { text: ago === 1 ? 'ended yesterday' : `ended ${ago} days ago`, group: 'past' };
}

/** The codec's query for a copy (profile codec 3.8): keys in its order, defaults left out, never the children's ages (only the youngest band), then `view=day`. */
export function openQuery(c: CopyItem): string {
  const youngest = c.profile ? c.profile.youngest : c.children.length ? Math.min(...c.children) : null;
  const family = c.profile ? c.profile.party === 'family' : c.children.length > 0;
  const out: string[] = [];
  // the party keys are always written (EM-B, B2): a link without them lands on the party kept on this device, and a copy has its own
  out.push(family ? `p=family-${youngest ?? 0}` : 'p=adults');
  if (c.profile && c.profile.pace !== 'standard') out.push(`pace=${c.profile.pace}`);
  // the sheet's adults wins; `a=<n>` for 1 to 12, written even at the codec's default 2 (Q296)
  out.push(`a=${Math.min(12, Math.max(1, c.adults))}`);
  if (c.profile && c.profile.walk !== null && [5, 8, 12].includes(c.profile.walk)) out.push(`walk=${c.profile.walk}`);
  if (c.profile?.split) out.push('split=1');
  const d = Object.entries(c.overrides).map(([n, k]) => [Number(n), k] as const).sort((x, y) => x[0] - y[0]);
  if (d.length) out.push(`d=${d.map(([n, k]) => `${n}${k}`).join(',')}`);
  if (c.added.length) out.push(`add=${c.added.map((a) => `${a.day}.${a.placeSlug}`).join(',')}`);
  // a copy opens on its days, not the Summary (UXB-1 made the Summary the default tab); `view` follows the profile keys, as the trip page writes it
  out.push('view=day');
  // a marker only (EM-B, B3): the party bar reads "Your copy" instead of "Shared plan"; EM-3 puts the copy's id here
  out.push('mine=1');
  return out.join('&');
}

/** `/trips/<slug>/` with the copy's choices. */
export function openHref(c: CopyItem): string {
  const q = openQuery(c);
  return `/trips/${c.slug}/${q ? `?${q}` : ''}`;
}

export function rowModel(item: CopyItem, today: string): RowModel {
  const cd = countdown(item.start, item.days, today);
  return {
    item,
    title: rowTitle(item),
    href: openHref(item),
    when: `${formatDate(item.start)} · ${cd.text}`,
    who: [item.days ? num(item.days, 'day') : '', partyText(item)].filter(Boolean).join(' · '),
    group: cd.group,
  };
}

/** Upcoming soonest first, Past most recent first (spec 5.2). */
export function groupRows(items: readonly CopyItem[], today: string): { upcoming: RowModel[]; past: RowModel[] } {
  const rows = items.map((i) => rowModel(i, today));
  const upcoming = rows.filter((r) => r.group === 'upcoming').sort((a, b) => a.item.start.localeCompare(b.item.start) || a.title.localeCompare(b.title));
  const past = rows.filter((r) => r.group === 'past').sort((a, b) => b.item.start.localeCompare(a.item.start) || a.title.localeCompare(b.title));
  return { upcoming, past };
}

export const endDate = (c: Pick<CopyItem, 'start' | 'days'>): string => addDays(c.start, Math.max(0, (c.days ?? 1) - 1));

/** The visitor's local date as `YYYY-MM-DD`. */
export function localToday(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

