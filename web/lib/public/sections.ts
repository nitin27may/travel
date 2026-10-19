import { completeness, evalTrigger, readProperty } from '@travel/core/capture/engine.ts';
import { incomingOf, primaryRef, type World } from '@travel/core/capture/records.ts';
import { resolveNode } from '@travel/core/capture/resolve.ts';
import type { CaptureRecord } from '@travel/core/schema/capture/records.ts';
import type { RelevanceRecord } from '@travel/core/schema/relevance.ts';
import type { Contract, Layer, Mark, PropertyDef, SectionId } from './contract';
import { suitMarksFor, suitabilityRows, type SuitRow } from './suitability';
import { WORDS, isRawVal, longDate, lookupFor, pval, type PVal, type RawVal, TextScrub, type Words } from './vals';
import { nameOfRef, type RefLink } from './relevance';

// The place, route and offer page model (capture-contract.md 6.1; place-page-sections.md PS1 to PS14; CC-adapter-requests).
// For one record it returns the 14 fixed sections of the contract in order, each with its rows (value, value type, basis,
// read date, quote, sources, conflicts), a gap row for every missing R property, one closing line for the missing A
// properties, and nothing for an N property. A section is dropped only when every property is N for the type (D9).
//
// It makes no decision by type id: what a section asks for comes from the contract's marks, and the value types pick the
// renderer. The structures the contract's relations add (ways, access points, offers, "at this place you can also", parts,
// the ticket offer of a lift) come from the records' relations and their derived inverses (core/src/capture/records.ts).

// ---- shapes ------------------------------------------------------------------------------------------------------------

export type ValueType = string;

export interface Row {
  key: string;
  label: string;
  valueType: ValueType;
  mark: Mark;
  home: SectionId;
  /** true for an appearance that is not the property's home (glance slot, cover): same value, never a gap marker of its own (PS1) */
  echo: boolean;
  /** the value in words, or null when the row is a gap */
  text: string | null;
  /** the stored value, for the renderer of the value type */
  value: unknown;
  /** the sourced value: basis, read date, quote, sources, conflicts */
  val: PVal | null;
  /** state of the property: a missing R property is `gap` */
  state: PVal['state'];
  gap: boolean;
  /** the honest-gap wording of the registry, shown beside the gap chip */
  gapWording: string;
  unit: string | null;
  /** a relation list as links */
  links: RefLink[];
  /** the sentence-style look of a searched-none value */
  look: 'rule' | 'advice' | 'info' | 'sentence' | 'gap';
}

export interface WarningLine {
  /** the mono kind label: Access, Book, Closed, Wildlife, Last down, Hazard */
  kind: string;
  text: string;
  /** the property whose row is the home of this line */
  home: string;
}

export interface SectionModel {
  n: number;
  id: SectionId;
  title: string;
  /** false only when every property is N for the type: nothing is drawn and no marker either */
  drawn: boolean;
  rows: Row[];
  /** "Not checked yet: a, b" for the A properties missing, or for every property of a section with no value at all */
  closing: string | null;
  /** true when the section has R properties and no value in any of them: draw `closing` instead of the gap chips (PS14); `rows` keep the data */
  empty: boolean;
  /** the section has no data of its own because "Who it suits" draws it (section 4), or a derived block draws it */
  delegate: 'suitability' | 'relevance' | null;
  /** section 3 only: the Rest! items as one line each, with the mono kind label of PS7 (empty elsewhere) */
  lines: WarningLine[];
}

export interface WayRow extends RefLink {
  /** the route, lift, road or shuttle that reaches this place */
  type: string;
  layer: Layer;
}

export interface OfferCard extends RefLink {
  offerClass: string | null;
  type: string;
  /** the place the offer is at, or null: the minitrekking shows "Where: Not checked yet" (CC-adapter 5) */
  at: RefLink | null;
  operator: RefLink | null;
  rows: Row[];
  closing: string | null;
}

export interface AroundGroup {
  /** the domain of the offers in the group: water, air, nature, ride, ... (a heading by data, not a type branch) */
  domain: string;
  /** "At the payoff: <name>" for offers at a folded part */
  at: RefLink | null;
  items: (RefLink & { type: string; offerClass: string | null; where: RefLink | null })[];
}

