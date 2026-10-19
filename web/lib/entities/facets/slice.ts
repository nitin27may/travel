// The part of the capture contract the list pages need in the browser (contract 7): the facets, and the domains and categories of
// the type tree. `data/schema/capture/contract.json` is 50 kB and `data/vocab/types.json` is 125 kB, so a script writes this slice
// to `contract-slice.json` (`web/scripts/facets-slice.mjs`), and a test fails when the two drift.
//
// Types below a category need no entry: a type id starts with its category's id, so a new type joins its parent's scope by name.

export interface SliceFacet {
  /** The URL name: `f.<key>`. The label as a slug ("Time on site" -> time-on-site). */
  key: string;
  /** The registry property it reads. */
  property: string;
  /** Type ids (any depth) or `intent:see|walk|do` whose result lists get the facet. */
  scopes: string[];
  control: 'range' | 'enum' | 'bool';
  label: string;
  /** The list-row band it reads; absent when it reads a flag. */
  band?: string;
}

export interface SliceNode {
  id: string;
  label: string;
  /** Record layers the node's types allow (place, route, offer, event); a category's own or its domain's. */
  records: string[];
}

export interface ContractSlice {
  schema: 'facet-slice/1';
  facets: SliceFacet[];
  domains: SliceNode[];
  categories: SliceNode[];
}

interface ContractFacet {
  property: string;
  scopes: string[];
  control: 'range' | 'enum' | 'bool';
  label: string;
  band?: string;
}
interface TypeNode {
  id: string;
  parent: string | null;
  level: string;
  label: string;
  records?: string[];
}

export const slug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Pure: the slice of the two generated files. A test and the generating script both call it. */
export function sliceContract(contract: { facets: ContractFacet[] }, types: { nodes: TypeNode[] }): ContractSlice {
  const keys = new Set<string>();
  const facets = contract.facets.map((f): SliceFacet => {
    const key = slug(f.label);
    if (keys.has(key)) throw new Error(`two contract facets share the URL name f.${key}`);
    keys.add(key);
    return { key, property: f.property, scopes: f.scopes, control: f.control, label: f.label, ...(f.band ? { band: f.band } : {}) };
  });
  const byId = new Map(types.nodes.map((n) => [n.id, n]));
  const records = (n: TypeNode): string[] => n.records ?? (n.parent ? records(byId.get(n.parent)!) : []);
  const node = (n: TypeNode): SliceNode => ({ id: n.id, label: n.label, records: records(n) });
  return {
    schema: 'facet-slice/1',
    facets,
    domains: types.nodes.filter((n) => n.level === 'domain').map(node),
    categories: types.nodes.filter((n) => n.level === 'category').map(node),
  };
}
