import type { ColumnDef } from '@tanstack/react-table';
import { Icon } from '@/components/ui/Icon';
import type { TripRow } from '@/lib/data/types';
import type { Badge, EntityDescriptor } from '../types';

const phase = (t: TripRow) => (t.when === 'past' ? 'past' : t.when === 'unknown' ? 'unscheduled' : 'upcoming');
const PHASE_LABEL: Record<string, string> = { upcoming: 'Upcoming', past: 'Past', unscheduled: 'Dates open' };
const SOURCE_LABEL: Record<string, string> = { plan: 'Trip plan', legacy: 'Legacy page' };

export function tripBadges(t: TripRow): Badge[] {
  const out: Badge[] = [];
  if (t.badge) out.push({ text: t.badge, tone: t.when === 'today' || t.when === 'soon' ? 'status' : 'neutral', icon: 'calendar' });
  if (t.source === 'legacy') out.push({ text: 'Legacy page', tone: 'muted', icon: 'link', title: 'Built before the data model; opens the original page' });
  return out;
}

function col(id: string, header: string, cell: ColumnDef<TripRow, unknown>['cell'], text: (t: TripRow) => string | number, size = 150, sort = true): ColumnDef<TripRow, unknown> {
  return { id, header, cell, size, minSize: 70, enableSorting: sort, meta: { label: header, text } } as ColumnDef<TripRow, unknown>;
}

export const tripDescriptor: EntityDescriptor<TripRow> = {
  type: 'trip',
  schemaId: '#/$defs/trip',
  dataUrl: '/data/trips.json',
  noun: { one: 'trip', many: 'trips' },
  heading: 'Trips',
  id: (t) => t.id,
  title: (t) => t.title,
  subtitle: (t) => [t.dates, t.duration, t.region].filter(Boolean).join(', '),
  image: (t) => t.img,
  badges: tripBadges,
  summary: (t) => t.subtitle,
  iconFor: () => 'calendar',
  fallbackLabel: (t) => t.region,
  primary: 'link',
  geo: () => null,
  facets: [
    { param: 'status', label: 'When', type: 'multi', order: ['upcoming', 'past', 'unscheduled'], options: (t) => [{ value: phase(t), label: PHASE_LABEL[phase(t)] }] },
    { param: 'kind', label: 'Source', type: 'multi', options: (t) => [{ value: t.source, label: SOURCE_LABEL[t.source] }] },
  ],
  columns: [
    col('title', 'Trip', ({ row }) => <span className="cell-name">{row.original.title}</span>, (t) => t.title, 280),
    col('dates', 'Dates', ({ row }) => row.original.dates || '\u2013', (t) => t.dates, 190),
    col('duration', 'Length', ({ row }) => row.original.duration || '\u2013', (t) => t.duration, 110),
    col('region', 'Region', ({ row }) => row.original.region || '\u2013', (t) => t.region, 200),
    col('when', 'When', ({ row }) => row.original.badge || '\u2013', (t) => t.badge, 120),
    col('source', 'Source', ({ row }) => SOURCE_LABEL[row.original.source], (t) => SOURCE_LABEL[t.source], 120),
  ],
  defaultColumns: ['title', 'dates', 'duration', 'region', 'when', 'source'],
  groupBy: [{ id: 'phase', label: 'When', key: phase, title: (t) => PHASE_LABEL[phase(t)] }],
  defaultGroup: 'phase',
  sorts: {
    title: { label: 'Name', value: (t) => t.title },
    dates: { label: 'Date', value: (t) => t.date || null },
    duration: { label: 'Length', value: (t) => t.duration || null },
    region: { label: 'Region', value: (t) => t.region || null },
    when: { label: 'When', value: (t) => t.date || null },
    source: { label: 'Source', value: (t) => t.source },
  },
  defaultSort: (a, b) => {
    const order = { upcoming: 0, unscheduled: 1, past: 2 } as const;
    const pa = order[phase(a)];
    const pb = order[phase(b)];
    if (pa !== pb) return pa - pb;
    // upcoming soonest first, past most recent first
    return phase(a) === 'past' ? b.date.localeCompare(a.date) : (a.date || '9999').localeCompare(b.date || '9999');
  },
  defaultSortLabel: 'Soonest first',
  search: (t) => [t.title, t.subtitle, t.region, t.dates].join(' '),
  href: (t) => t.href || null,
  detail: [],
  actions: (t) =>
    t.href ? (
      <div className="link-row">
        <a className="btn btn-primary" href={t.href}>
          Open the plan <Icon name="arrow" size={14} />
        </a>
      </div>
    ) : null,
  ops: {},
  emptyHint: 'Try removing a filter, or search for a different name.',
};