export interface AccessPoint extends RefLink {
  role: 'starts_here' | 'parks_for' | 'serves' | 'starts_at';
  type: string;
}

export interface LinkTab {
  kind: string;
  state: 'filled' | 'searched_none' | 'found_in_search' | 'not_checked';
  url: string | null;
  required: 'R' | 'R?' | 'A';
  searched: string | null;
}

export interface PageModel {
  ref: string;
  type: string;
  layer: Layer;
  name: string;
  typeLabel: string;
  sections: SectionModel[];
  /** the glance strip: the home row of each slot, in the contract's order (PS13) */
  glance: string[];
  /** the record that carries the suitability block: itself, or the ticket offer of a lift (CC-adapter 4) */
  suitabilityRef: string | null;
  /** the ticket offer of a lift line */
  ticket: RefLink | null;
  /** the first place a route reaches: its draw, standing, class, photo and badge come from there (CC-adapter 3) */
  payoff: RefLink | null;
  /** the top station of a lift, a place */
  partOf: RefLink[];
  /** parts folded into this page: `part/<ref>#<slug>` records whose parent this is */
  parts: (RefLink & { type: string })[];
  ways: WayRow[];
  /** a route's start, payoff and what it passes, with the distance along the route */
  routeStops: (RefLink & { role: 'starts_at' | 'reaches' | 'passes' | 'ends_at'; atKm: number | null })[];
  accessPoints: AccessPoint[];
  /** offers the subject sells: tickets and access (PS11), shown in section 6 */
  offers: OfferCard[];
  /** experience and rental offers at or on the subject, grouped by domain (section 10) */
  around: AroundGroup[];
  links: LinkTab[];
  /** the place checks: base R properties answered out of asked, with the engine's level */
  checks: { done: number; total: number; read: string | null; level: string };
}

export interface BuildOptions {
  scrub?: TextScrub;
  words?: Partial<Words>;
  /** override a section heading; the defaults are SECTION_TITLES (Q29: "Before you go") */
  titles?: Partial<Record<SectionId, string>>;
  /** the operator flag of the record, when the caller knows it */
  operated?: boolean;
}

/** Headings. A table so an owner decision (Q29) is a one-line change, and Part B can pass its own. */
export const SECTION_TITLES: Record<SectionId, string> = {
  cover: 'Overview',
  glance: 'At a glance',
  warnings: 'Before you go',
  suits: 'Who it suits',
  activity: 'The route',
  options: 'Options and prices',
  access: 'How to get there',
  when: 'When to go',
  facilities: 'Facilities',
  around: 'At this place you can also',
  pairs: 'Nearby, worth adding',
  photos: 'Photos',
  links: 'Links',
  sources: 'Facts and sources',
};

/** The heading of section 10 by layer (PS12): a data-driven choice, never a type id. */
export const AROUND_TITLE: Record<Layer, string> = {
  place: 'At this place you can also',
  route: 'On this route you can also',
  offer: 'With this you can also',
  event: 'At this event you can also',
};

const SELLING_CLASSES = new Set(['ticket', 'access']);

// ---- formatting ---------------------------------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const md = (s: string): string => `${Number(s.slice(3))} ${MONTHS[Number(s.slice(0, 2)) - 1]}`;
const num = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
const humanise = (s: string): string => s.replace(/_/g, ' ');
const cap1 = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

