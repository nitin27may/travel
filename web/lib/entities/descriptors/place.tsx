import '@/styles/suitability.css';
import type { ColumnDef } from '@tanstack/react-table';
import { PlaceCardFooter } from '@/components/places/PlaceCardFooter';
import { Elevation, Stat } from '@/components/entity/cells';
import { PlacesMapLazy } from '@/components/entity/PlacesMapLazy';
import type { PlaceListRow } from '@/components/places/rows';
import { Icon, kindIcon } from '@/components/ui/Icon';
import { MONTH_NAMES, seasonLabel } from '@/lib/format/season';
import { KID_HINTS, KID_ICONS, KID_LABELS, TAG_KIND_ORDER, cap } from '../labels';
import { EFFORT_LABELS, EFFORT_VALUES, nodeLabel, scopedFacets, typeInScope } from '../facets';
import type { Badge, EntityDescriptor, FacetDef, FacetOption } from '../types';

/** The facet and group name of a kind: one name per kind, whatever a place's own label says (a hut is an Eatery here). */
const kindName = (k: string) => cap(k);

const lc = (s: string) => s.toLowerCase();

/** The honesty markers a card shows (keep-from-live-site). The full list, with reasons, is on the place page. */
const CARD_HONESTY: Record<string, string> = {
  location_unconfirmed: 'The pin is not settled. The place page says why.',
  unverified: 'The facts are not confirmed yet. The place page says why.',
  no_source: 'No source is recorded yet.',
};

/**
 * The suitability chips of a card (suitability-display D5): the kids chip and the effort name, built from the row's own
 * `kids_from`, `kids_basis` and `effort`, so the list ships nothing new (P8). A rule is the filled chip with a lock, our advice is
 * the outlined chip with a person, and a place nobody has checked shows the dashed "Not checked yet". The look comes from
 * `data-value` in styles/suitability.css.
 */
export function suitChips(p: PlaceListRow): Badge[] {
  const out: Badge[] = [];
  if (p.kids_from !== null && p.kids_basis === 'rule') out.push({ text: p.kids_from === 0 ? 'No minimum age' : `Age ${p.kids_from}+`, tone: 'kid', value: 'rule', title: 'Operator or official rule' });
  else if (p.kids_from !== null) out.push({ text: p.kids_from === 0 ? 'Any age' : `From about ${p.kids_from}`, tone: 'kid', value: 'advice', icon: 'user', title: 'Our judgement' });
  else if (p.kid_fit !== 'unknown') out.push({ text: KID_LABELS[p.kid_fit] ?? p.kid_fit, tone: 'kid', icon: KID_ICONS[p.kid_fit] ?? 'user', title: KID_HINTS[p.kid_fit] });
  else out.push({ text: 'Not checked yet', tone: 'muted', value: 'gap', title: 'Kids: not checked yet' });
  if (p.effort) out.push({ text: p.effort, tone: 'neutral', value: 'effort', icon: 'trail', title: 'How hard, in family terms' });
  // a trail or trek nobody has rated shows the gap on the card, as it does on the page (verifier 9)
  else if (typeInScope(p.type, ['nature.trail', 'nature.trek'])) out.push({ text: 'Effort: not checked yet', tone: 'muted', value: 'gap', title: 'Effort: not checked yet' });
  return out;
}

