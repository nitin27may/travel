import { fromRow, fromSuit, type ShowRow } from '@/components/suit/Rows';
import type { GlanceSlotHtml } from '@/components/suit/html';
import { allTrailsLink, type AllTrailsLink } from '@/lib/map/links';
import type { PageModel } from '@/lib/public/sections';
import type { PublicSuitability } from '@/lib/public/suitability';
import { seasonShort } from './SeasonGrid';

// The trail key-facts strip (backlog 10.1, P3: length, climb, time, route type and who it suits at a glance). It is built from the same
// rows the sections below hold, by property key, so a value is never typed twice; a slot with no value is the "Not checked yet" chip, never
// a blank and never a yes (owner rule). No per-type code: the page asks for this strip only when the record is a trail.

/** The row a slot echoes: a section row, else a "Who it suits" row. */
export function findRow(model: PageModel, suit: PublicSuitability | null, key: string): { row: ShowRow; href: string } | null {
  for (const s of model.sections) {
    const r = s.rows.find((x) => x.key === key);
    if (r) return { row: fromRow(r), href: `#row-${key}` };
  }
  for (const g of suit?.groups ?? []) {
    const r = g.rows.find((x) => x.key === key);
    if (r) return { row: fromSuit(r), href: `#su-${key}` };
  }
  return null;
}

/** Values the page already holds from the older record, used only when the contract row is empty. */
export interface TrailExtras {
  km: number | null;
  gainM: number | null;
  /** the older record's adult time, as text */
  legacyTime: string | null;
  highPoint: string | null;
  shape: string | null;
  trailhead: string | null;
  hasHazards: boolean;
  hasTrack: boolean;
}

const GAP = (key: string, label: string): ShowRow => ({ key, label, text: null, look: 'gap', gap: true, val: null });
const made = (key: string, label: string, text: string, from?: ShowRow | null): ShowRow => ({ ...(from ?? GAP(key, label)), key, label, text, gap: false, look: 'info', ...(from ? {} : { val: null }) });

/** One slot from the first of `keys` that holds a value; a derived value `fallback` stands in when every key is empty. */
function slot(model: PageModel, suit: PublicSuitability | null, label: string, keys: string[], fallback: string | null = null, href = '#activity'): GlanceSlotHtml {
  const hits = keys.map((k) => ({ k, hit: findRow(model, suit, k) }));
  const filled = hits.find((h) => h.hit && !h.hit.row.gap && (h.hit.row.text || h.hit.row.valueType === 'season_rows'));
  if (filled?.hit) {
    const { row, href: h } = filled.hit;
    const value = (row.valueType === 'season_rows' ? seasonShort(row.value) : '') || row.text || '';
    return { row: { ...row, label }, href: h, value };
  }
  const anyRow = hits.find((h) => h.hit)?.hit;
  if (fallback) return { row: made(keys[0] ?? label, label, fallback), href: anyRow?.href ?? href, value: fallback };
  return { row: { ...(anyRow?.row ?? GAP(keys[0] ?? label, label)), label, gap: true, text: null }, href: anyRow?.href ?? href, value: '' };
}

export interface TrailStrip {
  slots: GlanceSlotHtml[];
  allTrails: AllTrailsLink;
}

/** The 14 facts of the strip, then the AllTrails tile (backlog 10.3): 15 tiles fill the 3-column grid with no short row. */
export function trailStrip(model: PageModel, suit: PublicSuitability | null, x: TrailExtras, place: { name: string; area: string | null; links: ReadonlyArray<{ kind: string; url: string }> }): TrailStrip {
  const t = (label: string, keys: string[], fallback: string | null = null, href?: string) => slot(model, suit, label, keys, fallback, href);
  const gain = findRow(model, suit, 'effort.drivers.gain_m')?.row;
  const loss = findRow(model, suit, 'effort.drivers.loss_m')?.row;
  const gainText = gain && !gain.gap && gain.text ? gain.text : x.gainM !== null ? `${x.gainM} m` : null;
  const lossText = loss && !loss.gap && loss.text ? loss.text : null;
  const climb = gainText || lossText ? [gainText ? `${gainText} up` : null, lossText ? `${lossText} down` : null].filter(Boolean).join(' · ') : null;
  const exposure = findRow(model, suit, 'exposure')?.row;
  const exp = exposure && !exposure.gap && exposure.text ? exposure.text : null;
  const hazard = [exp, x.hasHazards ? 'Hazards listed above' : null].filter(Boolean).join(' · ') || null;
  const slots: GlanceSlotHtml[] = [
    t('Length', ['effort.drivers.distance_km'], x.km !== null ? `${x.km} km` : null),
    t('Climb', ['effort.drivers.gain_m'], climb),
    t('High point', ['high_point_m'], x.highPoint),
    t('Adult time', ['adult_time_min'], x.legacyTime),
    t('Route type', ['ext.trail.shape'], x.shape),
    // our own grade (the chip) stands in when the source grade is missing, so a trail with a family scale never reads as empty
    t('Effort', ['effort.source_grade'], (suit?.chips[1] as { textNoTime?: string } | null)?.textNoTime ?? null),
    t('Surface', ['effort.drivers.surface']),
    t('Hazards and exposure', ['hazards', 'exposure'], hazard, '#warnings'),
    t('Dogs', ['ext.trail.dogs'], null, '#facilities'),
    t('Stroller', ['stroller'], null, '#suits'),
    t('Wheelchair', ['wheelchair'], null, '#suits'),
    t('Season', ['access_season'], null, '#when'),
    t('Trailhead and parking', ['access_points', 'starts_at'], x.trailhead, '#access'),
    t('Route status', ['geometry'], x.hasTrack ? 'Track stored' : null),
  ];
  // exposure and hazards read together; the first row found would hide the other
  if (hazard) slots[7] = { row: made('hazards', 'Hazards and exposure', hazard, slots[7]!.row.gap ? null : slots[7]!.row), href: slots[7]!.href, value: hazard };
  const shapeSlot = slots[4]!;
  if (!shapeSlot.row.gap && shapeSlot.value) slots[4] = { ...shapeSlot, value: shapeSlot.value.charAt(0).toUpperCase() + shapeSlot.value.slice(1) };
  // the climb slot reads up and down together even when the contract row holds the climb alone
  if (climb) slots[1] = { row: made('effort.drivers.gain_m', 'Climb', climb, gain ?? null), href: slots[1]!.href, value: climb };
  return { slots, allTrails: allTrailsLink({ name: place.name, area: place.area, links: place.links }) };
}
