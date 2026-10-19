import { existsSync, readFileSync } from 'node:fs';
import type { Located } from '@travel/core/capture/records.ts';
import { HOUSEHOLD_TEXT, type DropLog } from './dateless';
import { publicOrigin } from './origin';

// Shared by the S1 adapter modules (contract, sections, suitability, relevance): the public shape of a sourced value, the
// source table lookup, the wording of a basis, and the text scrub every free-text field of a sidecar goes through.
// Pure over data already loaded; the only file read is a sidecar's own source table, once per file.

/** The value wrapper of the three sidecars (suitability `val`, relevance `rval`, capture `val`), as stored. */
export interface RawVal {
  v: unknown;
  state: string;
  basis: string | null;
  src?: string[];
  read?: string;
  quote?: string;
  note?: string;
  tried?: string[];
  on?: string;
  applies_to?: string;
  conflicts?: { v: unknown; basis: string | null; src?: string[]; note?: string }[];
}

export interface SourceRow {
  id: string;
  url: string;
  title: string;
  publisher: string;
  kind: string;
  read: string;
}

/** A sourced value as the public page draws it: the stored value plus everything its provenance popover shows. */
export interface PVal<T = unknown> {
  value: T | null;
  state: 'value' | 'none_stated' | 'searched_none' | 'not_applicable' | 'gap' | 'no_limit';
  basis: string | null;
  basisLabel: string;
  /** the kind of statement this is: a rule (operator or official), advice (our judgement) or information */
  look: 'rule' | 'advice' | 'info' | 'none';
  sources: SourceRow[];
  /** the date this value was read: its own, else the newest of its sources */
  read: string | null;
  quote: string | null;
  note: string | null;
  /** where we looked when nothing was found */
  tried: string[];
  /** the date we searched, for searched_none */
  searched: string | null;
  appliesTo: string | null;
  conflicts: { value: unknown; basisLabel: string; sources: SourceRow[]; note: string | null }[];
}

export const BASIS_LABEL: Record<string, string> = {
  operator_rule: 'operator rule',
  official_rule: 'official rule',
  official_grade: 'official grade',
  official_info: 'official information',
  operator_info: 'operator information',
  community: 'community reports',
  our_inference: 'our judgement',
  editorial: 'editorial',
};

const RULE_BASES = new Set(['operator_rule', 'official_rule']);

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-12" -> "12 Oct 2026". */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTH[Number(m[2]) - 1]} ${m[1]}` : iso;
}

/** Platforms whose figures are never data. A source on one of them is not shown as a source (link-only rule). */
const LINK_ONLY = /(?:alltrails|komoot|gaia ?gps|gaiagps|outdooractive|wikiloc|trailforks|strava|fatmap|google\.|tripadvisor|yelp\.|booking\.com)/i;

// ---- sources -------------------------------------------------------------------------------------------------------

const tableCache = new Map<string, Map<string, SourceRow>>();

/** The source table of a sidecar file, by id. Read once per file. */
export function sourceTable(file: string): Map<string, SourceRow> {
  const hit = tableCache.get(file);
  if (hit) return hit;
  const out = new Map<string, SourceRow>();
  if (file && existsSync(file)) {
    try {
      const doc = JSON.parse(readFileSync(file, 'utf8')) as { sources?: SourceRow[] };
      for (const s of doc.sources ?? []) if (!LINK_ONLY.test(s.url) && !LINK_ONLY.test(s.publisher)) out.set(s.id, s);
    } catch {
      /* an unreadable file has no sources; the value still shows its basis */
    }
  }
  tableCache.set(file, out);
  return out;
}

/** A bare URL, and a sentence that names a link-only platform: its figures and links are never published. */
const URL_TEXT = /\s*\bhttps?:\/\/[^\s)]*[^\s).,;]/gi;
const PLATFORM_NAME = /\b(?:alltrails|komoot|gaia ?gps|outdooractive|wikiloc|trailforks|strava|fatmap|tripadvisor|yelp)\b/i;

/** Resolves source ids against the table of the file the value came from. */
export type SourceLookup = (ids: string[] | undefined) => SourceRow[];

export function lookupFor(located: Pick<Located<unknown>, 'file'> | undefined | null, extra?: Map<string, SourceRow>): SourceLookup {
  const table = located ? sourceTable(located.file) : new Map<string, SourceRow>();
  return (ids) => (ids ?? []).map((id) => table.get(id) ?? extra?.get(id)).filter((s): s is SourceRow => !!s);
}