export function placeBadges(p: PlaceListRow): Badge[] {
  const out: Badge[] = [
    { text: p.kindLabel, tone: 'kind', icon: kindIcon(p.kind) },
  ];
  // at most one relevance chip, right after the kind (relevance 6.2); outlined, never filled, amber or green
  if (p.badge) out.push({ text: p.badge, tone: 'neutral', value: 'relevance', icon: 'route', title: 'Why people travel for it' });
  out.push(...suitChips(p));
  if (p.season.length) out.push({ text: seasonLabel(p.season), tone: 'season', icon: 'calendar', title: 'Best months' });
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

/** What an old `kind=` value stands for in the type tree (the place kinds of the list before the Kind pill read types). */
const LEGACY_KIND_SCOPE: Record<string, string[]> = {
  trail: ['nature.trail'],
  lake: ['water.body'],
  viewpoint: ['nature.viewpoint'],
  waterfall: ['water.falls'],
  sight: ['culture'],
  town: ['settlement'],
  area: ['nature.protected'],
  activity: ['intent:do'],
  lift: ['ride.lift'],
  stay: ['stay'],
  eatery: ['food'],
};

const EFFORT_HINTS: Record<string, string> = {
  stroll: 'Flat, made surface',
  easy: 'A clear path, no hands',
  moderate: 'Rough or steep, sure footing',
  hard: 'Long, exposed, or hands sometimes',
  technical: 'Harness or scrambling',
};

/** The Kind pill: the domain, then the category, of the row's type (contract 7.1 rule 1). A place with no type is "Other". */
function kindOptions(p: PlaceListRow): FacetOption[] {
  if (!p.type) return [{ value: 'other', label: 'Other', group: 'Categories' }];
  const [domain, category] = p.type.split('.');
  const catId = category ? `${domain}.${category}` : null;
  const out: FacetOption[] = [{ value: domain!, label: nodeLabel(domain!) ?? cap(domain!), group: 'Domains' }];
  if (catId) out.push({ value: catId, label: nodeLabel(catId) ?? cap(category!), group: 'Categories' });
  return out;
}

const isAge = (v: string) => /^\d{1,2}$/.test(v);
/** A rule above the age hides the place; advice above it only fades the card; a gap never passes (suitability-display 5). */
export const passesAge = (p: PlaceListRow, age: number): boolean => p.kids_from !== null && !(p.kids_basis === 'rule' && p.kids_from > age);

function kidOptions(p: PlaceListRow): FacetOption[] {
  const out: FacetOption[] = [{ value: p.kid_fit, label: KID_LABELS[p.kid_fit] ?? p.kid_fit, hint: KID_HINTS[p.kid_fit] }];
  for (let age = 0; age <= 17; age += 1) if (passesAge(p, age)) out.push({ value: String(age), label: `Youngest child ${age}` });
  return out;
}

function strollerOptions(p: PlaceListRow): FacetOption[] {
  const any = p.flags.includes('stroller');
  const out: FacetOption[] = [];
  if (any) out.push({ value: 'any', label: 'Any stroller', hint: 'Paved, boardwalk or fine gravel' });
  if (any || p.flags.includes('stroller_part')) out.push({ value: 'all-terrain', label: 'All-terrain stroller', hint: 'Packed gravel and roots too' });
  return out;
}

/** The facet defs of this descriptor, for tests. */
export type PlaceFacetDef = FacetDef<PlaceListRow>;


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
  fadeFrom: (p) => (p.kids_basis === 'advice' && p.kids_from !== null && p.kids_from >= 1 ? p.kids_from : undefined),
  fade: (p) => (p.kids_basis === 'advice' && p.kids_from !== null && p.kids_from >= 1 ? Array.from({ length: Math.min(p.kids_from, 18) }, (_, i) => i).join(' ') : undefined),
  iconFor: (p) => kindIcon(p.kind),
  fallbackLabel: (p) => p.kindLabel,
  primary: 'link',
  geo: (p) => (p.lat !== null && p.lon !== null ? { lat: p.lat, lon: p.lon } : null),
  // Four primary filters (principle P4): Country, Kind, Season, Kids. The rest sit under "More filters". Narrowing Kind adds that scope's
  // facets from the capture contract and promotes up to two of them into the bar (contract 7.1, 7.2).
  facets: [
    { param: 'country', label: 'Country', type: 'single', options: (p) => [{ value: p.country, label: p.country_name }] },
    {
      // domains first, then categories, each with a count (contract 7.1 rule 1)
      param: 'k',
      label: 'Kind',
      type: 'multi',
      groupOrder: ['Domains', 'Categories'],
      options: kindOptions,
      match: (p, sel) => sel.some((v) => typeInScope(p.type, [v])),
    },
    {
      // old links say kind=trail or kind=park: they still filter and show as a chip, but the pill is the Kind above
      param: 'kind',
      label: 'Kind',
      type: 'multi',
      legacy: true,
      tier: 'more',
      options: (p) => [{ value: p.kind, label: kindName(p.kind) }],
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
      // "Youngest child": a number is an age (0 to 17), read against `kids_from`; the older values (yes, strong-kid) are the kid-fit
      // chip and keep working in links. A rule above the age hides a place, advice above it fades its card, a gap never passes.
      param: 'kid',
      label: 'Kids',
      type: 'single',
      control: 'age',
      order: ['yes', 'strong-kid', 'no', 'unknown'],
      options: kidOptions,
      match: (p, sel) => (isAge(sel[0] ?? '') ? passesAge(p, Number(sel[0])) : sel.includes(p.kid_fit)),
      gap: { value: 'unknown', note: 'not checked yet', isGap: (p, sel) => (isAge(sel[0] ?? '') ? p.kids_from === null : p.kid_fit === 'unknown') },
      note: (matched, sel) => {
        if (!isAge(sel[0] ?? '')) return null;
        const age = Number(sel[0]);
        const stretch = matched.filter((p) => p.kids_from !== null && p.kids_from > age).length;
        return stretch ? `for age ${age} · ${stretch} ${stretch === 1 ? 'is a stretch' : 'are a stretch'}, shown faded` : `for age ${age}`;
      },
    },
    {
      param: 'effort',
      label: 'Effort',
      type: 'multi',
      tier: 'more',
      hideIfEmpty: true,
      order: EFFORT_VALUES,
      options: (p) => (p.effort ? [{ value: p.effort.toLowerCase(), label: EFFORT_LABELS[p.effort.toLowerCase()] ?? p.effort, hint: EFFORT_HINTS[p.effort.toLowerCase()] }] : []),
      // boat tours, lifts and bungee have no effort rating: they are left out, and the count line says how many
      gap: { value: 'none', note: 'have no effort rating and are not shown', isGap: (p) => p.effort === null },
    },
    {
      param: 'stroller',
      label: 'Stroller',
      type: 'single',
      tier: 'more',
      hideIfEmpty: true,
      order: ['any', 'all-terrain'],
      options: strollerOptions,
      gap: { value: 'none', note: 'not checked yet', isGap: (p) => !p.flags.some((f) => f === 'stroller' || f === 'stroller_part' || f === '!stroller') },
      note: (matched) => {
        const part = matched.filter((p) => p.flags.includes('stroller_part')).length;
        return part ? `${part} for part of the way, marked on the card` : null;
      },
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
    ...scopedFacets<PlaceListRow>(),
  ],
  scope: {
    typeOf: (p) => p.type,
    legacyKind: (v) => LEGACY_KIND_SCOPE[v] ?? [],
    scoped: scopedFacets<PlaceListRow>().map((f) => f.param),
  },
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
  defaultSortLabel: 'Country, then places with photos',
  // 3.56: inside a country the places with a photo lead, and countries that have a photo come before those with none
  defaultTier: { tier: (p) => p.country, lead: (p) => p.image !== null },
  search: (p) => [p.name, p.area_name, p.region_name, p.country_name, p.tags.map((t) => t.label).join(' '), p.kindLabel, p.kind].join(' '),
  href: (p) => `/places/${p.slug}/`,
  detail: [],
  ops: {},
  emptyHint: 'Try removing a filter, or search for a different name.',
  renderMap: (rows, state) => <PlacesMapLazy rows={rows} state={state} />,
};
