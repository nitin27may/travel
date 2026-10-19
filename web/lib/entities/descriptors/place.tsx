import type { ColumnDef } from '@tanstack/react-table';
import dynamic from 'next/dynamic';
import { PlaceCardFooter } from '@/components/places/PlaceCardFooter';
import { Elevation, Stat } from '@/components/entity/cells';
import type { PlaceListRow } from '@/components/places/rows';
import { Icon, kindIcon } from '@/components/ui/Icon';
import { MONTH_NAMES, seasonLabel } from '@/lib/format/season';
import { KID_HINTS, KID_ICONS, KID_LABELS, TAG_KIND_ORDER, cap } from '../labels';
import type { Badge, EntityDescriptor } from '../types';

// the Map view loads when first opened, so the list's first load stays inside the JS budget
const PlacesMap = dynamic(() => import('@/components/places/PlacesMap').then((m) => m.PlacesMap), { ssr: false, loading: () => <p className="muted">Loading map</p> });

/** The facet and group name of a kind: one name per kind, whatever a place's own label says (a hut is an Eatery here). */
const kindName = (k: string) => cap(k);

const lc = (s: string) => s.toLowerCase();

/** The honesty markers a card shows (keep-from-live-site). The full list, with reasons, is on the place page. */
const CARD_HONESTY: Record<string, string> = {
  location_unconfirmed: 'The pin is not settled. The place page says why.',
  unverified: 'The facts are not confirmed yet. The place page says why.',
  no_source: 'No source is recorded yet.',
};

export function placeBadges(p: PlaceListRow): Badge[] {
  const out: Badge[] = [
    { text: p.kindLabel, tone: 'kind', icon: kindIcon(p.kind) },
  ];
  if (p.season.length) out.push({ text: seasonLabel(p.season), tone: 'season', icon: 'calendar', title: 'Best months' });
  if (p.kid_fit !== 'unknown') out.push({ text: KID_LABELS[p.kid_fit] ?? p.kid_fit, tone: 'kid', icon: KID_ICONS[p.kid_fit] ?? 'user', title: KID_HINTS[p.kid_fit] });
  for (const h of p.honesty) if (h.id in CARD_HONESTY) out.push({ text: h.label, tone: 'warn', icon: 'info', title: CARD_HONESTY[h.id] });
  return out;
}

export const placeLocation = (p: PlaceListRow) => [p.area_name, p.region_name, p.country_name].filter(Boolean).join(', ');

/** "Usable · 13 of 15" for the table and the card. */
export const completenessText = (p: PlaceListRow) => p.completeness.label;

type PlaceCol = ColumnDef<PlaceListRow, unknown>;
interface ColMeta {
  label: string;
  align?: 'right';
  /** Plain text of the cell, for CSV export. */
  text: (p: PlaceListRow) => string | number;
  csvLabel: string;
}
function col(id: string, header: string, cell: PlaceCol['cell'], text: (p: PlaceListRow) => string | number, opts: { size?: number; align?: 'right'; sort?: boolean; csvLabel?: string } = {}): PlaceCol {
  return {
    id,
    header,
    cell,
    size: opts.size ?? 140,
    minSize: 70,
    enableSorting: opts.sort !== false,
    meta: { label: header, align: opts.align, text, csvLabel: opts.csvLabel ?? header } satisfies ColMeta,
  } as PlaceCol;
}

const sourceCount = (p: PlaceListRow) => p.sourceTypes.length;
const sourceText = (p: PlaceListRow) => (p.sourceTypes.length ? `${p.sourceTypes.length} ${p.sourceTypes.length === 1 ? 'source' : 'sources'}` : 'None yet');

