import { formatDate } from '@/lib/export/dates';
import { TRIP_EDIT_ON } from '@/lib/trip-edit/flag';
import { openTripHref } from '@/lib/trip-edit/keys';
import type { CopyItem } from '@travel/core/schema/copies.ts';
import { partyText } from './party';
import { convertedLabel, countdown, editHref, groupRows, NO_DATE, rowTitle } from './rows';
import type { Group, RowModel } from './rows';

/**
 * One device list for copies and the plans the builder keeps (STEP2-P2, EM-5 folded): the rows of both, each trip once, in the three
 * groups. Copies stay in `copies/2` (the home /t/ and the sync engine read); the builder's drafts stay in `plan-drafts/1`; this module is
 * the one place that puts them side by side. No plan code here (the builder's fence): `lib/plan/device.ts` reads the drafts and hands
 * over the facts below.
 */
export interface DraftFacts {
  id: string;
  title: string | null;
  slug: string | null;
  start: string | null;
  days: number | null;
  adults: number | null;
  children: number[];
  built: boolean;
  updatedAt: string;
  identity: string | null;
  /** the public trip a converted copy was made from (STEP2-B3); null for a trip the builder made */
  from?: string | null;
}

/** The chip a draft with no build carries (gap-analysis 2.6; FLOW TF13). */
export const DRAFT_CHIP = 'Draft · ready to build';

export interface DraftRowModel {
  draft: DraftFacts;
  id: string;
  title: string;
  href: string;
  /** the row menu's Edit: only for a built draft, and only with `tripEdit` on */
  editHref: string | null;
  when: string;
  who: string;
  group: Group;
  /** "Draft · ready to build", or null once the draft has a build */
  chip: string | null;
  /** "Made from Canadian Rockies" for a copy that became the person's own trip (edit-mode-spec 13.2), else null */
  label: string | null;
}

export type DeviceRow = RowModel | DraftRowModel;
export const isDraftRow = (r: DeviceRow): r is DraftRowModel => 'draft' in r;
export const deviceRowId = (r: DeviceRow): string => (isDraftRow(r) ? r.id : r.item.id);

export function draftRow(d: DraftFacts, today: string): DraftRowModel {
  const title = d.title ?? (d.slug ? rowTitle({ title: '', slug: d.slug }) : 'Your trip');
  // a built draft opens as a trip (read mode on its days); with no build, or with `tripEdit` off, the builder finishes it
  const opens = d.built && TRIP_EDIT_ON;
  const party = d.adults !== null ? partyText({ adults: d.adults, children: d.children }) : '';
  const who = [d.days ? `${d.days} ${d.days === 1 ? 'day' : 'days'}` : '', party].filter(Boolean).join(' · ');
  const base = {
    draft: d,
    id: d.id,
    title,
    // the builder's address, written out: Mine may not import the builder (tests/mine/device-list.test.ts pins it to lib/plan/keys.ts `draftHref`)
    href: opens ? openTripHref(d.id) : `/plan/?draft=${d.id}&s=4`,
    editHref: opens ? editHref(d.id) : null,
    who,
    chip: d.built ? null : DRAFT_CHIP,
    label: d.from ? convertedLabel(d.from) : null,
  };
  if (d.start === null) return { ...base, when: NO_DATE, group: 'nodate' };
  const cd = countdown(d.start, d.days, today);
  return { ...base, when: `${formatDate(d.start)} · ${cd.text}`, group: cd.group };
}

const startOf = (r: DeviceRow): string => (isDraftRow(r) ? (r.draft.start ?? '') : (r.item.start ?? ''));
const stamp = (r: DeviceRow): number => Date.parse(isDraftRow(r) ? r.draft.updatedAt : r.item.copiedAt) || 0;
const titleOf = (r: DeviceRow): string => r.title;

/**
 * Every trip on the device once. A draft whose id is already a copy (or an account trip) is not listed again, so a device that holds
 * the same document under both keys shows one row. Upcoming soonest first, No date newest first, Past most recent first.
 */
export function groupDevice(items: readonly CopyItem[], drafts: readonly DraftFacts[], today: string): { upcoming: DeviceRow[]; nodate: DeviceRow[]; past: DeviceRow[] } {
  const g = groupRows(items, today);
  const have = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const extra = drafts.flatMap((d) => {
    if (have.has(d.id) || seen.has(d.id)) return [];
    seen.add(d.id);
    return [draftRow(d, today)];
  });
  const part = (k: Group): DeviceRow[] => [...g[k], ...extra.filter((r) => r.group === k)];
  return {
    upcoming: part('upcoming').sort((a, b) => startOf(a).localeCompare(startOf(b)) || titleOf(a).localeCompare(titleOf(b))),
    nodate: part('nodate').sort((a, b) => stamp(b) - stamp(a) || titleOf(a).localeCompare(titleOf(b))),
    past: part('past').sort((a, b) => startOf(b).localeCompare(startOf(a)) || titleOf(a).localeCompare(titleOf(b))),
  };
}

/** How many trips the device list holds (copies, and drafts that are not also copies). */
export function deviceCount(items: readonly CopyItem[], drafts: readonly DraftFacts[]): number {
  const have = new Set(items.map((i) => i.id));
  return items.length + new Set(drafts.filter((d) => !have.has(d.id)).map((d) => d.id)).size;
}