function dur(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60}` : `${h} h`;
}

/** The value in words, by value type. Part B's renderers draw from `value`; this is the plain-text form for summaries and tests. */
export function formatValue(def: Pick<PropertyDef, 'key' | 'value' | 'unit'>, v: unknown): string {
  const unit = def.unit ? ` ${def.unit}` : '';
  if (v === null || v === undefined) return '';
  switch (def.value) {
    case 'text': return typeof v === 'string' ? v : String(v);
    case 'number': return typeof v === 'number' ? `${num(v)}${unit}` : String(v);
    case 'bool': return v === true ? 'Yes' : v === false ? 'No' : String(v);
    case 'enum': return typeof v === 'string' ? cap1(humanise(v)) : String(v);
    case 'enum_list': return Array.isArray(v) ? v.map((x) => humanise(String(x))).join(', ') : String(v);
    case 'range':
      if (Array.isArray(v) && v.length === 2) {
        const [a, b] = v as [number, number];
        if (/_min$/.test(def.key)) return a === b ? dur(a) : `${dur(a)} to ${dur(b)}`;
        return a === b ? `${num(a)}${unit}` : `${num(a)}–${num(b)}${unit}`;
      }
      return String(v);
    case 'season_rows':
      return Array.isArray(v) ? v.map((r) => (isObj(r) ? `${md(String(r.from))} to ${md(String(r.to))}${typeof r.status === 'string' ? ` ${r.status}` : typeof r.why === 'string' ? ` (${r.why})` : ''}${typeof r.via === 'string' ? ` by ${r.via}` : ''}` : '')).filter(Boolean).join('; ') : String(v);
    case 'price_list':
      return Array.isArray(v) ? v.map((r) => (isObj(r) ? `${r.currency} ${num(Number(r.amount))}${typeof r.per === 'string' ? ` ${humanise(r.per)}` : ''}${r.age_from !== undefined ? ` (ages ${r.age_from}${r.age_to !== undefined ? `–${r.age_to}` : '+'})` : ''}` : '')).filter(Boolean).join('; ') : String(v);
    case 'window': {
      if (!isObj(v)) return String(v);
      const rule = String(v.rule ?? '');
      const lead = typeof v.days_before === 'number' ? ` ${v.days_before} days ahead${typeof v.opens_time === 'string' ? ` at ${v.opens_time}` : ''}` : '';
      return `${humanise(rule)}${lead}`;
    }
    case 'hours': {
      if (!isObj(v)) return String(v);
      if (v.always_open === true) return 'Always open';
      const per = Array.isArray(v.periods) ? v.periods.map((p) => (isObj(p) ? `${p.open}–${p.close}` : '')).filter(Boolean).join(', ') : '';
      return per || 'See times';
    }
    case 'limit': return isObj(v) ? Object.entries(v).map(([k, x]) => `${humanise(k)} ${String(x)}`).join(' · ') : String(v);
    case 'point': return isObj(v) && typeof v.lat === 'number' ? `${v.lat.toFixed(4)}, ${Number(v.lon).toFixed(4)}` : String(v);
    case 'object_list':
      return Array.isArray(v) ? v.map((x) => (isObj(x) ? (typeof x.note === 'string' ? x.note : typeof x.reason === 'string' ? x.reason : Object.values(x).filter((y) => typeof y === 'string' || typeof y === 'number').join(' ')) : String(x))).filter(Boolean).join('; ') : String(v);
    case 'object': {
      if (!isObj(v)) return String(v);
      // an object of sourced values (the relevance signals): say how many are recorded
      const subs = Object.values(v).filter(isRawVal);
      if (subs.length > 0) return `${subs.filter((x) => x.state === 'value').length} of ${subs.length} signals recorded`;
      return Object.entries(v).filter(([, x]) => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean').map(([k, x]) => `${humanise(k)} ${String(x)}`).join(' · ');
    }
    case 'link_list': return Array.isArray(v) ? `${v.length} links` : String(v);
    case 'photo_list': return Array.isArray(v) ? `${v.length} photos` : String(v);
    case 'grade': return isObj(v) ? `${v.system} ${v.value}` : String(v);
    case 'ref': case 'type_id': case 'qid': return String(v);
    default: return typeof v === 'string' ? v : Array.isArray(v) ? v.map(String).join(', ') : JSON.stringify(v);
  }
}

// ---- reading a property of a record ----------------------------------------------------------------------------------------

interface Rec {
  world: World;
  ref: string;
  cap: CaptureRecord;
  rel: RelevanceRecord | undefined;
  relRef: string;
  scrub: TextScrub;
  capLookup: ReturnType<typeof lookupFor>;
  relLookup: ReturnType<typeof lookupFor>;
}

const RELATION_KEYS = new Set(['reaches', 'part_of', 'starts_at', 'ends_at', 'parks_for', 'serves', 'at', 'combo_with', 'alternative_to', 'variant_of', 'run_by', 'passes', 'on']);

/** The first place a route reaches with a judgement of its own, when the route has none (CC-adapter 3). */
function judgedRefOf(world: World, ref: string, cap: CaptureRecord): string {
  if (world.rel.has(ref)) return ref;
  if (cap.layer === 'route' || cap.layer === 'place') {
    for (const r of cap.reaches ?? []) {
      const t = primaryRef(world, r);
      if (world.rel.has(t)) return t;
    }
  }
  return ref;
}

function relationLinks(world: World, key: string, cap: CaptureRecord, ref: string): RefLink[] {
  const inc = incomingOf(world, ref);
  let refs: string[] = [];
  switch (key) {
    case 'access_points': refs = [...(cap.starts_at ?? []), ...inc.parks_for, ...inc.serves, ...inc.starts_here]; break;
    case 'transit': refs = inc.serves; break;
    case 'on': refs = (cap.on ?? []).map((o) => o.ref); break;
    case 'passes': refs = (cap.passes ?? []).map((p) => p.ref); break;
    default: {
      const own = (cap as unknown as Record<string, unknown>)[key];
      refs = Array.isArray(own) ? (own as unknown[]).map((x) => (typeof x === 'string' ? x : isObj(x) ? String(x.ref) : '')).filter(Boolean) : typeof own === 'string' ? [own] : [];
    }
  }
  return [...new Set(refs.map((r) => primaryRef(world, r)))].map((r) => ({ ref: r, name: nameOfRef(world, r) }));
}

/** The stored value of a base-contract property, wherever it lives (capture record, relevance record, or computed from the graph). */
function rawValue(r: Rec, key: string, def: PropertyDef): unknown {
  const capAny = r.cap as unknown as Obj;
  const relAny = (r.rel ?? {}) as unknown as Obj;
  if (def.home.in === 'relevance') return relAny[def.home.path ?? key];
  switch (key) {
    case 'point': return r.world.points[r.ref];
    case 'summary': return r.rel?.why;
    case 'type': return r.cap.type;
    case 'area_id': return r.cap.area_id;
    case 'access_points': case 'transit': return relationLinks(r.world, key, r.cap, r.ref);
    default: break;
  }
  if (RELATION_KEYS.has(key)) return relationLinks(r.world, key, r.cap, r.ref);
  return capAny[def.home.path ?? key];
}

const SOFT_STATES = new Set(['searched_none', 'none_stated']);

function baseRow(r: Rec, def: PropertyDef, mark: Mark, home: SectionId, echo: boolean): Row {
  const key = def.key;
  const state0 = readProperty(r.world, key, r.ref, r.cap, r.rel);
  const v = rawValue(r, key, def);
  const isRel = def.home.in === 'relevance';
  const lookup = isRel ? r.relLookup : r.capLookup;
  const where = `${isRel ? r.relRef : r.ref} ${key}`;
  const wrapped = isRawVal(v) ? pval(v as RawVal, lookup, r.scrub, where) : null;
  const links = RELATION_KEYS.has(key) || key === 'access_points' || key === 'transit' ? ((Array.isArray(v) ? v : []) as RefLink[]).filter((x) => x && typeof x === 'object' && 'ref' in x) : [];
  const value = wrapped ? wrapped.value : v;
  const base = { key, label: def.label, valueType: def.value, mark, home, echo, unit: def.unit ?? null, gapWording: def.gap, links };
  const missing = state0 === 'gap' || value === undefined || value === null;
  if (missing && !(wrapped && SOFT_STATES.has(wrapped.state))) {
    return { ...base, text: null, value: null, val: wrapped, state: 'gap', gap: true, look: 'gap' };
  }
  if (wrapped && (wrapped.state === 'searched_none' || wrapped.state === 'none_stated')) {
    const when = wrapped.searched ? ` · searched ${longDate(wrapped.searched)}` : '';
    return { ...base, text: `${def.label}: not stated${when}`, value: null, val: wrapped, state: wrapped.state, gap: false, look: 'sentence' };
  }
  const empty = Array.isArray(value) && value.length === 0;
  const text = empty ? 'None' : links.length > 0 ? links.map((l) => l.name).join(', ') : typeof value === 'string' && def.value === 'text' ? r.scrub.text(value, where) : formatValue(def, value) || 'Recorded';
  const look = wrapped?.look === 'rule' ? 'rule' : wrapped?.look === 'advice' ? 'advice' : 'info';
  return { ...base, text, value, val: wrapped, state: wrapped?.state ?? 'value', gap: false, look };
}

/** A suitability row (SuitRow) in the shape of a page row, so one renderer draws every row (PS1: the same value wherever it shows). */
function fromSuitRow(s: SuitRow, def: PropertyDef | undefined, mark: Mark, home: SectionId, echo: boolean): Row {
  return {
    key: s.key,
    label: s.label,
    valueType: def?.value ?? 'text',
    mark,
    home,
    echo,
    text: s.gap ? null : s.text,
    value: s.val?.value ?? null,
    val: s.val,
    state: s.gap ? 'gap' : (s.val?.state ?? 'value'),
    gap: s.gap,
    gapWording: def?.gap ?? '',
    unit: def?.unit ?? null,
    links: [],
    look: s.look,
  };
}

// ---- triggers ---------------------------------------------------------------------------------------------------------------

/** Whether an R? property is asked: true (it is R), false (it is N), null (the data cannot decide, so it is A). */
function conditionHolds(r: Rec, def: PropertyDef): boolean | null {
  const node = resolveNode(r.cap.type);
  if (!node) return null;
  const suit = r.world.suit.get(r.ref)?.rec;
  return evalTrigger(r.world, def.trigger ?? 'conditional', r.ref, node, r.cap.layer, r.cap, suit, r.rel);
}

// ---- the warning lines --------------------------------------------------------------------------------------------------------

function warningLines(rows: Row[]): WarningLine[] {
  const out: WarningLine[] = [];
  for (const row of rows) {
    if (row.gap || row.text === null) continue;
    if (row.key === 'access_cost' && Array.isArray(row.value)) {
      for (const it of row.value as Obj[]) {
        const t = String(it.type ?? '');
        const book = typeof it.book_ahead_days === 'number' || /permit|timed|reserv|lottery/.test(t);
        const words = humanise(t);
        out.push({ kind: book ? 'Book' : 'Access', text: cap1(typeof it.note === 'string' ? it.note : words), home: row.key });
      }
    } else if (row.key === 'closures' && Array.isArray(row.value)) {
      for (const c of row.value as Obj[]) out.push({ kind: 'Closed', text: `${String(c.from)} to ${String(c.to)}${typeof c.why === 'string' ? `: ${c.why}` : ''}`, home: row.key });
    } else if (row.key.startsWith('ext.wildlife.')) out.push({ kind: 'Wildlife', text: row.text, home: row.key });
    else if (row.key === 'ext.lift.last_down') out.push({ kind: 'Last down', text: row.text, home: row.key });
    else out.push({ kind: row.key === 'hazards' ? 'Hazard' : row.label, text: row.text, home: row.key });
  }
  return out;
}

// ---- the page model --------------------------------------------------------------------------------------------------------------

const COVER_ECHO = new Set(['class_key', 'draw', 'standing', 'distinction', 'easy_payoff', 'weather', 'why', 'why_stay']);

/** The ticket offer of a lift line: an offer `on` the line (CC-adapter 4). */
function ticketOf(world: World, ref: string): string | null {
  for (const o of incomingOf(world, ref).on) {
    const rec = world.cap.get(o)?.rec;
    if (rec && rec.layer === 'offer') {
      const cls = rec.offer_class ?? resolveNode(rec.type)?.layers.offer?.offer_class ?? null;
      if (cls === 'ticket') return o;
    }
  }
  return null;
}

/**
 * The page model for one record. `null` when the ref has no capture record (a legacy place the capture model has not
 * reached): the caller keeps the old page for it, and this module claims nothing.
 */
export function buildSections(world: World, rawRef: string, contract: Contract, opts: BuildOptions = {}): PageModel | null {
  const ref = primaryRef(world, rawRef);
  const capL = world.cap.get(ref);
  if (!capL) return null;
  const cap = capL.rec;
  const layer = cap.layer as Layer;
  if (!contract.has(cap.type)) return null;
  const scrub = opts.scrub ?? new TextScrub();
  const words: Words = { ...WORDS, ...opts.words };
  const titles = { ...SECTION_TITLES, ...opts.titles };

  const relRef = judgedRefOf(world, ref, cap);
  const rel = world.rel.get(relRef)?.rec;
  const r: Rec = { world, ref, cap, rel, relRef, scrub, capLookup: lookupFor(capL), relLookup: lookupFor(world.rel.get(relRef)) };
  const payoff = relRef !== ref ? { ref: relRef, name: nameOfRef(world, relRef) } : null;

  // the suitability block: the record's own, or the ticket offer of a lift line
  const ticketRef = layer === 'route' || layer === 'place' ? ticketOf(world, ref) : null;
  const suitRef = world.suit.has(ref) ? ref : (ticketRef && world.suit.has(ticketRef) ? ticketRef : null);
  const suitLoc = suitRef ? world.suit.get(suitRef)! : null;
  const suitType = suitRef && suitRef !== ref ? (world.cap.get(suitRef)?.rec.type ?? cap.type) : cap.type;
  const suitMarks = suitMarksFor(contract, suitType) ?? undefined;
  const operated = opts.operated ?? suitLoc?.rec.operated;

  // a lift line has no suitability block: its offer layer's suitability properties are asked on the line's page
  const markOpts = { operated, suitabilityFrom: ticketRef ? ('offer' as Layer) : undefined };
  const sectionMarks = contract.sectionsFor(cap.type, layer, markOpts);
  const glanceKeys = contract.glanceFor(cap.type, layer, markOpts);
  const rowsByKey = new Map<string, Row>();
  const sections: SectionModel[] = [];

  for (const sm of sectionMarks) {
    const rows: Row[] = [];
    const missingA: string[] = [];
    let anyAsked = false;
    const suitPaths: { key: string; def: PropertyDef; mark: Mark }[] = [];
    for (const p of sm.props) {
      const isSuit = p.def.home.in === 'suitability';
      // an R? property is R when its condition holds, N when it does not, and A when the data cannot decide
      let mark: Mark = p.mark;
      if (mark === 'R?' && !isSuit) {
        const holds = conditionHolds(r, p.def);
        if (holds === false) continue;
        mark = holds === true ? 'R' : 'A';
      } else if (mark === 'R?') mark = 'R';
      anyAsked = true;
      if (isSuit) {
        suitPaths.push({ key: p.key, def: p.def, mark });
        continue;
      }
      const echo = sm.id === 'cover' && COVER_ECHO.has(p.key);
      const row = baseRow(r, p.def, mark, p.home, echo);
      if (p.key === 'type' && !row.gap) row.text = contract.node(cap.type)?.label ?? row.text;
      if (row.gap && mark === 'A') missingA.push(p.def.label.toLowerCase());
      else {
        rows.push(row);
        rowsByKey.set(p.key, row);
      }
    }
    // suitability properties homed in this section (facilities, access season, the hazards without section 4)
    if (suitPaths.length > 0 && sm.id !== 'suits') {
      const { rows: srows, missingA: sMissing } = suitabilityRows(suitLoc, suitPaths.map((x) => x.key), { suitMarks, fallbackKind: cap.type });
      for (const s of srows) {
        const p = suitPaths.find((x) => x.key === s.key)!;
        const row = fromSuitRow(s, p.def, p.mark, sm.id, false);
        rows.push(row);
        rowsByKey.set(s.key, row);
      }
      missingA.push(...sMissing);
    }
    // section 4 (suits) is drawn by publicSuitability: its properties produce no rows here, only the `drawn` flag

    // R properties and no value in any: the page draws one closing line instead of the gap chips (PS14); the rows stay as data
    const empty = anyAsked && sm.id !== 'suits' && rows.length > 0 && rows.every((x) => x.gap);
    const closingLabels = empty ? [...rows.map((x) => x.label.toLowerCase()), ...missingA] : missingA;
    sections.push({
      n: sm.n,
      id: sm.id,
      title: sm.id === 'around' ? AROUND_TITLE[layer] : titles[sm.id],
      drawn: sm.drawn,
      rows,
      closing: closingLabels.length > 0 ? `${words.closingPrefix}${closingLabels.join(', ')}` : null,
      empty,
      delegate: sm.id === 'suits' ? 'suitability' : sm.id === 'pairs' ? 'relevance' : null,
      lines: [],
    });
  }

  // warnings: structured lines for the Rest! items
  const warnings = sections.find((s) => s.id === 'warnings');

  // glance slots: echoes of the home rows
  const glance = glanceKeys.filter((k) => rowsByKey.has(k) || contract.properties[k]?.home.in === 'suitability');

  // relations
  const inc = incomingOf(world, ref);
  const link = (x: string): RefLink => ({ ref: primaryRef(world, x), name: nameOfRef(world, x) });
  const typeOf = (x: string): string => world.cap.get(primaryRef(world, x))?.rec.type ?? '';
  const classOf = (x: string): string | null => {
    const rec = world.cap.get(primaryRef(world, x))?.rec;
    return rec?.offer_class ?? (rec ? (resolveNode(rec.type)?.layers.offer?.offer_class ?? null) : null);
  };

  // ways: the routes, lifts and roads that reach a place (never offers; contract 2.7.4)
  const ways: WayRow[] = inc.reached_by
    .filter((x) => world.cap.get(x)?.rec.layer === 'route')
    .map((x) => ({ ...link(x), type: typeOf(x), layer: 'route' as Layer }));

  const routeStops: PageModel['routeStops'] = [];
  if (layer === 'route') {
    for (const x of cap.starts_at ?? []) routeStops.push({ ...link(x), role: 'starts_at', atKm: 0 });
    for (const p of cap.passes ?? []) routeStops.push({ ...link(p.ref), role: 'passes', atKm: p.at_km ?? null });
    for (const x of cap.reaches ?? []) routeStops.push({ ...link(x), role: 'reaches', atKm: null });
    for (const x of cap.ends_at ?? []) routeStops.push({ ...link(x), role: 'ends_at', atKm: null });
  }

  const accessPoints: AccessPoint[] = [];
  const addAp = (xs: string[], role: AccessPoint['role']): void => {
    for (const x of xs) if (!accessPoints.some((a) => a.ref === primaryRef(world, x))) accessPoints.push({ ...link(x), role, type: typeOf(x) });
  };
  addAp(cap.starts_at ?? [], 'starts_at');
  addAp(inc.parks_for, 'parks_for');
  addAp(inc.serves, 'serves');
  addAp(inc.starts_here, 'starts_here');

  // offers at or on this record: tickets and access are section 6; experiences and rentals are section 10
  const offerRefs = [...new Set([...inc.at, ...inc.on])].filter((x) => world.cap.get(x)?.rec.layer === 'offer' && x !== ticketRef);
  const selling = offerRefs.filter((x) => SELLING_CLASSES.has(classOf(x) ?? ''));
  const offers: OfferCard[] = [...(ticketRef ? [ticketRef] : []), ...selling].map((x) => offerCard(r, contract, x, scrub, words));
  if (layer === 'offer') offers.length = 0;

  const around = aroundGroups(world, ref, offerRefs.filter((x) => !SELLING_CLASSES.has(classOf(x) ?? '')), cap, typeOf, classOf, link);

  // parts folded into this page
  const parts = inc.children.filter((x) => /^part\//.test(x)).map((x) => ({ ...link(x), type: typeOf(x) }));

  // links: the checklist of the type against what the record holds
  const links = linkTabs(contract, cap);

  // place checks: the engine's level, and the base R properties answered out of asked
  const comp = completeness(world, ref);
  const baseR = [...contract.marks(cap.type, layer, markOpts).entries()].filter(([k, m]) => m === 'R' && contract.properties[k]!.home.in !== 'suitability').length;
  const missing = (comp?.missingBase.length ?? 0) + (comp?.conditionalMissing.length ?? 0);
  const reads = [...rowsByKey.values()].map((x) => x.val?.read).filter((d): d is string => !!d).sort();

  if (warnings) warnings.lines = warningLines(warnings.rows);
  // a lift line has no price of its own: its ticket offer is the content of section 6
  const options = sections.find((x) => x.id === 'options');
  if (options && !options.drawn && offers.length > 0) options.drawn = true;

  return {
    ref,
    type: cap.type,
    layer,
    name: cap.name ?? nameOfRef(world, ref),
    typeLabel: contract.node(cap.type)?.label ?? cap.type,
    sections,
    glance,
    suitabilityRef: suitRef,
    ticket: ticketRef ? link(ticketRef) : null,
    payoff,
    partOf: (cap.part_of ?? []).map(link),
    parts,
    ways,
    routeStops,
    accessPoints,
    offers,
    around,
    links,
    checks: { done: Math.max(0, baseR - missing), total: baseR, read: reads.length ? reads[reads.length - 1]! : null, level: comp?.level ?? 'stub' },
  };
}

function offerCard(r: Rec, contract: Contract, ref: string, scrub: TextScrub, words: Words): OfferCard {
  const world = r.world;
  const cap = world.cap.get(ref)!.rec;
  const rel = world.rel.get(ref)?.rec;
  const sub: Rec = { ...r, ref, cap, rel, relRef: ref, capLookup: lookupFor(world.cap.get(ref)), relLookup: lookupFor(world.rel.get(ref)) };
  const marks = contract.marks(cap.type, 'offer');
  const rows: Row[] = [];
  const missingA: string[] = [];
  for (const key of ['price', 'window', 'duration_min', 'reservation', 'book_url', 'cancellation', 'deposit', 'included', 'variants']) {
    const mark = marks.get(key);
    const def = contract.properties[key];
    if (!mark || !def) continue;
    let m: Mark = mark;
    if (m === 'R?') {
      const holds = conditionHolds(sub, def);
      if (holds === false) continue;
      m = holds === true ? 'R' : 'A';
    }
    const row = baseRow(sub, def, m, 'options', false);
    if (row.gap && m === 'A') missingA.push(def.label.toLowerCase());
    else rows.push(row);
  }
  const at = (cap.at ?? [])[0];
  const operator = cap.run_by ? { ref: cap.run_by, name: world.operators.get(cap.run_by)?.name ?? nameOfRef(world, cap.run_by) } : null;
  return {
    ref,
    name: cap.name ?? nameOfRef(world, ref),
    offerClass: cap.offer_class ?? resolveNode(cap.type)?.layers.offer?.offer_class ?? null,
    type: cap.type,
    at: at ? { ref: primaryRef(world, at), name: nameOfRef(world, at) } : null,
    operator,
    rows,
    closing: missingA.length ? `${words.closingPrefix}${missingA.join(', ')}` : null,
  };
}

function aroundGroups(
  world: World,
  ref: string,
  offerRefs: string[],
  cap: CaptureRecord,
  typeOf: (x: string) => string,
  classOf: (x: string) => string | null,
  link: (x: string) => RefLink,
): AroundGroup[] {
  const groups = new Map<string, AroundGroup>();
  const add = (domain: string, at: RefLink | null, offerRef: string): void => {
    const key = `${domain}|${at?.ref ?? ''}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { domain, at, items: [] }));
    const where = (world.cap.get(offerRef)?.rec.at ?? [])[0];
    g.items.push({ ...link(offerRef), type: typeOf(offerRef), offerClass: classOf(offerRef), where: where ? link(where) : null });
  };
  for (const o of offerRefs) add(typeOf(o).split('.')[0] ?? '', null, o);
  // offers at a folded part ("At the payoff: Sentinel Pass"): the part is a child of this record
  for (const child of incomingOf(world, ref).children.filter((x) => /^part\//.test(x))) {
    const inc = incomingOf(world, child);
    for (const o of [...inc.at, ...inc.on].filter((x) => world.cap.get(x)?.rec.layer === 'offer' && !SELLING_CLASSES.has(classOf(x) ?? ''))) add(typeOf(o).split('.')[0] ?? '', link(child), o);
  }
  void cap;
  return [...groups.values()].sort((a, b) => Number(!!a.at) - Number(!!b.at) || a.domain.localeCompare(b.domain));
}

function linkTabs(contract: Contract, cap: CaptureRecord): LinkTab[] {
  const asked = contract.linksFor(cap.type);
  const have = new Map((cap.links ?? []).map((l) => [l.kind, l]));
  const tabs: LinkTab[] = [];
  const mark = (kinds: string[], required: LinkTab['required']): void => {
    for (const kind of kinds) {
      const l = have.get(kind as never);
      tabs.push({
        kind,
        state: l ? (l.state as LinkTab['state']) : 'not_checked',
        url: l && l.state !== 'searched_none' ? (l.url ?? null) : null,
        required,
        searched: l?.on ?? null,
      });
    }
  };
  mark(asked.R, 'R');
  mark(asked['R?'], 'R?');
  mark(asked.A, 'A');
  return tabs;
}
