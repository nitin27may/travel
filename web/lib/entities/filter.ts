import { FACET_PARAMS } from './types';
import type { EntityDescriptor, FacetDef, FacetParam, ListState } from './types';

const lc = (s: string) => s.toLocaleLowerCase('en');

export function parseBbox(bbox: string | null): [number, number, number, number] | null {
  if (!bbox) return null;
  const n = bbox.split(',').map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return null;
  return [n[0], n[1], n[2], n[3]];
}

function facetMatches<Row>(row: Row, facet: FacetDef<Row>, selected: string[]): boolean {
  if (!selected.length) return true;
  if (facet.match) return facet.match(row, selected);
  const have = new Set(facet.options(row).map((o) => o.value));
  const wanted = facet.type === 'single' ? selected.slice(0, 1) : selected;
  return wanted.some((v) => have.has(v));
}

/** One pure filter. `ignore` skips one facet (used to count a facet's own options) or 'q'. */
export function matchesRow<Row>(row: Row, state: ListState, d: EntityDescriptor<Row>, ignore?: FacetParam | 'q'): boolean {
  if (state.ids.length && !state.ids.includes(d.id(row))) return false;
  if (d.hiddenByDefault?.(row, state, ignore)) return false;
  for (const facet of d.facets) {
    if (facet.param === ignore || facet.hidden) continue;
    if (!facetMatches(row, facet, state.facets[facet.param] ?? [])) return false;
  }
  const box = parseBbox(state.bbox);
  if (box) {
    const g = d.geo(row);
    if (!g || g.lon < box[0] || g.lat < box[1] || g.lon > box[2] || g.lat > box[3]) return false;
  }
  if (ignore !== 'q' && state.q.trim()) {
    const hay = lc(d.search(row));
    if (!lc(state.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  return true;
}

export function filterRows<Row>(rows: readonly Row[], state: ListState, d: EntityDescriptor<Row>): Row[] {
  return rows.filter((r) => matchesRow(r, state, d));
}

export interface FacetCount {
  value: string;
  label: string;
  count: number;
  group?: string;
  hint?: string;
}

/**
 * For each facet, the options with the number of rows that would match if that facet alone were
 * cleared. A selected value that has no rows still appears with count 0, so it can be switched off.
 */
export function facetCounts<Row>(rows: readonly Row[], state: ListState, d: EntityDescriptor<Row>): Record<string, FacetCount[]> {
  const out: Record<string, FacetCount[]> = {};
  for (const facet of d.facets) {
    if (facet.hidden) continue;
    const counts = new Map<string, FacetCount>();
    for (const row of rows) {
      if (!matchesRow(row, state, d, facet.param)) continue;
      const seen = new Set<string>();
      for (const o of facet.options(row)) {
        if (seen.has(o.value)) continue;
        seen.add(o.value);
        const hit = counts.get(o.value);
        if (hit) hit.count += 1;
        else counts.set(o.value, { value: o.value, label: o.label, count: 1, group: o.group, hint: o.hint });
      }
    }
    for (const v of state.facets[facet.param] ?? []) {
      if (counts.has(v)) continue;
      let label = v;
      for (const row of rows) {
        const hit = facet.options(row).find((o) => o.value === v);
        if (hit) {
          label = hit.label;
          break;
        }
      }
      counts.set(v, { value: v, label, count: 0 });
    }
    const order = facet.order ?? [];
    const groups = facet.groupOrder ?? [];
    const last = facet.last ?? [];
    out[facet.param] = [...counts.values()].sort((a, b) => {
      if (groups.length) {
        const ga = groups.indexOf(a.group ?? '');
        const gb = groups.indexOf(b.group ?? '');
        if (ga !== gb) return (ga === -1 ? 999 : ga) - (gb === -1 ? 999 : gb);
      }
      const la = last.includes(a.value);
      if (la !== last.includes(b.value)) return la ? 1 : -1;
      const ia = order.indexOf(a.value);
      const ib = order.indexOf(b.value);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return b.count - a.count || a.label.localeCompare(b.label);
    });
  }
  return out;
}

/** Clearing a facet also clears every facet that depends on it, transitively (country, then region, then area). */
export function dropDependents<Row>(facets: ListState['facets'], d: EntityDescriptor<Row>, param: FacetParam): void {
  for (const child of d.facets) {
    if (child.dependsOn === param) {
      delete facets[child.param];
      dropDependents(facets, d, child.param);
    }
  }
}

export interface ActiveFilter {
  key: string;
  label: string;
  /** State with just this filter removed. */
  without: ListState;
}

/** Chips: one per selected facet value, plus the globe set and the map area. */
export function activeFilters<Row>(state: ListState, d: EntityDescriptor<Row>, labelOf: (param: FacetParam, value: string) => string): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  for (const param of FACET_PARAMS) {
    const facet = d.facets.find((f) => f.param === param);
    if (!facet || facet.hidden) continue;
    for (const v of state.facets[param] ?? []) {
      const rest = (state.facets[param] ?? []).filter((x) => x !== v);
      const facets = { ...state.facets };
      if (rest.length) facets[param] = rest;
      else delete facets[param];
      if (!rest.length) dropDependents(facets, d, param);
      out.push({ key: `${param}:${v}`, label: `${facet.label}: ${labelOf(param, v)}`, without: { ...state, facets, focus: null } });
    }
  }
  if (state.ids.length) {
    out.push({ key: 'ids', label: `From the globe: ${state.label || `${state.ids.length} places`}`, without: { ...state, ids: [], label: null, focus: null } });
  }
  if (state.bbox) out.push({ key: 'bbox', label: 'Map area', without: { ...state, bbox: null, focus: null } });
  if (state.f) out.push({ key: 'f', label: 'Advanced filter', without: { ...state, f: null, focus: null } });
  return out;
}

export function clearAll(state: ListState): ListState {
  return { ...state, q: '', facets: {}, bbox: null, f: null, sv: null, ids: [], label: null, focus: null };
}

/**
 * Rows a selection left out only because they are "not checked yet" (the facet's `gap` value): they match every other filter,
 * but the facet has a selection without that value. The count line names them so a hidden gap is never a silent loss.
 */
export function gapNotes<Row>(rows: readonly Row[], state: ListState, d: EntityDescriptor<Row>): string[] {
  const out: string[] = [];
  for (const facet of d.facets) {
    const gap = facet.gap;
    const selected = state.facets[facet.param] ?? [];
    if (!gap || facet.hidden || !selected.length || selected.includes(gap.value)) continue;
    let n = 0;
    for (const row of rows) if (matchesRow(row, state, d, facet.param) && facet.options(row).some((o) => o.value === gap.value)) n += 1;
    if (n > 0) out.push(`${n} ${gap.note}`);
  }
  return out;
}
