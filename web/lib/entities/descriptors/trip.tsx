import type { ColumnDef } from '@tanstack/react-table';
import { Icon } from '@/components/ui/Icon';
import dynamic from 'next/dynamic';
import { DEPTH_LABEL, DEPTH_NOTICE, tripHref } from '@/components/trips/format';
import type { TripListRow } from '@/components/trips/types';
import type { TripRow } from '@/lib/data/types';
import { MONTH_NAMES } from '@/lib/format/season';
import { TripTagChips } from '@/components/trips/tags/TripTagChips';
import { AROUND_ORDER, HIKE_ORDER, HUB_BANDS, LENGTH_LABELS, LENGTH_ORDER, PERDAY_ORDER, PHASE_FOR_LENGTH, lengthCell, hubBandOf, kidsLabel, lengthLine } from '@/components/trips/tags/labels';
import { AROUND_LABEL } from '@/components/trips/tags/chips';
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
  if (t.depth !== 'full') out.push({ text: DEPTH_NOTICE[t.depth], tone: 'warn', icon: 'info', title: t.depth === 'summary' ? 'A shorter day list with the main stops' : 'No day list yet; this is an overview' });
  return out;
}

// the map view (MapLibre wrapper, camera and card) loads only when the Map view is chosen, so the list pages stay inside the JS budget
const TripsMap = dynamic(() => import('@/components/trips/TripsMap').then((m) => m.TripsMap), { ssr: false });

const PHASE_TITLE = { plan: 'Published plans', done: 'Finished plans, use as templates' } as const;
const phase = (t: TripListRow) => (t.isDone ? 'done' : 'plan');
const DEPTH_RANK = { full: 0, summary: 1, overview: 2 } as const;

function col(id: string, header: string, cell: ColumnDef<TripListRow, unknown>['cell'], text: (t: TripListRow) => string | number, size = 140, opts: { align?: 'right'; sort?: boolean } = {}): ColumnDef<TripListRow, unknown> {
  return { id, header, cell, size, minSize: Math.min(70, size), enableSorting: opts.sort !== false, meta: { label: header, text, align: opts.align } } as ColumnDef<TripListRow, unknown>;
}

const lengthRank = (t: TripListRow): number => {
  const i = t.length ? LENGTH_ORDER.indexOf(t.length) : -1;
  return i === -1 ? 99 : i;
};
const dash = <span className="dash">&ndash;</span>;
const kidsText = (t: TripListRow) => (t.ageFit === null ? '' : kidsLabel(t.ageFit, t.kidsBasis).text);
const PER_DAY_LABEL: Record<string, string> = { u1: 'Under 1 h', '1-2': '1 to 2 h', '2-3': '2 to 3 h', '3+': '3 h and more' };