const columns: PlaceCol[] = [
  col('name', 'Name', ({ row }) => <span className="cell-name">{row.original.name}</span>, (p) => p.name, { size: 230 }),
  col('kind', 'Kind', ({ row }) => <span className="cell-icon"><Icon name={kindIcon(row.original.kind)} size={14} />{row.original.kindLabel}</span>, (p) => p.kindLabel, { size: 130 }),
  col('country', 'Country', ({ row }) => row.original.country_name, (p) => p.country_name, { size: 130 }),
  col('region', 'Region', ({ row }) => row.original.region_name, (p) => p.region_name, { size: 150 }),
  col('area', 'Area', ({ row }) => row.original.area_name, (p) => p.area_name, { size: 200 }),
  col('elevation', 'Elevation', ({ row }) => <Elevation m={row.original.elevation_m} />, (p) => p.elevation_m ?? '', { size: 120, align: 'right', csvLabel: 'Elevation (m)' }),
  col('km', 'Length', ({ row }) => (row.original.km === null ? <span className="dash">&ndash;</span> : <Stat k="km" v={row.original.km} />), (p) => p.km ?? '', { size: 160, align: 'right', csvLabel: 'Length (km)' }),
  col('gain', 'Climb', ({ row }) => (row.original.gain_m === null ? <span className="dash">&ndash;</span> : <Stat k="gain_m" v={row.original.gain_m} />), (p) => p.gain_m ?? '', { size: 170, align: 'right', csvLabel: 'Climb (m)' }),
  col('season', 'Season', ({ row }) => seasonLabel(row.original.season) || <span className="dash">&ndash;</span>, (p) => seasonLabel(p.season), { size: 130 }),
  col('kid', 'Kids', ({ row }) => (row.original.kid_fit === 'unknown' ? <span className="dash">&ndash;</span> : KID_LABELS[row.original.kid_fit] ?? row.original.kid_fit), (p) => KID_LABELS[p.kid_fit] ?? p.kid_fit, { size: 190 }),
  col('tags', 'Tags', ({ row }) => row.original.tags.map((t) => t.label).join(', '), (p) => p.tags.map((t) => t.label).join('; '), { size: 220, sort: false }),
  col('sources', 'Sources', ({ row }) => (row.original.sourceTypes.length ? sourceText(row.original) : <span className="dash">None yet</span>), sourceCount, { size: 110 }),
  col('complete', 'Completeness', ({ row }) => completenessText(row.original), (p) => p.completeness.label, { size: 160 }),
  col('plan', 'Plan', ({ row }) => row.original.trips[0]?.title ?? <span className="dash">&ndash;</span>, (p) => p.trips[0]?.title ?? '', { size: 190 }),
];

const aliasMatch = (values: (string | undefined)[], selected: string[]) => {
  const want = lc(selected[0] ?? '');
  return !want || values.some((v) => lc(v ?? '') === want);
};

/** The `trip` facet value for a place no public trip uses. */
const NO_TRIP = 'none';

const COMPLETENESS_RANK: Record<string, number> = { draft: 0, usable: 1, complete: 2 };

