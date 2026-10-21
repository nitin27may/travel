import type { FacetCount } from '@/lib/entities/filter';
import type { ActiveFilter } from '@/lib/entities/filter';
import type { EntityDescriptor, FacetParam, ListState } from '@/lib/entities/types';

// The pure half of the Where filter (nearby-and-regions 4.3): country, then state or province, then parks and areas. The keys are
// the URL keys the API will take (`country`, `region`, `area`); nothing here loads a file or knows a component.

export const WHERE_PARAMS = ['country', 'region', 'area'] as const;
export type WhereParam = (typeof WHERE_PARAMS)[number];
export type WhereLevel = 0 | 1 | 2;
export type WhereSelection = Record<WhereParam, string[]>;

export const isWhereParam = (p: string): p is WhereParam => (WHERE_PARAMS as readonly string[]).includes(p);

export function selectionOf(facets: ListState['facets']): WhereSelection {
  return { country: facets.country ?? [], region: facets.region ?? [], area: facets.area ?? [] };
}

/** What the second level is called: it follows the country (nearby-and-regions 4.2). */
export function regionNoun(country: string | undefined): { one: string; many: string } {
  const cc = (country ?? '').toUpperCase();
  if (cc === 'CA') return { one: 'Province', many: 'provinces' };
  if (cc === 'US') return { one: 'State', many: 'states' };
  return { one: 'Region', many: 'regions' };
}

const names = (sel: string[], label: (v: string) => string, noun: string): string => (sel.length <= 2 ? sel.map(label).join(', ') : `${sel.length} ${noun}`);

/** The pill's text: "Where", then the deepest choice: "Where · Alberta", "Where · Banff National Park, Yoho" or "Where · 3 areas". */
export function whereSummary(label: string, sel: WhereSelection, labelOf: (param: WhereParam, v: string) => string): string {
  if (sel.area.length) return `${label} · ${names(sel.area, (v) => labelOf('area', v), 'areas')}`;
  if (sel.region.length) return `${label} · ${names(sel.region, (v) => labelOf('region', v), regionNoun(sel.country[0]).many)}`;
  if (sel.country.length) return `${label} · ${labelOf('country', sel.country[0]!)}`;
  return label;
}

/** The next facet map after a country pick: another country drops the levels under it, the same one keeps them, and null clears the whole Where. */
export function pickCountry(facets: ListState['facets'], value: string | null): ListState['facets'] {
  if (value !== null && facets.country?.[0] === value) return facets;
  const next = { ...facets };
  delete next.region;
  delete next.area;
  if (value === null) delete next.country;
  else next.country = [value];
  return next;
}

export function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function pickRegion(facets: ListState['facets'], value: string | null, replace = false): ListState['facets'] {
  const next = { ...facets };
  delete next.area;
  if (value === null) delete next.region;
  else next.region = replace ? [value] : toggleIn(facets.region ?? [], value);
  if (!next.region?.length) delete next.region;
  return next;
}

export function pickArea(facets: ListState['facets'], value: string | null): ListState['facets'] {
  const next = { ...facets };
  if (value === null) delete next.area;
  else next.area = toggleIn(facets.area ?? [], value);
  if (!next.area?.length) delete next.area;
  return next;
}

/** Options that have rows, and the ones that have none under the other filters (a chosen value always stays in view so it can be switched off). */
export function splitZero(options: FacetCount[], selected: string[]): { shown: FacetCount[]; hidden: FacetCount[] } {
  const shown: FacetCount[] = [];
  const hidden: FacetCount[] = [];
  for (const o of options) (o.count > 0 || selected.includes(o.value) ? shown : hidden).push(o);
  return { shown, hidden };
}

