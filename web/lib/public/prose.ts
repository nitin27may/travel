// Cleaning public prose (trip-timeline spec 5). Pure: no I/O. Research markers become honesty chips, quantities become
// tokens the page renders through the unit preference, and a long note becomes a lead line plus "Know before you go"
// bullets in a fixed group order. Every public string the timeline adapter emits goes through here after the dateless and
// party scrubs, so nothing reaches a page with INFERENCE, CALC, GAP or "low confidence" in it.

import { isDated } from './dateless';

export type ProseChip = 'estimate' | 'not_known' | 'sources_disagree' | 'low_confidence' | 'pattern_2026';

/** A run of prose: plain text, or a quantity the reader sees in their units. Values are metric. */
export type ProseRun =
  | { text: string }
  | { qty: number; to?: number; unit: 'km' | 'm' | 'C'; dim: 'distance' | 'elevation' | 'temperature'; decimals: number };

/** Cleaned text with its chips. Quantities stay in the text as the source wrote them (metric); `<Prose>` turns them into
 * runs with `quantityRuns` at render, so the page follows the unit preference and the item lines agree with the notes. */
export interface CleanProse {
  plain: string;
  chips: ProseChip[];
}

export const KNOW_GROUPS = ['Book', 'Getting there', 'With kids', 'Conditions', 'Decide on the day', 'If it rains', 'Other'] as const;
export type KnowGroupName = (typeof KNOW_GROUPS)[number];

export interface KnowBullet {
  plain: string;
  chips: ProseChip[];
}
export interface KnowGroup {
  group: KnowGroupName;
  bullets: KnowBullet[];
}

/** An entry's note: a lead line, and the rest grouped. */
export interface NoteBlock {
  lead: CleanProse | null;
  know: KnowGroup[];
}

// ---- 5.1 markers ----

const MARKER_WORD = /\b(?:INFERENCE|CALC|GAP|low confidence|conflict)\b/;

