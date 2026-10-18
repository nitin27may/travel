import type { ColumnDef } from '@tanstack/react-table';
import { Icon } from '@/components/ui/Icon';
import dynamic from 'next/dynamic';
import { DEPTH_LABEL, DEPTH_NOTICE, lengthLabel, tripHref } from '@/components/trips/format';
import type { TripListRow } from '@/components/trips/types';
import type { TripRow } from '@/lib/data/types';
import { MONTH_NAMES } from '@/lib/format/season';
import type { Badge, EntityDescriptor } from '../types';

/**
 * Badges of the older date-based row (`TripRow`). The home page's shared TripCard still imports this; the public trips list
 * below is dateless and uses `publicTripBadges`.
 */
export function tripBadges(t: TripRow): Badge[] {
  const out: Badge[] = [];
  if (t.badge) out.push({ text: t.badge, tone: t.when === 'today' || t.when === 'soon' ? 'status' : 'neutral', icon: 'calendar' });
  if (t.source === 'legacy') out.push({ text: 'Legacy page', tone: 'muted', icon: 'link', title: 'Built before the data model; opens the original page' });
  return out;
}

/** Chips on a card or list row: the season (neutral, or an honest "not set yet") and the depth notice for trips that are not full. */
export function publicTripBadges(t: TripListRow): Badge[] {
  const out: Badge[] = [];
  if (t.seasonLabel) out.push({ text: t.seasonLabel, tone: 'season', icon: 'calendar', title: 'This plan is valid for' });
  else out.push({ text: 'Season not set yet', tone: 'warn', icon: 'calendar', title: 'The season this plan is valid for has not been written yet' });
  if (t.depth !== 'full') out.push({ text: DEPTH_NOTICE[t.depth], tone: 'warn', icon: 'info', title: t.depth === 'summary' ? 'A shorter day list; the original plan holds the detail' : 'No day list yet; the original plan holds the detail' });
  return out;
}

// the map view (MapLibre wrapper, camera and card) loads only when the Map view is chosen, so the list pages stay inside the JS budget
const TripsMap = dynamic(() => import('@/components/trips/TripsMap').then((m) => m.TripsMap), { ssr: false });

const PHASE_TITLE = { plan: 'Published plans', done: 'Done, use as a template' } as const;
const phase = (t: TripListRow) => (t.isDone ? 'done' : 'plan');
const DEPTH_RANK = { full: 0, summary: 1, overview: 2 } as const;

function col(id: string, header: string, cell: ColumnDef<TripListRow, unknown>['cell'], text: (t: TripListRow) => string | number, size = 140, opts: { align?: 'right'; sort?: boolean } = {}): ColumnDef<TripListRow, unknown> {
  return { id, header, cell, size, minSize: 70, enableSorting: opts.sort !== false, meta: { label: header, text, align: opts.align } } as ColumnDef<TripListRow, unknown>;
}

const dash = <span className="dash">&ndash;</span>;
const kidsText = (t: TripListRow) => (t.ageFit === null ? '' : `Ages ${t.ageFit}+`);

