import type { EntityDescriptor, GroupDef, ListState } from './types';

export interface SortKey {
  id: string;
  desc: boolean;
}

export function parseSort(keys: string[]): SortKey[] {
  return keys.filter(Boolean).map((k) => (k.startsWith('-') ? { id: k.slice(1), desc: true } : { id: k, desc: false }));
}

export function serialiseSort(keys: SortKey[]): string[] {
  return keys.map((k) => (k.desc ? `-${k.id}` : k.id));
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function compareValues(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // empty values always last
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/**
 * The default order: the descriptor's own comparator, with the photo tie-break of backlog 3.56 when the descriptor names a tier.
 * Inside a tier (a country) the rows that lead (have a photo) come first, and a tier with any leading row comes before a tier with none,
 * so the first cards of the list carry a photo for the page's largest image. No row leaves its tier and none is hidden.
 */
export function defaultOrder<Row>(rows: readonly Row[], d: EntityDescriptor<Row>): Row[] {
  const out = [...rows];
  const t = d.defaultTier;
  if (!t) return out.sort(d.defaultSort);
  const leads = new Set<string>();
  for (const r of rows) if (t.lead(r)) leads.add(t.tier(r));
  return out.sort((a, b) => {
    const ta = t.tier(a);
    const tb = t.tier(b);
    if (ta !== tb) return Number(!leads.has(ta)) - Number(!leads.has(tb)) || d.defaultSort(a, b);
    return Number(!t.lead(a)) - Number(!t.lead(b)) || d.defaultSort(a, b);
  });
}

/** Sorted copy. With no sort keys the descriptor's default order applies. */
export function sortRows<Row>(rows: readonly Row[], state: ListState, d: EntityDescriptor<Row>): Row[] {
  const keys = parseSort(state.sort).filter((k) => d.sorts[k.id]);
  const out = [...rows];
  if (!keys.length) return defaultOrder(rows, d);
  return out.sort((a, b) => {
    for (const k of keys) {
      const get = d.sorts[k.id].value;
      const va = get(a);
      const vb = get(b);
      // nulls stay last in both directions
      if (va === null || vb === null) {
        const c = compareValues(va, vb);
        if (c) return c;
        continue;
      }
      const c = compareValues(va, vb);
      if (c) return k.desc ? -c : c;
    }
    return d.defaultSort(a, b);
  });
}

export interface RowGroup<Row> {
  key: string;
  title: string;
  subtitle: string;
  rows: Row[];
}

export function activeGroup<Row>(state: ListState, d: EntityDescriptor<Row>): GroupDef<Row> | null {
  const id = state.group ?? d.defaultGroup;
  return d.groupBy.find((g) => g.id === id) ?? null;
}

/** Group already-sorted rows. Groups keep the order their first row appears in. */
export function groupRows<Row>(rows: readonly Row[], group: GroupDef<Row> | null): RowGroup<Row>[] {
  if (!group) return [{ key: '', title: '', subtitle: '', rows: [...rows] }];
  const map = new Map<string, RowGroup<Row>>();
  for (const r of rows) {
    const key = group.key(r);
    let g = map.get(key);
    if (!g) {
      g = { key, title: group.title(r), subtitle: group.subtitle?.(r) ?? '', rows: [] };
      map.set(key, g);
    }
    g.rows.push(r);
  }
  const out = [...map.values()];
  if (group.order) {
    const rank = new Map(out.map((g) => [g.key, group.order!(g.rows[0]!)]));
    out.sort((a, b) => rank.get(a.key)! - rank.get(b.key)!);
  }
  return out;
}