// ---- text ----------------------------------------------------------------------------------------------------------

/** Scrubs free text from a sidecar: household capture notes dropped whole, the party rewritten, the home town replaced. */
export class TextScrub {
  constructor(readonly log?: DropLog) {}

  text(raw: string | null | undefined, where: string): string {
    const t = (raw ?? '').trim();
    if (!t) return '';
    const parts = t.match(/(?:[^.!?]|[.!?](?!\s|$))+[.!?]*\s*/g) ?? [t];
    const kept: string[] = [];
    for (const p of parts) {
      if (HOUSEHOLD_TEXT.test(p)) this.log?.add(where, p.trim(), 'household capture note (plan link, stay idea or address); never published');
      else if (PLATFORM_NAME.test(p)) this.log?.add(where, p.trim(), 'names a link-only platform; its figures and links are never published');
      else {
        const noUrl = p.replace(URL_TEXT, '').trim();
        if (noUrl) kept.push(`${noUrl} `);
      }
    }
    return publicOrigin(kept.join('').trim(), where, this.log);
  }

  maybe(raw: string | null | undefined, where: string): string | null {
    const s = this.text(raw, where);
    return s ? s : null;
  }
}

// ---- values --------------------------------------------------------------------------------------------------------

const STATES = new Set(['value', 'none_stated', 'searched_none', 'not_applicable', 'gap', 'no_limit']);

export const isRawVal = (x: unknown): x is RawVal =>
  typeof x === 'object' && x !== null && !Array.isArray(x) && 'state' in x && 'v' in x && STATES.has((x as { state: string }).state);

/** The newest `read` date among a value's own date and its sources. */
export function readOf(v: Pick<RawVal, 'read' | 'on'>, sources: SourceRow[]): string | null {
  const dates = [v.read, ...sources.map((s) => s.read)].filter((d): d is string => !!d).sort();
  return dates.length ? dates[dates.length - 1]! : (v.on ?? null);
}

/** A stored value as the public page draws it. `where` names the field for the build report of dropped text. */
export function pval<T = unknown>(raw: RawVal, lookup: SourceLookup, scrub: TextScrub, where: string): PVal<T> {
  const sources = lookup(raw.src);
  const basis = raw.basis ?? null;
  const state = (STATES.has(raw.state) ? raw.state : 'gap') as PVal['state'];
  return {
    value: (raw.v ?? null) as T | null,
    state,
    basis,
    basisLabel: basis ? (BASIS_LABEL[basis] ?? basis.replace(/_/g, ' ')) : '',
    look: state !== 'value' && state !== 'no_limit' ? 'none' : basis && RULE_BASES.has(basis) ? 'rule' : basis === 'our_inference' ? 'advice' : 'info',
    sources,
    read: readOf(raw, sources),
    quote: scrub.maybe(raw.quote, `${where} quote`),
    note: scrub.maybe(raw.note, `${where} note`),
    tried: raw.tried ?? [],
    searched: raw.on ?? null,
    appliesTo: raw.applies_to ?? null,
    conflicts: (raw.conflicts ?? []).map((c) => ({
      value: c.v,
      basisLabel: c.basis ? (BASIS_LABEL[c.basis] ?? c.basis) : '',
      sources: lookup(c.src),
      note: scrub.maybe(c.note, `${where} conflict`),
    })),
  };
}

/** "a, b and c" with an Oxford-free join, for the closing "Not checked yet: a, b, c" lines. */
export const joinList = (xs: string[]): string => xs.join(', ');

// ---- wording the three adapter modules share ------------------------------------------------------------------------

/**
 * Every fixed string the S1 modules emit that an owner decision may still change (Q29 to Q32). Part B can pass a partial
 * override into each builder; the modules never inline these.
 */
export interface Words {
  gap: string;
  gapLimits: string;
  closingPrefix: string;
  notJudged: string;
  searchedNone: string;
  noLimit: string;
}
export const WORDS: Words = {
  gap: 'Not checked yet',
  gapLimits: 'Limits not checked yet · ask the operator',
  closingPrefix: 'Not checked yet: ',
  notJudged: 'Worth the trip? Not checked yet',
  searchedNone: 'Not stated by the operator',
  noLimit: 'No minimum age',
};
