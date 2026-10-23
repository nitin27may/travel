import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { travelRoot } from '../data/root';

// The capture contract as the public adapter reads it (capture-contract.md 5.1 and 6; CC-adapter-requests 1). It reads the
// generated files only, at build time, behind the adapter (P9): data/schema/capture/contract.json (the 14 sections, the
// property table, the facets, the bands) and data/schema/capture/<domain>.json (every type node resolved, a node identical
// to its parent saying `inherits`). Nothing here knows a type id: a new type is an entry in data/vocab/types.json, and
// `capture.ts build` makes it appear in these files with no change to this module (contract 8; acceptance check S2).

export type Mark = 'R' | 'R?' | 'A' | 'N';
export type Layer = 'place' | 'route' | 'offer' | 'event';

export const SECTION_IDS = ['cover', 'glance', 'warnings', 'suits', 'activity', 'options', 'access', 'when', 'facilities', 'around', 'pairs', 'photos', 'links', 'sources'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface PropertyDef {
  key: string;
  label: string;
  group: string;
  /** the value type, which picks the renderer (contract 6.1): range, enum, bool, price_list, season_rows, ... */
  value: string;
  /** the honest-gap wording shown at an R slot with no value */
  gap: string;
  section: SectionId;
  /** rest, rest!, card, detail, filter */
  display: string[];
  trigger?: string;
  unit?: string;
  layers?: Layer[];
  home: { in: 'capture' | 'suitability' | 'relevance' | 'none'; path?: string };
}

export interface ContractFile {
  schema: string;
  sections: { n: number; id: string }[];
  bands: Record<string, string[]>;
  properties: Record<string, Omit<PropertyDef, 'key'>>;
  facets: { property: string; scopes: string[]; control: string; label: string; band?: string }[];
}

type SuitMark = 'R' | 'A' | 'op';

export interface NodeEntry {
  label: string;
  level: string;
  inherits?: string;
  aliases?: string[];
  records?: Layer[];
  profile?: string | null;
  operated?: 'always' | 'never' | 'flag';
  operated_default?: boolean;
  ext?: string | null;
  suitability?: Record<string, SuitMark>;
  effort?: string[];
  relevance_class?: string[];
  links?: { R: string[]; 'R?': string[]; A: string[] };
  sources?: string[];
  display?: { slot3: string | null; glance: string[] | null };
  layers?: Partial<Record<Layer, { offer_class?: string; carries_suitability: boolean; base: Record<string, Mark> }>>;
}

export interface DomainFile {
  domain: string;
  nodes: Record<string, NodeEntry>;
}

export interface PropMark {
  key: string;
  mark: Mark;
  def: PropertyDef;
  /** the section the property is drawn in (PS1): its registry section, except where a suitability property moves to section 4 */
  home: SectionId;
}

export interface SectionMarks {
  n: number;
  id: SectionId;
  props: PropMark[];
  /** false only when every property of the section is N for the type (display D9): nothing is missing, so nothing is drawn */
  drawn: boolean;
}

export interface MarkOptions {
  /** the record's operator flag: it turns an `op` suitability mark into R (true) or N (false); unknown reads as R? */
  operated?: boolean;
  /**
   * Also take the suitability properties of this layer of the same type. A lift line is a route whose suitability block sits
   * on its ticket offer (CC-adapter 4), so its page asks for the offer layer's suitability properties too.
   */
  suitabilityFrom?: Layer;
}

/** Value types a glance slot can draw in one line (contract 6.1 row 2). */
export const SHORT_VALUE_TYPES: ReadonlySet<string> = new Set([
  'number', 'range', 'enum', 'enum_list', 'bool', 'season_rows', 'hours', 'price_list', 'window', 'grade', 'limit', 'relation_list', 'object_list',
]);

/** Sections a glance slot may come from: the facts a visitor scans for, not identity, links or the judgement. */
const GLANCE_SECTIONS: ReadonlySet<SectionId> = new Set(['glance', 'options', 'access', 'when', 'activity', 'facilities', 'suits']);

/**
 * What the "Who it suits" chip row already shows (place-page-sections PS13). A glance slot never repeats these; the
 * type's own slot 3 is added at run time.
 */
export const CHIP_ROW_PROPERTIES: readonly string[] = [
  'min_age', 'max_age', 'min_height_cm', 'max_height_cm', 'min_weight_kg', 'max_weight_kg', 'adult_required', 'group_min', 'solo',
  'age_band', 'effort.source_grade', 'effort.drivers.distance_km', 'effort.drivers.gain_m', 'adult_time_min', 'child_time_min', 'on_site_min',
];

/** The hazards that decide the day. When "Who it suits" is drawn they are its warning line, not a row of "Before you go" (PS7, X2). */
export const WARNING_LINE_PROPERTIES: readonly string[] = ['hazards', 'exposure'];

/**
 * Properties the registry asks of a record but a page never draws: the nearest town is derived (capture.ts derive-near) for the API's
 * `nearTown` and the Where city counts, and a row for it on every place page would grow the median page past its size budget (META-2).
 * The property stays in the engine's checks; it only stays out of the page sections.
 */
export const HIDDEN_FROM_PAGE: ReadonlySet<string> = new Set(['near_town', 'near_town_km']);

export const GLANCE_SLOTS = 6;

export interface Contract {
  readonly sections: readonly { n: number; id: SectionId }[];
  readonly properties: Readonly<Record<string, PropertyDef>>;
  readonly bands: Readonly<Record<string, string[]>>;
  readonly facets: ContractFile['facets'];
  /** the node of a type id with `inherits` followed, or null for an unknown type */
  node(typeId: string): NodeEntry | null;
  has(typeId: string): boolean;
  layersOf(typeId: string): Layer[];
  /** every property that is not N for the type on this layer, with its mark (suitability marks included) */
  marks(typeId: string, layer: Layer, opts?: MarkOptions): Map<string, Mark>;
  /** the 14 sections in order, each with its properties and their marks; `drawn` is false only for an all-N section */
  sectionsFor(typeId: string, layer: Layer, opts?: MarkOptions): SectionMarks[];
  /** the six glance slots: the type's `display.glance`, else the first six R properties with a short renderer (PS13) */
  glanceFor(typeId: string, layer: Layer, opts?: MarkOptions & { skip?: readonly string[] }): string[];
  /** the property that decides the third chip of the type, or null */
  slot3For(typeId: string): string | null;
  /** the suitability row of the type: path -> R, A or op */
  suitabilityMarks(typeId: string): Record<string, SuitMark>;
  /** the link kinds the type asks for */
  linksFor(typeId: string): { R: string[]; 'R?': string[]; A: string[] };
}

const FILES = 'data/schema/capture';

/** Builds the contract from the generated files already parsed (a test passes its own, built from a copy of types.json). */
export function createContract(file: ContractFile, domains: Record<string, DomainFile>): Contract {
  const sections = file.sections.map((s) => ({ n: s.n, id: s.id as SectionId }));
  const properties: Record<string, PropertyDef> = {};
  for (const [key, def] of Object.entries(file.properties)) properties[key] = { key, ...def };
  const order = Object.keys(properties);

  const nodeCache = new Map<string, NodeEntry | null>();
  const node = (typeId: string): NodeEntry | null => {
    if (nodeCache.has(typeId)) return nodeCache.get(typeId)!;
    let cur: NodeEntry | undefined = domains[typeId.split('.')[0]!]?.nodes[typeId];
    const seen = new Set<string>();
    while (cur?.inherits && !seen.has(cur.inherits)) {
      seen.add(cur.inherits);
      const parent: NodeEntry | undefined = domains[cur.inherits.split('.')[0]!]?.nodes[cur.inherits];
      if (!parent) break;
      // the child keeps its own label and aliases; everything else is the parent's
      cur = { ...parent, label: cur.label, level: cur.level, aliases: cur.aliases, inherits: parent.inherits };
    }
    const out = cur && !cur.inherits ? cur : null;
    nodeCache.set(typeId, out);
    return out;
  };

  const marks = (typeId: string, layer: Layer, opts: MarkOptions = {}): Map<string, Mark> => {
    const out = new Map<string, Mark>();
    const n = node(typeId);
    const rl = n?.layers?.[layer];
    if (!n || !rl) return out;
    for (const [key, m] of Object.entries(rl.base)) if (m !== 'N' && properties[key] && !HIDDEN_FROM_PAGE.has(key)) out.set(key, m);
    const addSuit = (): void => {
      for (const [key, m] of Object.entries(n.suitability ?? {})) {
        if (!properties[key] || out.has(key)) continue;
        if (m === 'op') {
          if (opts.operated === false) continue;
          out.set(key, opts.operated === true ? 'R' : 'R?');
        } else if (key.startsWith('participation.') && opts.operated === false) continue;
        else out.set(key, m);
      }
    };
    if (rl.carries_suitability) addSuit();
    else if (opts.suitabilityFrom && n.layers?.[opts.suitabilityFrom]?.carries_suitability) addSuit();
    return out;
  };

  /**
   * One home per property (PS1). A property of the type's suitability row whose registry section is 5 is homed in section 4,
   * and the hazards that decide the day are homed there too when section 4 is drawn (X2).
   */
  const homeOf = (def: PropertyDef, suitsDrawn: boolean): SectionId => {
    if (def.home.in !== 'suitability') return def.section;
    if (def.section === 'activity') return 'suits';
    if (suitsDrawn && WARNING_LINE_PROPERTIES.includes(def.key)) return 'suits';
    return def.section;
  };

  const sectionsFor = (typeId: string, layer: Layer, opts?: MarkOptions): SectionMarks[] => {
    const m = marks(typeId, layer, opts);
    // section 4 is drawn when anything is homed there: its own properties, or section-5 suitability properties that move in
    const suitsDrawn = [...m.keys()].some((k) => {
      const d = properties[k]!;
      return d.home.in === 'suitability' && (d.section === 'suits' || d.section === 'activity');
    });
    return sections.map((s) => {
      const props: PropMark[] = [];
      for (const key of order) {
        const def = properties[key]!;
        const mark = m.get(key);
        if (!mark) continue;
        const home = homeOf(def, suitsDrawn);
        if (home === s.id) props.push({ key, mark, def, home });
      }
      return { n: s.n, id: s.id, props, drawn: props.length > 0 };
    });
  };

  const slot3For = (typeId: string): string | null => node(typeId)?.display?.slot3 ?? null;

  const glanceFor: Contract['glanceFor'] = (typeId, layer, opts = {}) => {
    const n = node(typeId);
    if (!n) return [];
    const m = marks(typeId, layer, opts);
    const explicit = n.display?.glance;
    if (explicit && explicit.length > 0) return explicit.filter((k) => m.has(k)).slice(0, GLANCE_SLOTS);
    const skip = new Set([...(opts.skip ?? CHIP_ROW_PROPERTIES), ...(slot3For(typeId) ? [slot3For(typeId)!] : [])]);
    const secN = new Map(sections.map((s) => [s.id, s.n] as const));
    const picks = order
      .map((key, i) => ({ key, i, def: properties[key]! }))
      .filter(({ key, def }) => m.get(key) === 'R' && !skip.has(key) && GLANCE_SECTIONS.has(def.section) && SHORT_VALUE_TYPES.has(def.value) && (def.display.includes('rest') || def.display.includes('card')));
    // by home section, the "Who it suits" section last; the registry order breaks ties
    const rank = (s: SectionId): number => (s === 'suits' ? 99 : (secN.get(s) ?? 50));
    picks.sort((a, b) => rank(a.def.section) - rank(b.def.section) || a.i - b.i);
    return picks.slice(0, GLANCE_SLOTS).map((p) => p.key);
  };

  return {
    sections,
    properties,
    bands: file.bands,
    facets: file.facets,
    node,
    has: (typeId) => node(typeId) !== null,
    layersOf: (typeId) => (node(typeId)?.records ?? []) as Layer[],
    marks,
    sectionsFor,
    glanceFor,
    slot3For,
    suitabilityMarks: (typeId) => node(typeId)?.suitability ?? {},
    linksFor: (typeId) => node(typeId)?.links ?? { R: [], 'R?': [], A: [] },
  };
}

/** Reads the generated files under `root` (the repo root by default). Throws when contract.json is missing: run `capture.ts build`. */
export function loadContract(root: string = travelRoot()): Contract {
  const dir = path.join(root, FILES);
  const contractPath = path.join(dir, 'contract.json');
  if (!existsSync(contractPath)) throw new Error(`${contractPath} is missing: run \`node core/bin/capture.ts build\``);
  const file = JSON.parse(readFileSync(contractPath, 'utf8')) as ContractFile;
  const domains: Record<string, DomainFile> = {};
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json') || f === 'contract.json') continue;
    const d = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as DomainFile;
    domains[d.domain] = d;
  }
  return createContract(file, domains);
}

let cached: { root: string; contract: Contract } | null = null;
/** The contract of the repo root, loaded once per process. */
export function defaultContract(root: string = travelRoot()): Contract {
  if (!cached || cached.root !== root) cached = { root, contract: loadContract(root) };
  return cached.contract;
}
