import type { ApiCitation, ApiVal, PlaceDetail } from '@travel/core/schema/api/index.ts';
import type { PublicPlace } from '@/lib/public';
import { BASIS_LABEL, type PVal, type SourceRow } from '@/lib/public/vals';
import { citedSource } from './sources';

// PublicPlace (the page model) -> PlaceDetail (the API contract, core/src/schema/api/place.ts). The page reads the same object
// directly; this mapping changes only what the contract names differently or must not carry:
//   - a sourced value (the page's PVal) becomes an `apiVal`: registry ids in `src`, the enums as they are stored, no display words
//     (`basisLabel` and `look` are derived by the reader); the sources it cites go once into `citations` (D-B4, cases K12 and K13);
//   - every point gains `pointRole` (null: no record names one yet) and `approx` (the prototype's rough pin, as the globe draws it);
//   - `notes` is always empty (schema diff 8, review R-16) and the wishlist store is never named in `sources` (PRIV1);
//   - `ref` is the page's identity key (D-B2).

export const isApproxPoint = (p: { pointSource: string } | null | undefined): boolean => p?.pointSource === 'prototype_approx';

const BASIS_OF_LABEL = new Map(Object.entries(BASIS_LABEL).map(([k, v]) => [v, k]));
const basisOf = (label: string | null | undefined): string | null => (label ? (BASIS_OF_LABEL.get(label) ?? label.replace(/ /g, '_')) : null);

type Json = unknown;
const isObj = (x: Json): x is Record<string, Json> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isPVal = (x: Json): x is PVal => isObj(x) && typeof x.state === 'string' && 'basisLabel' in x && Array.isArray(x.sources) && 'value' in x;
const isPoint = (x: Json): boolean => isObj(x) && typeof x.lat === 'number' && typeof x.lon === 'number' && typeof x.pointSource === 'string' && typeof x.sourceLicence === 'string';

/** Collects the citations while a detail is mapped. */
export class Cites {
  readonly byId = new Map<string, ApiCitation>();
  constructor(private readonly ids: ReadonlySet<string>) {}

  /** The registry ids of a value's sources (the ones a visitor can open); each is cited once. */
  src(rows: readonly SourceRow[]): string[] {
    const out: string[] = [];
    for (const row of rows) {
      const c = citedSource(row, this.ids);
      if (!c) continue;
      if (!this.byId.has(c.id)) this.byId.set(c.id, c.citation);
      if (!out.includes(c.id)) out.push(c.id);
    }
    return out;
  }

  get record(): Record<string, ApiCitation> {
    return Object.fromEntries([...this.byId].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  }
}

export function apiValOf(v: PVal, cites: Cites): ApiVal {
  const out: ApiVal = { v: v.value, state: v.state, basis: (v.basis as ApiVal['basis']) ?? null, src: cites.src(v.sources) };
  if (v.read) out.read = v.read;
  if (v.searched) out.on = v.searched;
  if (v.quote) out.quote = v.quote;
  if (v.note) out.note = v.note;
  if (v.tried.length) out.tried = v.tried;
  if (v.appliesTo) out.applies_to = v.appliesTo;
  if (v.conflicts.length) {
    out.conflicts = v.conflicts.map((c) => ({ v: c.value, basis: basisOf(c.basisLabel) as ApiVal['basis'], src: cites.src(c.sources), ...(c.note ? { note: c.note } : {}) }));
  }
  return out;
}

/** Walks any page-model JSON, mapping its values and points; everything else is copied as it is. */
export function convert(x: Json, cites: Cites): Json {
  if (Array.isArray(x)) return x.map((y) => convert(y, cites));
  if (!isObj(x)) return x;
  if (isPVal(x)) return apiValOf(x, cites);
  // a stored value nested inside a row's raw `value` (a relevance signal): its `src` are ids of the lane file's own table, which only the
  // row's PVal resolves. They are not registry ids and never leave the store; the row's `val` carries the sources it cites.
  if (isObj(x) && typeof x.state === 'string' && 'v' in x && Array.isArray(x.src)) {
    const { src: _src, ...rest } = x;
    void _src;
    return { ...(convert(rest, cites) as Record<string, Json>), src: [] };
  }
  const out: Record<string, Json> = {};
  for (const [k, y] of Object.entries(x)) if (y !== undefined) out[k] = convert(y, cites);
  if (isPoint(x)) {
    out.pointRole = null;
    out.approx = isApproxPoint(x as { pointSource: string });
  }
  return out;
}

/** The relevance block: its popover's sources are registry ids, and the judgement carries a basis key, not its label. */
function relevanceOf(rel: NonNullable<PublicPlace['relevance']>, cites: Cites): Json {
  const { provenance, ...rest } = rel;
  const base = convert(rest, cites) as Record<string, Json>;
  if (!provenance) return { ...base, provenance: null };
  const { sources, judgement, ...p } = provenance as unknown as { sources: SourceRow[]; judgement: { note: string | null; basisLabel: string; read: string | null } } & Record<string, Json>;
  return {
    ...base,
    provenance: { ...(convert(p, cites) as Record<string, Json>), judgement: { note: judgement.note, basis: basisOf(judgement.basisLabel), read: judgement.read }, src: cites.src(sources) },
  };
}

/** The place's page model in the contract's shape. Throws when a cited source has no registry entry. */
export function placeDetailOf(place: PublicPlace, ref: string, ids: ReadonlySet<string>, card: { type: string | null; badge: string | null }): PlaceDetail {
  const cites = new Cites(ids);
  const { relevance, sources, notes: _notes, ...rest } = place;
  void _notes;
  const body = convert(rest, cites) as Record<string, Json>;
  return {
    ref,
    ...body,
    type: card.type,
    badge: card.badge,
    sources: sources.filter((o) => o !== 'locations'),
    notes: '',
    relevance: relevance ? relevanceOf(relevance, cites) : null,
    citations: cites.record,
  } as unknown as PlaceDetail;
}
