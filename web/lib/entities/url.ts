import { FACET_PARAMS, VIEW_NAMES } from './types';
import type { FacetParam, ListState, ViewName } from './types';

export function emptyState(): ListState {
  return { q: '', facets: {}, bbox: null, view: 'cards', sort: [], group: null, cols: null, f: null, sv: null, focus: null, ids: [], label: null };
}

const csv = (v: string | null): string[] => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** Legacy `view=grid` meant cards; `grid` is also accepted as an alias for the table's label. */
export function parseView(v: string | null): ViewName {
  if (v === 'grid') return 'cards';
  return (VIEW_NAMES as readonly string[]).includes(v ?? '') ? (v as ViewName) : 'cards';
}

const NORMALISE: Partial<Record<FacetParam, (v: string) => string>> = {
  country: (v) => v.toUpperCase(),
};

/** Decode a query string (with or without the leading ?) into state. */
export function decodeState(search: string): ListState {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const s = emptyState();
  s.q = p.get('q') ?? '';
  for (const param of FACET_PARAMS) {
    const norm = NORMALISE[param];
    const values = csv(p.get(param)).map((v) => (norm ? norm(v) : v));
    if (values.length) s.facets[param] = values;
  }
  s.bbox = p.get('bbox') || null;
  s.view = parseView(p.get('view'));
  s.sort = csv(p.get('sort'));
  s.group = p.get('group') || null;
  const cols = csv(p.get('cols'));
  s.cols = cols.length ? cols : null;
  s.f = p.get('f') || null;
  s.sv = p.get('sv') || null;
  s.focus = p.get('focus') || null;
  s.ids = csv(p.get('ids'));
  s.label = p.get('label') || null;
  return s;
}

/** Encode state canonically: fixed parameter order, defaults omitted, no leading ?. */
export function encodeState(s: ListState): string {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  for (const param of FACET_PARAMS) {
    const v = s.facets[param];
    if (v && v.length) p.set(param, v.join(','));
  }
  if (s.bbox) p.set('bbox', s.bbox);
  if (s.view !== 'cards') p.set('view', s.view);
  if (s.sort.length) p.set('sort', s.sort.join(','));
  if (s.group) p.set('group', s.group);
  if (s.cols && s.cols.length) p.set('cols', s.cols.join(','));
  if (s.f) p.set('f', s.f);
  if (s.sv) p.set('sv', s.sv);
  if (s.ids.length) {
    p.set('ids', s.ids.join(','));
    if (s.label) p.set('label', s.label);
  }
  if (s.focus) p.set('focus', s.focus);
  // commas stay readable in the address bar
  return p.toString().replace(/%2C/g, ',');
}

export function withFacet(s: ListState, param: FacetParam, values: string[]): ListState {
  const facets = { ...s.facets };
  if (values.length) facets[param] = values;
  else delete facets[param];
  return { ...s, facets, focus: null };
}

/** A hash such as #country=CA&view=grid (the legacy list and the globe link this way) as a query string. */
export function hashToQuery(hash: string): string {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  return h.includes('=') ? h : '';
}

export function hasAnyFilter(s: ListState): boolean {
  return Boolean(s.q || Object.keys(s.facets).length || s.bbox || s.f || s.ids.length);
}
