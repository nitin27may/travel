// The shapes the review page reads (core/src/catalog/proposal.ts) and the pure helpers that order and describe them.

export interface Source {
  id: string;
  url: string;
  title: string;
  publisher: string;
  kind: string;
  read: string;
}

export interface FieldChange {
  field: string;
  kind: 'fill' | 'replace' | 'alternative' | 'conflict' | 'corroborate' | 'link' | 'gap';
  before: unknown;
  after: unknown;
  incoming: unknown;
  against?: { kind: string; read: string };
}

export interface Change {
  change_id: string;
  op: 'add' | 'edit';
  entity: string;
  id: string;
  area_id: string | null;
  name: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  fields: FieldChange[];
  sources: Source[];
  fact_keys: string[];
  auto: boolean;
  reason: string;
  flags: string[];
  status: 'open' | 'applied' | 'rejected' | 'superseded';
  match: { kind: string; by: string | null; similarity: number | null; distance_m: number | null } | null;
  duplicate_of: string | null;
  excludes: string[];
  depends_on: string[];
  missing: string[];
  question: string | null;
  warnings: string[];
  current: { review_status: string; confidence: string; last_verified: string | null } | null;
}

export interface Proposal {
  id: string;
  created: string;
  actor: string;
  source: { sidecar: string; lane: string; researched: string };
  status: string;
  notes: string[];
  changes: Change[];
}

/** a change with its proposal, which is what the page works with */
export interface Item {
  key: string;
  proposal: string;
  lane: string;
  change: Change;
}

export type Bucket = 'duplicate' | 'conflict' | 'rest';

export const bucketOf = (c: Change): Bucket => (c.flags.includes('possible-duplicate') ? 'duplicate' : c.flags.includes('conflict') ? 'conflict' : 'rest');

/** flags that need a person even when the arithmetic says the change is small */
const HOLD = ['possible-duplicate', 'conflict', 'sensitive', 'incomplete', 'retired'];

/** safe to accept in bulk: policy let it through, or it only adds provenance and fills holes */
export const lowRisk = (c: Change): boolean => c.status === 'open' && !c.flags.some((f) => HOLD.includes(f)) && (c.auto || c.flags.includes('low'));

export function toItems(proposals: Proposal[]): Item[] {
  const out: Item[] = [];
  for (const p of proposals) for (const c of p.changes) out.push({ key: `${p.id}/${c.change_id}`, proposal: p.id, lane: p.source.lane, change: c });
  return out;
}

const BUCKET_ORDER: Record<Bucket, number> = { duplicate: 0, conflict: 1, rest: 2 };

/** possible duplicates first, then conflicts, then the rest by area, entity and name */
export function sortItems(items: Item[]): Item[] {
  return [...items].sort((a, b) => {
    const x = a.change;
    const y = b.change;
    return (
      BUCKET_ORDER[bucketOf(x)] - BUCKET_ORDER[bucketOf(y)] ||
      String(x.area_id).localeCompare(String(y.area_id)) ||
      x.entity.localeCompare(y.entity) ||
      x.name.localeCompare(y.name) ||
      a.key.localeCompare(b.key)
    );
  });
}

export interface Group {
  key: string;
  bucket: Bucket;
  label: string;
  items: Item[];
}

export function groupItems(items: Item[], areaName: (id: string | null) => string): Group[] {
  const groups: Group[] = [];
  for (const it of sortItems(items)) {
    const b = bucketOf(it.change);
    const key = b === 'rest' ? `area:${it.change.area_id}` : b;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, bucket: b, label: b === 'duplicate' ? 'Possible duplicates' : b === 'conflict' ? 'Conflicts' : areaName(it.change.area_id), items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  return groups;
}

export const ENTITY_LABEL: Record<string, string> = {
  trails: 'Trail', activities: 'Activity', stays: 'Stay', eateries: 'Eatery', offers: 'Offer', offer_prices: 'Price', legs: 'Leg', area_guides: 'Area guide',
};

export const FIELD_KIND_LABEL: Record<FieldChange['kind'], string> = {
  fill: 'Added', replace: 'Changed', alternative: 'Alternative kept', conflict: 'Conflict', corroborate: 'Second source', link: 'Link', gap: 'Not found',
};

export function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'none';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(show).join(', ') || 'none';
  return JSON.stringify(v);
}

export function labelOf(field: string): string {
  return field.replace(/_/g, ' ');
}

/** plain words for the flags the pipeline sets */
export const FLAG_LABEL: Record<string, string> = {
  'possible-duplicate': 'Possible duplicate',
  'merge-option': 'Merge option',
  conflict: 'Conflict',
  sensitive: 'Hard limit or grade',
  incomplete: 'Incomplete',
  retired: 'Retired row',
  'price-jump': 'Price moved',
  low: 'Low risk',
  inference: 'Inferred',
  gap: 'Gap',
};

/** the row's lifecycle as the badges shown on a card: raw, proposed, stated, verified, stale */
export function provenanceBadges(c: Change): string[] {
  if (!c.current) return c.op === 'add' ? ['proposed', 'stated'] : [];
  const out = [c.current.review_status];
  if (c.current.confidence !== c.current.review_status) out.push(c.current.confidence);
  return out;
}

export function areaLabel(id: string | null): string {
  if (!id) return 'No area';
  return id.split('/').slice(1).map((s) => s.replace(/-/g, ' ')).join(' / ') || id;
}

export const SOURCE_RANK = ['official', 'operator', 'press', 'reseller', 'blog', 'community', 'video', 'computed'];