export const placeDescriptor: EntityDescriptor<PlaceListRow> = {
  type: 'place',
  schemaId: '#/$defs/places',
  noun: { one: 'place', many: 'places' },
  heading: 'Places',
  id: (p) => p.id,
  title: (p) => p.name,
  subtitle: placeLocation,
  image: (p) => p.image,
  badges: placeBadges,
  listAside: (p) => (
    <>
      {p.km !== null ? <Stat k="km" v={p.km} /> : null}
      {p.gain_m !== null ? <Stat k="gain_m" v={p.gain_m} /> : null}
      {p.elevation_m !== null ? <Elevation m={p.elevation_m} /> : null}
    </>
  ),
  cardFooter: (p) => <PlaceCardFooter p={p} />,
  iconFor: (p) => kindIcon(p.kind),
  fallbackLabel: (p) => p.kindLabel,
  primary: 'link',
  geo: (p) => (p.lat !== null && p.lon !== null ? { lat: p.lat, lon: p.lon } : null),
  // Four primary filters (principle P4): Country, Kind, Season, Kids. The rest sit under "More filters".
  facets: [
    { param: 'country', label: 'Country', type: 'single', options: (p) => [{ value: p.country, label: p.country_name }] },
    {
      param: 'kind',
      label: 'Kind',
      type: 'multi',
      options: (p) => [{ value: p.kind, label: kindName(p.kind) }],
      // an old link may still say kind=park or kind=city
      match: (p, sel) => sel.some((v) => v === p.kind || v === p.legacyKind),
    },
    {
      param: 'season',
      label: 'Season',
      type: 'multi',
      order: Array.from({ length: 12 }, (_, i) => String(i + 1)),
      options: (p) => p.season.map((m) => ({ value: String(m), label: MONTH_NAMES[m - 1] })),
    },
    {
      param: 'kid',
      label: 'Kids',
      type: 'single',
      order: ['yes', 'strong-kid', 'no', 'unknown'],
      options: (p) => [{ value: p.kid_fit, label: KID_LABELS[p.kid_fit] ?? p.kid_fit, hint: KID_HINTS[p.kid_fit] }],
      // a place nobody has assessed never passes a Kids choice, and the count line says how many were left out
      gap: { value: 'unknown', note: 'not checked yet' },
    },
    {
      param: 'region',
      label: 'Region',
      type: 'single',
      tier: 'more',
      dependsOn: 'country',
      options: (p) => [{ value: p.region, label: p.region_name }],
      match: (p, sel) => aliasMatch(p.regionAliases, sel),
    },
    {
      param: 'area',
      label: 'Area',
      type: 'single',
      tier: 'more',
      dependsOn: 'region',
      options: (p) => [{ value: p.area, label: p.area_name }],
      match: (p, sel) => aliasMatch([p.area, p.area_name], sel),
    },
    { param: 'tag', label: 'Tag', type: 'single', tier: 'more', groupOrder: TAG_KIND_ORDER, options: (p) => p.tags.map((t) => ({ value: t.id, label: t.label, group: t.kind })) },
    {
      param: 'trip',
      label: 'In a public trip',
      type: 'single',
      tier: 'more',
      last: [NO_TRIP],
      options: (p) => (p.trips.length ? p.trips.map((t) => ({ value: t.slug, label: t.title })) : [{ value: NO_TRIP, label: 'Not in a trip yet' }]),
    },
    // Slots for the S1 suitability data (suitability-display.md section 5). Hidden until `family_effort` and `stroller_ok` ship:
    // then each gets its options and loses `hidden`, and nothing else in the bar changes.
    { param: 'effort', label: 'Effort', type: 'multi', tier: 'more', hidden: true, order: ['stroll', 'easy', 'moderate', 'hard', 'technical'], options: () => [] },
    { param: 'stroller', label: 'Stroller', type: 'single', tier: 'more', hidden: true, order: ['any', 'all-terrain'], options: () => [] },
  ],
  columns,
  defaultColumns: ['name', 'kind', 'region', 'area', 'season', 'kid', 'elevation', 'km', 'gain', 'sources', 'complete'],
  groupBy: [
    { id: 'country', label: 'Country', key: (p) => p.country, title: (p) => p.country_name },
    { id: 'region', label: 'Region', key: (p) => `${p.country}/${p.region}`, title: (p) => p.region_name, subtitle: (p) => p.country_name },
    { id: 'area', label: 'Area', key: (p) => `${p.country}/${p.region}/${p.area}`, title: (p) => p.area_name, subtitle: (p) => `${p.region_name}, ${p.country_name}` },
    { id: 'kind', label: 'Kind', key: (p) => p.kind, title: (p) => kindName(p.kind) },
  ],
  defaultGroup: 'country',
  sorts: {
    name: { label: 'Name', value: (p) => p.name },
    kind: { label: 'Kind', value: (p) => p.kindLabel },
    country: { label: 'Country', value: (p) => p.country_name },
    region: { label: 'Region', value: (p) => p.region_name },
    area: { label: 'Area', value: (p) => p.area_name },
    season: { label: 'Season', value: (p) => (p.season.length ? p.season[0] : null) },
    kid: { label: 'Kids', value: (p) => ['yes', 'strong-kid', 'no', 'unknown'].indexOf(p.kid_fit) },
    elevation: { label: 'Elevation', value: (p) => p.elevation_m },
    km: { label: 'Length', value: (p) => p.km },
    gain: { label: 'Climb', value: (p) => p.gain_m },
    sources: { label: 'Sources', value: (p) => p.sourceTypes.length },
    complete: { label: 'Completeness', value: (p) => COMPLETENESS_RANK[p.completeness.level] },
    plan: { label: 'Plan', value: (p) => p.trips[0]?.title ?? null },
    added: { label: 'Date added', value: (p) => p.added || null },
  },
  defaultSort: (a, b) =>
    a.country_name.localeCompare(b.country_name) || a.region_name.localeCompare(b.region_name) || a.area_name.localeCompare(b.area_name) || a.name.localeCompare(b.name),
  defaultSortLabel: 'Country, region, area',
  search: (p) => [p.name, p.area_name, p.region_name, p.country_name, p.tags.map((t) => t.label).join(' '), p.kindLabel, p.kind].join(' '),
  href: (p) => `/places/${p.slug}/`,
  detail: [],
  ops: {},
  emptyHint: 'Try removing a filter, or search for a different name.',
  renderMap: (rows, state) => <PlacesMap rows={rows} state={state} />,
};