export interface WhereMatch {
  level: WhereLevel;
  value: string;
  label: string;
  count: number;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Type to find (nearby-and-regions 4.3): one field across the levels that are known. Countries come from the manifest, the regions and
 * areas from the country that is open (its file is loaded); a region carries its other spellings in `hint` ("AB Alta"), so "AB" finds Alberta.
 * Nothing here loads a file for a country that is not open.
 */
export function findWhere(q: string, levels: { countries: FacetCount[]; regions: FacetCount[]; areas: FacetCount[] }): WhereMatch[] {
  const needle = fold(q);
  if (!needle) return [];
  const hit = (o: FacetCount, level: WhereLevel): WhereMatch | null => {
    const hay = [o.label, o.value, level === 1 ? o.hint ?? '' : ''].map(fold);
    const ok = hay.some((h) => h === needle || h.split(/[\s,]+/).some((w) => w.startsWith(needle)) || h.includes(needle));
    return ok ? { level, value: o.value, label: o.label, count: o.count } : null;
  };
  const out: WhereMatch[] = [];
  for (const [level, list] of [[0, levels.countries], [1, levels.regions], [2, levels.areas]] as const) for (const o of list) {
    const m = hit(o, level);
    if (m) out.push(m);
  }
  // exact name first, then the deeper level first (a park beats the country it shares a word with), then count
  return out.sort((a, b) => Number(fold(b.label) === needle) - Number(fold(a.label) === needle) || b.count - a.count);
}

/** Chip text for a Where filter is the bare value ("Alberta"), not "Region: Alberta"; every other chip keeps its label. */
export function whereChips(chips: ActiveFilter[], labelOf: (param: FacetParam, value: string) => string, on: boolean): ActiveFilter[] {
  if (!on) return chips;
  return chips.map((c) => {
    const [param, ...rest] = c.key.split(':');
    return isWhereParam(param!) ? { ...c, label: labelOf(param, rest.join(':')) } : c;
  });
}

/** The list state after one pick in the Where menu: the three facets are written whole, empty ones dropped, the focused row cleared. */
export function withWhere(state: ListState, facets: ListState['facets']): ListState {
  const next: ListState = { ...state, facets: { ...facets }, focus: null };
  for (const p of WHERE_PARAMS) if (!next.facets[p]?.length) delete next.facets[p];
  return next;
}

/**
 * The country level lists every country the manifest knows, whatever else is chosen, so a visitor can switch country without clearing first. The counts
 * the list holds are exact only for the countries whose files are loaded; the others come from the manifest. When nothing but Where narrows the list,
 * the manifest count is the right one for every country (Canada reads 178 with Alberta chosen, as "All of Canada" says). When another filter is on, a
 * country that is not loaded has no honest count yet, so it is listed with `count: -1` and the menu draws no number (P8: no file is loaded to count it).
 */
export function mergeCountries(counts: Record<string, FacetCount[]>, manifest: FacetCount[] | undefined, state: ListState): Record<string, FacetCount[]> {
  if (!manifest?.length) return counts;
  const have = new Map((counts.country ?? []).map((o) => [o.value, o]));
  const otherFilter = Boolean(state.q.trim() || state.bbox || state.f || state.sv || state.ids.length || Object.entries(state.facets).some(([k, v]) => v?.length && !isWhereParam(k)));
  const merged = manifest.map((m) => (otherFilter ? have.get(m.value) ?? { ...m, count: -1 } : { ...(have.get(m.value) ?? m), count: m.count }));
  for (const o of have.values()) if (!merged.some((m) => m.value === o.value)) merged.push(o);
  // the countries without a count keep the manifest's order (most places first); the rest go by their own count
  merged.sort((a, b) => Number(a.count < 0) - Number(b.count < 0) || (a.count < 0 ? 0 : b.count - a.count || a.label.localeCompare(b.label)));
  return { ...counts, country: merged };
}

/** True for a list whose country facet is the Where menu (Places); Trips keeps its own Where pill and chips. */
export const hasWhere = <Row,>(d: EntityDescriptor<Row>): boolean => d.facets.some((f) => f.control === 'where');
