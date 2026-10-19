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

/** Sorted copy. With no sort keys the descriptor's default order applies. */
export function sortRows<Row>(rows: readonly Row[], state: ListState, d: EntityDescriptor<Row>): Row[] {
  const keys = parseSort(state.sort).filter((k) => d.sorts[k.id]);
  const out = [...rows];
  if (!keys.length) return out.sort(d.defaultSort);
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