export const tripDescriptor: EntityDescriptor<TripListRow> = {
  type: 'trip',
  schemaId: '#/$defs/trip',
  noun: { one: 'trip', many: 'trips' },
  heading: 'Trips',
  id: (t) => t.id,
  title: (t) => t.title,
  subtitle: (t) => [lengthLabel(t.nights, t.days), t.region].filter(Boolean).join(' · '),
  image: (t) => t.cover,
  badges: publicTripBadges,
  cardFooter: (t) => (
    <>
      <span className="card-links trip-links">
        <a href={tripHref(t.slug)}>Public page</a>
      </span>
      {t.isDone ? <span hidden data-trip-done="" /> : null}
    </>
  ),
  iconFor: () => 'calendar',
  fallbackLabel: (t) => t.region,
  primary: 'link',
  geo: (t) => (t.lat !== null && t.lon !== null ? { lat: t.lat, lon: t.lon } : null),
  facets: [
    {
      param: 'season',
      label: 'When',
      type: 'multi',
      order: [...Array.from({ length: 12 }, (_, i) => String(i + 1)), 'none'],
      options: (t) => (t.seasonMonths.length ? t.seasonMonths.map((m) => ({ value: String(m), label: MONTH_NAMES[m - 1] })) : [{ value: 'none', label: 'Season not set yet' }]),
    },
    { param: 'kind', label: 'Source', type: 'multi', order: ['full', 'summary', 'overview'], options: (t) => [{ value: t.depth, label: DEPTH_LABEL[t.depth] }] },
    { param: 'country', label: 'Country', type: 'single', options: (t) => (t.country ? [{ value: t.country, label: t.countryName }] : []) },
    {
      param: 'kid',
      label: 'Kids',
      type: 'single',
      order: ['unknown'],
      options: (t) => (t.ageFit === null ? [{ value: 'unknown', label: 'No age guidance yet' }] : [{ value: String(t.ageFit), label: `Ages ${t.ageFit}+` }]),
    },
  ],
  columns: [
    col('title', 'Trip', ({ row }) => <span className="cell-name">{row.original.title}</span>, (t) => t.title, 280),
    col('nights', 'Nights', ({ row }) => (row.original.nights === null ? dash : <span className="num">{row.original.nights}</span>), (t) => t.nights ?? '', 90, { align: 'right' }),
    col('days', 'Days', ({ row }) => (row.original.days === null ? dash : <span className="num">{row.original.days}</span>), (t) => t.days ?? '', 80, { align: 'right' }),
    col('season', 'Valid for', ({ row }) => row.original.seasonLabel ?? <span className="dash">Not set yet</span>, (t) => t.seasonLabel ?? '', 200),
    col('countries', 'Country', ({ row }) => row.original.countryName || dash, (t) => t.countryName, 130),
    col('kids', 'Kids', ({ row }) => kidsText(row.original) || dash, kidsText, 100),
    col('depth', 'Depth', ({ row }) => DEPTH_LABEL[row.original.depth], (t) => DEPTH_LABEL[t.depth], 120),
  ],
  defaultColumns: ['title', 'nights', 'season', 'countries', 'kids', 'depth'],
  groupBy: [
    { id: 'phase', label: 'Plan', key: phase, title: (t) => PHASE_TITLE[phase(t)], subtitle: (t) => (t.isDone ? 'Trips already taken, kept as templates to copy' : '') },
    { id: 'country', label: 'Country', key: (t) => t.country || '~', title: (t) => t.countryName || 'Country not set' },
    { id: 'depth', label: 'Depth', key: (t) => String(DEPTH_RANK[t.depth]), title: (t) => DEPTH_LABEL[t.depth] },
  ],
  defaultGroup: 'phase',
  sorts: {
    title: { label: 'Name', value: (t) => t.title },
    nights: { label: 'Length', value: (t) => t.nights },
    depth: { label: 'Depth', value: (t) => DEPTH_RANK[t.depth] },
    country: { label: 'Country', value: (t) => t.countryName || null },
  },
  defaultSort: (a, b) => Number(a.isDone) - Number(b.isDone) || DEPTH_RANK[a.depth] - DEPTH_RANK[b.depth] || a.title.localeCompare(b.title),
  defaultSortLabel: 'Most complete first',
  search: (t) => [t.title, t.region, t.countryName, t.firstBase ?? ''].join(' '),
  href: (t) => tripHref(t.slug),
  detail: [],
  actions: (t) => (
    <div className="link-row">
      <a className="btn btn-primary" href={tripHref(t.slug)}>
        Open the plan <Icon name="arrow" size={14} />
      </a>
    </div>
  ),
  ops: {},
  emptyHint: 'Try removing a filter, or search for a different name.',
  renderMap: (rows) => <TripsMap rows={rows} />,
};