/** The text with every research marker removed or reworded, and the chips it earned. */
export function stripMarkers(input: string, sun?: { sunset: [string, string]; sunrise: [string, string] } | null): { text: string; chips: ProseChip[] } {
  const chips = new Set<ProseChip>();
  let t = input;
  const add = (c: ProseChip) => chips.add(c);

  // "(20:16 CALC)" and "20:16 CALC": the computed sun range replaces a typed time
  t = t.replace(/\(\s*(\d{1,2}:\d{2})\s+CALC\s*\)/g, () => (sun ? `(about ${sun.sunset[0]} to ${sun.sunset[1]})` : ''));
  t = t.replace(/\b(\d{1,2}:\d{2})\s+CALC\b/g, () => (sun ? `about ${sun.sunset[0]} to ${sun.sunset[1]}` : ''));

  // a parenthesis that is only provenance goes whole
  t = t.replace(/\s*\(([^()]*)\)/g, (m, inner: string) => {
    const words = inner.replace(MARKER_WORD, '').replace(/[,;:\s]+/g, ' ').trim();
    const onlyProvenance = /^(?:matrix |researcher |status |dataset figures, status |sources? |\d{4}-\d{2} )?(?:INFERENCE|CALC|GAP|VERIFIED|checked|low confidence|unverified|unsourced)\b/i.test(inner.trim()) || /\b(?:blogs?|blog),? (?:low confidence|unverified)\b/i.test(inner) || /,\s*(?:conflict|low confidence)\s*$/i.test(inner);
    if (/\bINFERENCE\b/.test(inner)) add('estimate');
    if (/\blow confidence\b/i.test(inner)) add('low_confidence');
    if (/\bconflict\b/i.test(inner)) add('sources_disagree');
    if (/\bGAP\b/.test(inner)) add('not_known');
    if (onlyProvenance && words.split(' ').length <= 12 && !/\bGAP\b/.test(inner)) return '';
    if (onlyProvenance && /\bINFERENCE\b/.test(inner) && !/;/.test(inner)) return '';
    return m;
  });

  // flag lines: "GAP: Maligne Canyon status in 2029" and "INFERENCE: drive time from the matrix"
  t = t.replace(/^\s*GAP:\s*(.+?)\.?\s*$/s, (_m, x: string) => { add('not_known'); return `${x.charAt(0).toUpperCase()}${x.slice(1)}: not known yet.`; });
  t = t.replace(/^\s*INFERENCE:\s*(.+?)\.?\s*$/s, (_m, x: string) => { add('estimate'); return `${x.charAt(0).toUpperCase()}${x.slice(1)}: an estimate.`; });
  t = t.replace(/^\s*(?:CALC|VERIFIED):\s*/s, '');

  // inside a sentence
  t = t.replace(/\b(?:is|are) (?:a |an )?GAP\b/g, () => { add('not_known'); return 'is not known yet'; });
  t = t.replace(/\b(?:2029|2027|2028|2026) GAP\b/g, () => { add('not_known'); return 'not known yet'; });
  t = t.replace(/\bGAP\b/g, () => { add('not_known'); return 'not known yet'; });
  t = t.replace(/[,;]?\s*\b(?:matrix |researcher |status )?INFERENCE\b(?:, not in the matrix)?/g, () => { add('estimate'); return ''; });
  t = t.replace(/\bCALC\b/g, '');
  t = t.replace(/[,;]?\s*\b(?:2025-26 )?blogs?,? low confidence\b/gi, () => { add('low_confidence'); return ''; });
  t = t.replace(/[,;]?\s*\blow confidence\b/gi, () => { add('low_confidence'); return ''; });
  t = t.replace(/[,;]?\s*\b(?:20\d\d, )?conflict\b/gi, () => { add('sources_disagree'); return ''; });
  t = t.replace(/\bVERIFIED\b[:,]?\s*/g, '');
  if (/\b(?:2026 hours|2026 terms|hours used)\b|\(2026:/.test(t)) add('pattern_2026');

  // tidy what the removals left behind
  t = t
    .replace(/\(\s*[,;:]?\s*\)/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([,;:])\s*([.)])/g, '$2')
    .replace(/\(\s+/g, '(')
    .replace(/\s{2,}/g, ' ')
    .replace(/\bnot known yet(?: not known yet)+/g, 'not known yet')
    .trim();
  return { text: t, chips: [...chips] };
}

// ---- 5.2 quantities ----

/** Names and codes whose digits are not quantities: Highway 93, Route 100, 1A, P4, Hwy 742, Rd 12. */
const NAME_NUMBER = /\b(?:Highway|Hwy|Route|Rte|Road|Rd|Lot|Level|Day|Days|Stop|Track|Trail|Option|Plan|Gate|Exit|Pier|Platform|Bus|Line|P)\s*#?\s*$/i;

const QTY = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(km|m|C)\b(?!\s*(?:in|of)?\s*(?:Highway|Hwy))/g;
const CLIMB_WORDS = /\b(?:up|climb|climbs|climbing|gain|gains|elevation|altitude|above|higher|ascent|descent|down)\b/i;
const ELEV_HAS_KM = /\bkm\b/i;

const decimalsOf = (s: string): number => (s.includes('.') ? s.split('.')[1]!.length : 0);

/**
 * Text into runs. A `m` next to a km figure, or with climb words, is elevation; otherwise under 1,000 it is a distance in
 * metres and converts as km/1000. A number that is part of a name is never converted. Ranges stay ranges.
 */
export function quantityRuns(text: string): ProseRun[] {
  const runs: ProseRun[] = [];
  let last = 0;
  for (const m of text.matchAll(QTY)) {
    const idx = m.index ?? 0;
    const before = text.slice(Math.max(0, idx - 14), idx);
    if (NAME_NUMBER.test(before)) continue;
    // a number glued to a letter or inside a word ("1A", "P4", "H2O") is a code
    if (idx > 0 && /[A-Za-z]/.test(text[idx - 1]!)) continue;
    const unit = m[3] as 'km' | 'm' | 'C';
    const a = Number(m[1]);
    const b = m[2] !== undefined ? Number(m[2]) : undefined;
    const around = text.slice(Math.max(0, idx - 28), idx + m[0].length + 28);
    let dim: 'distance' | 'elevation' | 'temperature';
    let value = a;
    let to = b;
    let decimals = Math.max(decimalsOf(m[1]!), m[2] ? decimalsOf(m[2]) : 0);
    let u: 'km' | 'm' | 'C' = unit;
    if (unit === 'C') dim = 'temperature';
    else if (unit === 'km') dim = 'distance';
    else if (CLIMB_WORDS.test(around) || (ELEV_HAS_KM.test(around) && (a >= 20 || (b ?? 0) >= 20)) || a >= 1000) dim = 'elevation';
    else {
      // a short distance in metres: carry it as km so 500 m and 0.5 km agree
      dim = 'distance';
      value = a / 1000;
      to = b !== undefined ? b / 1000 : undefined;
      u = 'km';
      decimals = 3;
    }
    if (idx > last) runs.push({ text: text.slice(last, idx) });
    runs.push({ qty: value, ...(to !== undefined ? { to } : {}), unit: u, dim, decimals });
    last = idx + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

/** Concatenates runs back into metric text, as the source wrote it. */
export function plainOf(runs: ProseRun[]): string {
  return runs
    .map((r) => {
      if ('text' in r) return r.text;
      const f = (v: number) => (r.decimals === 3 ? String(Math.round(v * 1000)) : v.toFixed(r.decimals));
      const unit = r.decimals === 3 ? ' m' : r.unit === 'C' ? ' C' : ` ${r.unit}`;
      return `${f(r.qty)}${r.to !== undefined ? `-${f(r.to)}` : ''}${unit}`;
    })
    .join('');
}

export function cleanProse(text: string | null | undefined, sun?: { sunset: [string, string]; sunrise: [string, string] } | null): CleanProse | null {
  const raw = (text ?? '').trim();
  if (!raw) return null;
  const { text: stripped, chips } = stripMarkers(raw, sun);
  if (!stripped) return null;
  return { plain: stripped, chips };
}

// ---- 5.3 Know before you go ----

const SENTENCE = /(?:[^.!?]|[.!?](?![\s]|$))+[.!?]*\s*/g;
export const sentences = (t: string): string[] => (t.match(SENTENCE) ?? [t]).map((s) => s.trim()).filter(Boolean);

const GROUP_WORDS: [KnowGroupName, RegExp][] = [
  ['Book', /\b(?:book|booked|booking|reserve|reservation|slot|ticket|tickets|sells out|sold out|pre-?book|seats)\b/i],
  ['Getting there', /\b(?:lot|lots|parking|park and ride|shuttle|road|highway|hwy|parkway)\b/i],
  ['With kids', /\b(?:child|children|kids?|stroller|strollers|carrier|toilets?|hold hands|fenced|youngest)\b/i],
  ['Conditions', /\b(?:closed|closure|status|bears?|grizzly|snow|rain|wind|cloud|smoke|ice|crevasse|exposed|slippery|wildlife|elk|avalanche)\b/i],
];

function groupOf(sentence: string): KnowGroupName {
  for (const [g, re] of GROUP_WORDS) if (re.test(sentence)) return g;
  return 'Other';
}

/** True when a note is long enough to split: over two sentences or 240 characters. */
export const isLongNote = (t: string): boolean => t.length > 240 || sentences(t).length > 2;

// ---- turning a raw research sentence into public text ----

export interface PrepareOpts {
  /** The computed sun range for the day, to replace "20:16 CALC". */
  sun?: { sunset: [string, string]; sunrise: [string, string] } | null;
  /** The dateless, household and party scrub of the adapter (undatedSentences). Returns '' when the sentence goes. */
  scrub?: (s: string) => string;
  /** Record ids to their names: "johnson-lake-loop" becomes "Johnson Lake Loop". */
  names?: Map<string, string>;
}

const MON = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
/** "on 8 Oct 2026" and "Oct 8, 2026" become "in 2026": the year stays, the calendar date goes. */
export function datesToYear(t: string): string {
  return t
    .replace(new RegExp(`\\b(?:on |since |from |until )?\\d{1,2}(?:\\s*[-–]\\s*\\d{1,2})?\\s+${MON}\\.?,?\\s+((?:19|20)\\d\\d)\\b`, 'gi'), 'in $1')
    .replace(new RegExp(`\\b(?:on |since |from |until )?${MON}\\.?\\s+\\d{1,2},?\\s+((?:19|20)\\d\\d)\\b`, 'gi'), 'in $1');
}

/** A parenthesis that carries a calendar date goes whole (it is a 2026 pattern: the chip says so). */
export function dropDatedParens(t: string): { text: string; dropped: boolean } {
  let dropped = false;
  const text = t.replace(/\s*\(([^()]*)\)/g, (m, inner: string) => {
    if (!isDated(inner)) return m;
    dropped = true;
    return '';
  });
  return { text, dropped };
}

const KEBAB_PAREN = /\(\s*[a-z0-9]+(?:-[a-z0-9]+)+\s*\)/g;
const KEBAB_LEAD = /\(\s*[a-z0-9]+(?:-[a-z0-9]+)+\s*[,;]\s*/g;

/** One research sentence to public text and its chips, or null when nothing is left. */
export function prepareSentence(raw: string, o: PrepareOpts = {}): CleanProse | null {
  let t = raw.trim();
  if (!t) return null;
  if (o.names) {
    for (const [id, name] of [...o.names].sort((a, b) => b[0].length - a[0].length)) t = t.replace(new RegExp(`(?<![\\w-])${id}(?![\\w-])`, 'g'), name);
  }
  t = t.replace(KEBAB_PAREN, '').replace(KEBAB_LEAD, '(');
  // "Maligne Canyon (Maligne Canyon)" once the id became its name; and the plan's track letters in plain words
  t = t.replace(/(\b[A-Z][\w' -]{2,40}?) \(\1\)/g, '$1');
  t = t.replace(/\bTrack A\b/g, "the adults' hike").replace(/\bTrack B\b/g, 'the family version').replace(/\bTrack C\b/g, 'the easy version');
  t = datesToYear(t);
  const { text: stripped, chips } = stripMarkers(t, o.sun);
  const { text: undatedParens, dropped } = dropDatedParens(stripped);
  if (dropped) chips.push('pattern_2026');
  let plain = undatedParens.replace(/\s{2,}/g, ' ').trim();
  if (o.scrub) plain = o.scrub(plain).trim();
  if (!plain || !/[A-Za-z]{3}/.test(plain)) return null;
  return { plain, chips: [...new Set(chips)] };
}

const prepareAll = (text: string | null | undefined, o: PrepareOpts): CleanProse[] =>
  sentences(text ?? '').map((s) => prepareSentence(s, o)).filter((x): x is CleanProse => x !== null);

/** A short note as one line of public text. */
export function noteLine(text: string | null | undefined, o: PrepareOpts = {}): CleanProse | null {
  const all = prepareAll(text, o);
  if (!all.length) return null;
  return { plain: all.map((x) => x.plain).join(' '), chips: [...new Set(all.flatMap((x) => x.chips))] };
}

/** Groups bullets in the fixed order; empty groups are left out. */
export function groupBullets(items: { group: KnowGroupName; bullet: KnowBullet }[]): KnowGroup[] {
  const out: KnowGroup[] = [];
  for (const g of KNOW_GROUPS) {
    const bullets = items.filter((i) => i.group === g).map((i) => i.bullet);
    if (bullets.length) out.push({ group: g, bullets });
  }
  return out;
}

/** A track's note: a short one stays a lead line; a long one keeps its first sentence as the lead and groups the rest. */
export function noteBlock(note: string | null | undefined, o: PrepareOpts = {}): NoteBlock {
  const all = prepareAll(note, o);
  if (!all.length) return { lead: null, know: [] };
  const joined = all.map((x) => x.plain).join(' ');
  if (!isLongNote(joined)) return { lead: { plain: joined, chips: [...new Set(all.flatMap((x) => x.chips))] }, know: [] };
  const [lead, ...rest] = all;
  return { lead: lead!, know: groupBullets(rest.map((r) => ({ group: groupOf(r.plain), bullet: r }))) };
}

export interface DayNotes {
  decisionRule: string | null | undefined;
  wetWeather: string | null | undefined;
  statusFlags: string[] | null | undefined;
}

/** The day's Know before you go: the decision rule, the wet-weather swap, and the status flags as bullets. */
export function dayKnow(n: DayNotes, o: PrepareOpts = {}): KnowGroup[] {
  const items: { group: KnowGroupName; bullet: KnowBullet }[] = [];
  for (const b of prepareAll(n.decisionRule, o)) items.push({ group: 'Decide on the day', bullet: b });
  for (const b of prepareAll(n.wetWeather, o)) items.push({ group: 'If it rains', bullet: b });
  for (const f of n.statusFlags ?? []) {
    const b = prepareSentence(f, o);
    if (b) items.push({ group: /\b(?:book|booking|reserv|shuttle)\b/i.test(b.plain) ? 'Book' : 'Conditions', bullet: b });
  }
  return groupBullets(items);
}

/** A string that still carries a research marker. */
export const hasMarker = (t: string): boolean => /\b(?:INFERENCE|CALC|GAP)\b|low confidence/.test(t);

/** Cleans every string in a built value in place (the dataset's last pass, like scrubOrigin): markers out, the rest untouched. */
export function scrubMarkers<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      value[i] = typeof v === 'string' ? (hasMarker(v) ? stripMarkers(v).text : v) : scrubMarkers(v);
    });
  } else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string') {
        if (hasMarker(v)) o[k] = stripMarkers(v).text;
      } else if (v && typeof v === 'object') scrubMarkers(v);
    }
  }
  return value;
}