export const tripDescriptor: EntityDescriptor<TripListRow> = {
  type: 'trip',
  schemaId: '#/$defs/trip',
  noun: { one: 'trip', many: 'trips' },
  heading: 'Trips',
  id: (t) => t.id,
  title: (t) => t.title,
  subtitle: lengthLine,
  image: (t) => t.cover,
  badges: publicTripBadges,
  // the Highlights line: up to two anchors (relevance 6.2), never a relevance chip
  summary: (t) => (t.highlights.length ? `Highlights: ${t.highlights.join(' · ')}` : ''),
  cardFooter: (t) => (
    <>
      <TripTagChips row={t} />
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
  // Four primary pills (principle P4): Where, When, Length, Kids. The rest sit under "More filters".
  facets: [
    {
      param: 'country',
      label: 'Where',
      type: 'multi',
      groupOrder: ['Continents', 'Countries'],
      // the continent first, then every country the plan visits (a value is an upper-case code, so a continent is its name in kebab case)
      options: (t) => [
        ...t.continents.map((c) => ({ value: c.toUpperCase().replace(/\s+/g, '-'), label: c, group: 'Continents' })),
        ...t.countries.map((c) => ({ value: c.code, label: c.name, group: 'Countries' })),
      ],
    },
    {
      param: 'season',
      label: 'When',
      type: 'multi',
      order: [...Array.from({ length: 12 }, (_, i) => String(i + 1)), 'none'],
      options: (t) => (t.seasonMonths.length ? t.seasonMonths.map((m) => ({ value: String(m), label: MONTH_NAMES[m - 1] })) : [{ value: 'none', label: 'Season not set yet' }]),
    },
    {
      param: 'length',
      label: 'Length',
      type: 'multi',
      order: LENGTH_ORDER,
      options: (t) => (t.length ? [{ value: t.length, label: LENGTH_LABELS[t.length] ?? t.length }] : []),
    },
    {
      // "Youngest child", as on Places. Trips have no rule-versus-advice split yet (a plan's "Kids from N" is our estimate), so a plan above the
      // age fades and is never hidden. A plan with no age guidance is hidden when an age is picked and counted as not checked yet.
      param: 'kid',
      label: 'Youngest child',
      type: 'single',
      control: 'age',
      controlNote: 'Trips above this age fade; none are hidden yet',
      order: ['unknown'],
      options: (t) =>
        t.ageFit === null
          ? [{ value: 'unknown', label: 'No age guidance yet', hint: 'Hidden when you pick an age' }]
          : Array.from({ length: 18 }, (_, age) => ({ value: String(age), label: age === 0 ? 'Baby' : String(age) })),
      gap: { value: 'unknown', note: 'not checked yet' },
      note: (matched, sel) => {
        const age = Number(sel[0]);
        if (!/^\d{1,2}$/.test(sel[0] ?? '')) return null;
        const stretch = matched.filter((t) => t.ageFit !== null && t.ageFit > age).length;
        return stretch ? `${stretch} ${stretch === 1 ? 'is a stretch' : 'are a stretch'} at ${age}, shown faded` : null;
      },
    },
    { param: 'tag', label: 'Activities', type: 'multi', tier: 'more', options: (t) => t.activities.map((a) => ({ value: a.id, label: a.label })) },
    {
      param: 'effort',
      label: 'Hike effort',
      type: 'multi',
      tier: 'more',
      order: [...HIKE_ORDER],
      hideIfEmpty: true,
      options: (t) => (t.hike ? [{ value: t.hike, label: t.hike.charAt(0).toUpperCase() + t.hike.slice(1) }] : []),
    },
    {
      param: 'stroller',
      label: 'Stroller days',
      type: 'single',
      tier: 'more',
      order: ['friendly', 'some'],
      hideIfEmpty: true,
      options: (t) => (t.strollerDays === null ? [] : t.strollerDays === 'friendly' ? [{ value: 'friendly', label: 'Stroller-friendly', hint: 'Every day has an easy option' }, { value: 'some', label: 'Some stroller days' }] : [{ value: 'some', label: 'Some stroller days', hint: `${t.strollerDays.n} of ${t.strollerDays.of} days` }]),
    },
    {
      param: 'around',
      label: 'Getting around',
      type: 'multi',
      tier: 'more',
      order: [...AROUND_ORDER],
      hideIfEmpty: true,
      options: (t) => t.around.map((a) => ({ value: a, label: AROUND_LABEL[a] ?? a })),
    },
    {
      param: 'perday',
      label: 'Driving per day',
      type: 'multi',
      tier: 'more',
      order: [...PERDAY_ORDER],
      hideIfEmpty: true,
      options: (t) => (t.perDay ? [{ value: t.perDay, label: PER_DAY_LABEL[t.perDay] ?? t.perDay }] : []),
    },
    {
      param: 'shape',
      label: 'Shape',
      type: 'single',
      tier: 'more',
      order: ['one-base', 'road-trip'],
      hideIfEmpty: true,
      options: (t) => (t.shape ? [{ value: t.shape, label: t.shape === 'one-base' ? 'One base' : 'Road trip' }] : []),
    },
    { param: 'kind', label: 'Source', type: 'multi', tier: 'more', order: ['full', 'summary', 'overview'], options: (t) => [{ value: t.depth, label: DEPTH_LABEL[t.depth] }] },
    {
      // the hub matrix (backlog 3.12) is not built: with no value on the short trips the 60% rule hides this pill, silently
      param: 'drive',
      label: 'From Toronto',
      type: 'single',
      tier: 'more',
      order: HUB_BANDS.map((b) => `toronto-${b.n}`),
      // named in the count line's "Why these?" (L3b round 1): a facet hidden for want of data is never a silent loss
      guard: { among: (t) => t.lengthClass !== null && t.lengthClass !== 'multi-day', what: 'few trips have a drive time yet' },
      options: (t) => {
        if (t.fromHubMin === null) return [];
        const b = hubBandOf(t.fromHubMin);
        // the ≈ for an estimate shows in the card's mono line; a band holds routed and estimated trips together
        return [{ value: `toronto-${b.n}`, label: b.label }];
      },
    },
  ],
  columns: [
    col('title', 'Trip', ({ row }) => <span className="cell-name">{row.original.title}</span>, (t) => t.title, 280),
    col('fit', 'Fit', ({ row }) => (row.original.ageFit !== null && row.original.ageFit >= 1 ? <span className="fit-chip" title={`Plan suits ${row.original.ageFit}+`}>{row.original.ageFit}+</span> : null), () => '', 56, { sort: false }),
    col('length', 'Length', ({ row }) => (row.original.length ? lengthCell(row.original.length) : dash), (t) => lengthCell(t.length), 170),
    col('nights', 'Nights', ({ row }) => (row.original.nights === null ? dash : <span className="num">{row.original.nights}</span>), (t) => t.nights ?? '', 90, { align: 'right' }),
    col('days', 'Days', ({ row }) => (row.original.days === null ? dash : <span className="num">{row.original.days}</span>), (t) => t.days ?? '', 80, { align: 'right' }),
    col('season', 'Valid for', ({ row }) => row.original.seasonLabel ?? <span className="dash">Not set yet</span>, (t) => t.seasonLabel ?? '', 200),
    col('countries', 'Country', ({ row }) => row.original.countryName || dash, (t) => t.countryName, 130),
    col('kids', 'Kids', ({ row }) => kidsText(row.original) || dash, kidsText, 100),
    col('depth', 'Depth', ({ row }) => DEPTH_LABEL[row.original.depth], (t) => DEPTH_LABEL[t.depth], 120),
  ],
  defaultColumns: ['title', 'fit', 'length', 'nights', 'season', 'countries', 'kids', 'depth'],
  groupBy: [
    { id: 'phase', label: 'Plan', key: phase, title: (t) => PHASE_TITLE[phase(t)], subtitle: (t) => (t.isDone ? 'Kept as templates to copy' : '') },
    // Day trips first, then overnights, weekends, long weekends and the 4+ bands (short-trips 3.3)
    { id: 'length', label: 'Length', key: (t) => String(lengthRank(t)), order: (t) => lengthRank(t), title: (t) => (t.length ? PHASE_FOR_LENGTH[t.length] : 'Length not set') },
    { id: 'country', label: 'Country', key: (t) => t.country || '~', title: (t) => t.countryName || 'Country not set' },
    { id: 'depth', label: 'Depth', key: (t) => String(DEPTH_RANK[t.depth]), title: (t) => DEPTH_LABEL[t.depth] },
  ],
  defaultGroup: 'phase',
  sorts: {
    title: { label: 'Name', value: (t) => t.title },
    nights: { label: 'Length', value: (t) => t.nights },
    length: { label: 'Length class', value: (t) => lengthRank(t) },
    depth: { label: 'Depth', value: (t) => DEPTH_RANK[t.depth] },
    country: { label: 'Country', value: (t) => t.countryName || null },
  },
  defaultSort: (a, b) => Number(a.isDone) - Number(b.isDone) || DEPTH_RANK[a.depth] - DEPTH_RANK[b.depth] || a.title.localeCompare(b.title),
  defaultSortLabel: 'Most complete first',
  // a plan above the chosen age fades with the reason on its card (there is no rule split for trips yet)
  fadeBy: 'plan',
  fadeFrom: (t) => (t.ageFit !== null && t.ageFit >= 1 ? t.ageFit : undefined),
  fade: (t) => (t.ageFit !== null && t.ageFit >= 1 ? Array.from({ length: Math.min(t.ageFit, 18) }, (_, i) => i).join(' ') : undefined),
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
