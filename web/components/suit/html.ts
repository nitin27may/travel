import { UNIT_PATTERN } from '@/lib/format/convert';
import type { Chip } from '@/lib/public/suitability';
import type { PublicSuitability, SuitGroup } from '@/lib/public/suitability';
import type { PVal } from '@/lib/public/vals';

// String renderers for the hot, repeated markup of the place page: value rows, provenance panels, groups, chips and the season grid.
// A server component that returns this through dangerouslySetInnerHTML puts the markup in the RSC payload once, as one string, where
// the same elements as JSX are serialised as a tree about 1.75 times larger. On a static page that payload is inlined in the HTML, so
// this is what keeps the place pages inside their size budget (S13). Every dynamic value goes through `esc`; nothing here reads a file.

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
/** snake_case ids that reached free text ("official_highlight", "cai_scale") read as words; an id is never printed (verifier 6). */
export const humaniseTokens = (t: string): string => t.replace(/\b([a-z]{2,})(?:_([a-z]+))+\b/g, (m) => m.replace(/_/g, ' '));

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]!);

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTH[Number(m[2]) - 1]} ${m[1]}` : iso;
}

/** What a row needs to draw; a section Row and a suitability SuitRow both fit. */
export interface ShowRow {
  key: string;
  label: string;
  text: string | null;
  look: 'rule' | 'advice' | 'info' | 'sentence' | 'gap';
  gap: boolean;
  val: PVal | null;
  honesty?: string | null;
  valueType?: string;
  value?: unknown;
  links?: { ref: string; name: string }[];
  gapWording?: string;
}

export const GAP_WORDS = 'Not checked yet';

export function valueWords(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v).replace(/_/g, ' ');
  if (Array.isArray(v)) return v.map(valueWords).filter(Boolean).join(', ');
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k.replace(/_/g, ' ')} ${valueWords(x)}`)
    .join(' · ');
}

export const stubOf = (val: PVal | null): string => (val ? [val.basisLabel, val.read ? `read ${longDate(val.read)}` : null].filter(Boolean).join(' · ') : '');

/**
 * Text with its distances and heights as spans the units toggle can rewrite (km or mi, m or ft): "2.3 km" becomes
 * <data class="ukm" value="2.3">2.3 km</data> (a range keeps both ends in value). The page ships metric; `Interactions` applies the visitor's choice (M9).
 */
export function withUnits(text: string | null | undefined): string {
  const t = String(text ?? '');
  let out = '';
  let last = 0;
  for (const m of t.matchAll(UNIT_PATTERN)) {
    const at = m.index ?? 0;
    out += esc(t.slice(last, at));
    out += `<data class="u${m[3]}" value="${esc(m[1])}${m[2] ? `–${esc(m[2])}` : ''}">${esc(m[0])}</data>`;
    last = at + m[0].length;
  }
  return out + esc(t.slice(last));
}

export const gapChip = (text: string = GAP_WORDS): string => `<span class="gc">${esc(text)}</span>`;
export const closing = (text: string | null): string => (text ? `<p class="sc">${esc(text)}</p>` : '');

/** A source worth showing to a visitor: a public web page. Our own repo, a plan file or a relative path is the workshop, never a source. */
export const publicSource = (s: PVal['sources'][number]): boolean => /^https?:\/\//.test(s.url) && !/this repo|^repo$/i.test(s.publisher) && !/^trip plan$/i.test(s.title);

/** A source title as a visitor reads it: our workflow notes ("search result, not opened") never print, and OSM ids read as OpenStreetMap. */
export const sourceTitle = (t: string): string =>
  t.replace(/\s*\((?:[^()]*\b(?:search result|not opened|from memory)\b[^()]*)\)/gi, '').replace(/\bOSM (node|way|relation)\b/gi, 'OpenStreetMap $1').trim();

export type Slugs = Record<string, string>;
export const refLink = (r: { ref: string; name: string }, slugs: Slugs): string => (slugs[r.ref] ? `<a href="/places/${esc(slugs[r.ref])}/">${esc(r.name)}</a>` : esc(r.name));

function panel(val: PVal): string {
  const sources = val.sources.filter(publicSource);
  // the row above already says "basis · read date"; the panel adds only what the stub does not
  let h = `<div class="sp">${val.appliesTo ? `<p class="sp-basis">Applies to ${esc(val.appliesTo.replace(/_/g, ' '))}</p>` : ''}`;
  if (val.quote) h += `<blockquote class="sp-quote">${esc(val.quote)}</blockquote>`;
  if (sources.length) {
    h += '<ul class="sp-src" aria-label="Sources, each opens in a new tab">';
    for (const s of sources) h += `<li><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(sourceTitle(s.title))}</a> · ${esc(s.publisher)}${s.read ? ` · read ${esc(longDate(s.read))}` : ''}</li>`;
    h += '</ul>';
  }
  if (val.conflicts.length) {
    h += '<div class="sp-conf"><p><strong>Sources disagree</strong></p><ul>';
    for (const c of val.conflicts) {
      const src = c.sources.filter(publicSource)[0];
      h += `<li>${esc(valueWords(c.value))}${c.basisLabel ? ` · ${esc(c.basisLabel)}` : ''}${src ? ` · ${esc(src.publisher)}` : ''}</li>`;
    }
    h += '</ul></div>';
  }
  return `${h}</div>`;
}

function valueHtml(row: ShowRow, slugs: Slugs): string {
  if (row.links && row.links.length > 0) return row.links.map((l) => refLink(l, slugs)).join(', ');
  if (row.valueType === 'price_list' && Array.isArray(row.value) && row.value.length > 1) {
    let h = '<ul class="su-prices">';
    for (const p of row.value as Record<string, unknown>[]) {
      const who = typeof p.who === 'string' ? p.who : p.age_from !== undefined ? `Ages ${String(p.age_from)}${p.age_to !== undefined ? `–${String(p.age_to)}` : '+'}` : String(p.per ?? 'Price').replace(/_/g, ' ');
      h += `<li><span>${esc(who)}</span><strong>${Number(p.amount) === 0 ? 'free' : esc(`${String(p.currency)} ${String(p.amount)}`)}</strong></li>`;
    }
    return `${h}</ul>`;
  }
  return withUnits(row.text);
}

/** One row. A gap keeps its row and shows the dashed chip (D8); a searched-none value is a sentence (D3); a value with a source, quote or conflict is a disclosure. */
export function rowLine(row: ShowRow, slugs: Slugs, id: string = `row-${row.key}`): string {
  const a = esc(id);
  if (row.gap) return `<div class="sr" id="${a}" data-gap><span class="sl">${esc(row.label)}</span><span class="sv">${gapChip()}${row.gapWording && !row.gapWording.toLowerCase().includes(row.label.toLowerCase()) ? ` <span class="su-gapnote">${esc(row.gapWording)}</span>` : ''}</span></div>`;
  const sentence = row.look === 'sentence';
  const body = `<span class="sl">${esc(row.label)}</span><span class="sv">${valueHtml(row, slugs)}${row.honesty ? `<span class="su-honest">${esc(row.honesty)}</span>` : ''}${!sentence && row.val ? `<span class="ss">${esc(stubOf(row.val))}</span>` : ''}</span>`;
  const val = row.val;
  const adds = !!val && (!!val.quote || val.conflicts.length > 0 || val.sources.some(publicSource));
  const look = row.look === 'sentence' ? ' data-look="sentence"' : '';
  if (!val || !adds || (row.links && row.links.length > 0)) return `<div class="sr" id="${a}"${look}>${body}</div>`;
  return `<details class="sr su-prov" id="${a}"${look}><summary>${body}</summary>${panel(val)}</details>`;
}

export const rowsHtml = (rows: ShowRow[], slugs: Slugs, idOf?: (r: ShowRow) => string): string => rows.map((r) => (r.valueType === 'season_rows' && !r.gap ? seasonGrid(r) : rowLine(r, slugs, idOf?.(r)))).join('');

// ---- season grid (place-page-sections 3.8) ---------------------------------------------------------------------------------

const INITIAL = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const NAME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const START = DAYS.reduce<number[]>((a, d, i) => [...a, (a[i] ?? 0) + d], [0]);
const doy = (md: string): number => {
  const [m, d] = md.split('-').map(Number);
  return START[(m ?? 1) - 1]! + (d ?? 1);
};
/** The share of each month a from-to range covers; a range that wraps the year is two ranges. */
export function monthCover(from: string, to: string): number[] {
  const a = doy(from);
  const b = doy(to);
  const ranges: [number, number][] = a <= b ? [[a, b]] : [[a, 365], [1, b]];
  return DAYS.map((d, i) => {
    const s = START[i]! + 1;
    const e = START[i]! + d;
    let n = 0;
    for (const [x, y] of ranges) n += Math.max(0, Math.min(e, y) - Math.max(s, x) + 1);
    return n / d;
  });
}
interface SeasonLine { from: string; to: string; status?: string; via?: string }
const isLine = (x: unknown): x is SeasonLine => typeof x === 'object' && x !== null && typeof (x as SeasonLine).from === 'string' && typeof (x as SeasonLine).to === 'string';
const words = (l: SeasonLine): string => [l.via, l.status ?? 'open'].filter(Boolean).join(' ').replace(/_/g, ' ');

export function seasonGrid(row: ShowRow): string {
  const lines = Array.isArray(row.value) ? row.value.filter(isLine) : [];
  if (lines.length === 0) return '';
  let h = `<div class="ps-seasons" id="row-${esc(row.key)}"><p class="ps-grid-title">${esc(row.label)}${row.val ? `<span class="pb"> · ${esc(stubOf(row.val))}</span>` : ''}</p>`;
  for (const l of lines) {
    const cover = monthCover(l.from, l.to);
    const open = (l.status ?? 'open') === 'open';
    const label = `${words(l)}: ${cover.map((c, m) => (c > 0 ? NAME[m] : null)).filter(Boolean).join(', ')}`;
    h += `<div class="ps-grid" role="img" aria-label="${esc(label)}"><span class="ps-grid-lab">${esc(words(l))}</span><span class="ps-cells" aria-hidden="true">`;
    cover.forEach((c, m) => {
      h += `<span class="ps-cell" data-fill="${c >= 0.95 ? 'full' : c > 0 ? 'part' : 'none'}"${open ? ' data-open' : ''}>${INITIAL[m]}</span>`;
    });
    h += '</span></div>';
  }
  return `${h}</div>`;
}

// ---- chips and groups ------------------------------------------------------------------------------------------------------

const GLYPH: Record<string, string> = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13zM12 15v2',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  walker: 'M13 4.5a1.5 1.5 0 1 0 0-.01M11 8l-2 5 3 2v5M11 8l4 3 3 1M9 13l-3 3',
  gauge: 'M4 17a8 8 0 1 1 16 0M12 17l4-5M7 17h.01M17 17h.01',
  wheel: 'M11 4a1.5 1.5 0 1 0 0-.01M11 8v6h5l2.5 5M11 11h4M8.5 12.5A5 5 0 1 0 15 18.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  wave: 'M3 9c2.2 0 2.2 1.5 4.5 1.5S9.8 9 12 9s2.2 1.5 4.5 1.5S18.8 9 21 9M3 15c2.2 0 2.2 1.5 4.5 1.5S9.8 15 12 15s2.2 1.5 4.5 1.5S18.8 15 21 15',
  stroller: 'M5 5h3l1 9h9a3 3 0 0 0 3-3V8H8M9 14l-1 3M9.5 19.5a1 1 0 1 0 0-.01M17.5 19.5a1 1 0 1 0 0-.01',
  boat: 'M3 15h18l-2.5 5h-13zM12 4v11M12 5l5 8h-5',
  brake: 'M12 3 21 8v8l-9 5-9-5V8zM8.5 12h7',
  thermometer: 'M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Z',
  kit: 'M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  triangle: 'M12 3 22 21H2zM12 10v5M12 18h.01',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};
export const glyph = (name: string, size = 13): string => (GLYPH[name] ? `<svg class="gy${size === 16 ? ' gy16' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${GLYPH[name]}"/></svg>` : '');

/** A chip's text as whole segments: it breaks between "Hard", "Parks Canada Difficult" and "4 h 30–5 h 30", never inside one (S2). Non-breaking spaces, so no markup is added to the page. */
const chipText = (t: string): string => t.split(' · ').map((x) => withUnits(x.replace(/ /g, '\u00a0').replace(/(\d)–(?=\d+\u00a0?(?:h|min)\b)/g, '$1–\u2060'))).join(' · ');

export function chipsHtml(chips: readonly (Chip | null)[]): string {
  const shown = chips.filter((c): c is Chip => c !== null);
  if (!shown.length) return '';
  return `<ul class="chs" aria-label="Who it suits">${shown.map((c) => `<li class="ch" data-kind="${c.kind}"><span class="ci"${c.label === c.text ? '' : ` aria-label="${esc(c.label)}"`}>${glyph(c.glyph)}<span>${chipText(c.text)}</span>${c.extra > 0 ? `<span class="ch-more">+${c.extra}</span>` : ''}</span></li>`).join('')}</ul>`;
}

const ECHO = new Set<string>(['facilities', 'when']);
const clip = (t: string, n = 64): string => (t.length > n ? `${t.slice(0, n - 1).replace(/[\s,;:·-]+$/, '')}…` : t);

function groupHtml(g: SuitGroup, slugs: Slugs): string {
  const values = g.rows.filter((r) => !r.gap);
  if (ECHO.has(g.id)) {
    // Facilities and When you can go are sections of their own (9 and 8): here only their values, with a link, so nothing is said twice (PS1, Q31)
    // a value the source left out ("not stated") is not a value: it joins the standard gap wording instead of a half sentence ("cancelled for not stated")
    const unstated = values.filter((r) => r.val?.state === 'none_stated' || r.val?.state === 'searched_none');
    const echo = values.filter((r) => !unstated.includes(r)).map((r) => withUnits(r.short)).filter(Boolean);
    if (echo.length === 0 && unstated.length === 0) return '';
    const gapLine = unstated.length ? gapChip(`${GAP_WORDS}: ${unstated.map((r) => r.label.toLowerCase()).join(', ')}`) : '';
    return `<p class="su-echo" data-group="${g.id}"><span class="gt">${esc(g.title)}</span><span class="gs">${echo.join(' · ')}${echo.length && gapLine ? ' ' : ''}${gapLine}</span><a href="#${g.id}">See section</a></p>`;
  }
  const gaps = g.rows.filter((r) => r.gap);
  const sum = g.open ? '' : `<span class="gs">${values.map((r) => withUnits(clip(r.short))).join(' · ')}${gaps.length || g.closing ? gapChip(clip(g.closing ?? `Not checked yet: ${gaps.map((r) => r.label.toLowerCase()).join(', ')}`, 90)) : ''}</span>`;
  const rows = g.rows.map((r) => rowLine({ ...r, text: r.gap ? null : r.text, gapWording: r.gap && r.text !== GAP_WORDS ? r.text : undefined }, slugs, `su-${r.key}`)).join('');
  return `<details class="su-group" data-group="${g.id}"${g.open ? ' open' : ''}><summary><span class="gt">${esc(g.title)}</span>${sum}</summary><div class="su-gbody">${rows}${closing(g.closing)}</div></details>`;
}

/** The inside of the "Who it suits" section: head, chips, warning line and the groups. */
export function suitsInner(suit: PublicSuitability, slugs: Slugs, title: string): string {
  return `<header class="ph"><h2 id="h-suits">${esc(title)}</h2>${suit.research.text ? `<p class="ps-meta">${esc(suit.research.text)}</p>` : ''}</header>${chipsHtml([...suit.chips, ...suit.accessChips])}${suit.warning ? `<p class="su-warn">${glyph('triangle', 16)}<span>${withUnits(suit.warning)}</span></p>` : ''}${suit.groups.map((g) => groupHtml(g, slugs)).join('')}`;
}

// ---- glance and "Before you go" ---------------------------------------------------------------------------------------------

import type { PublicRelevance } from '@/lib/public/relevance';
import type { SectionModel } from '@/lib/public/sections';

export interface GlanceSlotHtml {
  row: ShowRow;
  href: string;
  /** the value as the strip shows it (a season line is one short sentence) */
  value: string;
  /** an outbound tile (a third-party link): opens in a new tab, underlined, with the outbound glyph and a note for screen readers */
  external?: { url: string; label: string };
}

export interface GlanceOptions {
  /** false drops the source line from each tile (a long strip: the row holds it one step away, P6); default true */
  source?: boolean;
  /** one line under the tiles, in place of the per-tile sources */
  readLine?: string | null;
}

export function glanceHtml(slots: GlanceSlotHtml[], level: { level: string; label: string; tooltip: string }, checks: { done: number; total: number; read: string | null }, opts: GlanceOptions = {}): string {
  const source = opts.source !== false;
  const tile = ({ row, href, value, external }: GlanceSlotHtml): string =>
    external
      ? `<li><a href="${esc(external.url)}" class="ga ga-ext" target="_blank" rel="noopener noreferrer"><span class="gl">${esc(row.label)}</span><strong class="gv"><span class="ga-u">${esc(external.label)}</span>${glyph('external')}</strong><span class="sr-only"> (opens in a new tab, third-party site)</span></a></li>`
      : `<li${row.gap ? ' data-empty' : ''}><a href="${esc(href)}" class="ga"><span class="gl">${esc(row.label)}</span>${row.gap ? gapChip() : `<strong class="gv">${withUnits(value)}</strong>`}${source && row.val ? `<span class="pb">${esc(stubOf(row.val))}</span>` : ''}${row.val && row.val.conflicts.length ? `<span class="su-honest">${row.val.conflicts.length + 1} values</span>` : ''}</a></li>`;
  const list = slots.length ? `<ul>${slots.map(tile).join('')}</ul>${opts.readLine ? `<p class="pb ps-readline">${esc(opts.readLine)}</p>` : ''}` : '';
  return `${list}<p class="ps-level"><span class="ps-complete" data-level="${esc(level.level)}" title="${esc(level.tooltip)}">${esc(level.label)}</span><span class="pb">${checks.total && !/ of \d+(?:,.*)?$/.test(level.label) ? `${checks.done} of ${checks.total} place checks done` : ''}${checks.read ? `${checks.total && !/ of \d+(?:,.*)?$/.test(level.label) ? ' · ' : ''}read ${esc(longDate(checks.read))}` : ''}</span></p>`;
}

const li = (kind: string, glyphName: string, inner: string, cls = 'ps-line'): string => `<li class="${cls}" data-kind="${esc(kind)}">${glyph(glyphName, 16)}<div>${inner}</div></li>`;
const cap1 = (t: string): string => (t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}` : t);
const kmText = (n: number): string => withUnits(`${n < 10 ? Math.round(n * 10) / 10 : Math.round(n)} km`);

/** Section 3: the Rest! lines, Plan B under the booking line (PS8), the older record's hazards and booking window, "none" lines and the closing line. */
export function warningsHtml(sec: SectionModel, rel: PublicRelevance | null, slugs: Slugs, bookingHtml: string | null, hazards: string[], suitWarning: string | null): string {
  const byKey = new Map(sec.rows.map((r) => [r.key, r]));
  // "No booking needed" is said only when the data says so (state no_limit, or searched and found none by an operator or an official source).
  // An empty list, a missing field or a deferred note is a gap, never a yes (M1).
  const says = (r: SectionModel['rows'][number]): boolean => !!r.val && (r.val.state === 'no_limit' || (r.val.state === 'searched_none' && /^(operator|official)/.test(r.val.basis ?? '')));
  const noneRows = sec.rows.filter((r) => !r.gap && says(r) && (r.key === 'access_cost' || r.key === 'closures'));
  const unknownBooking = !sec.rows.some((r) => r.key === 'access_cost' && says(r)) && sec.rows.some((r) => r.key === 'access_cost') && !sec.lines.some((l) => l.kind === 'Book' || l.kind === 'Access') && !bookingHtml;
  const haz = hazards.filter((h) => h && h !== suitWarning);
  const b = rel?.planB;
  // A hand-picked Plan B says why a person picked it and names the source; the access label is not drawn for it, so the label and the
  // reason cannot disagree. A derived one says the access of the target from its own data.
  const planB = b
    ? `<li class="ps-line rv-planb"><span class="rv-tag">Plan B</span><p class="pt">${b.risk ? `${esc(cap1(b.risk))} can fall through. ` : ''}${
        b.reason
          ? `${refLink(b, slugs)}: ${withUnits(b.reason.replace(/[.]$/, ''))}${b.effortName ? ` · ${esc(b.effortName.toLowerCase())}` : ''} · ${kmText(b.km)}.${b.source ? ` <span class="pb">Source: <a href="${esc(b.source.url)}" rel="noopener noreferrer" target="_blank">${esc(b.source.label)}</a></span>` : ''}`
          : `${refLink(b, slugs)} is the same kind of view: ${withUnits(b.access)}${b.effortName ? ` · ${esc(b.effortName.toLowerCase())}` : ''} · ${kmText(b.km)}.`
      }</p></li>`
    : '';
  // Plan B sits under the risk it answers: a booking or an access line (PS8, Q32). With no such line it is not drawn here; Similar nearby still tags it.
  const bookIdx = sec.lines.findIndex((l) => l.kind === 'Book');
  const accessIdx = sec.lines.findIndex((l) => l.kind === 'Access');
  const riskIdx = bookIdx >= 0 ? bookIdx : accessIdx;
  let out = '';
  sec.lines.forEach((l, i) => {
    const row = byKey.get(l.home);
    out += li(l.kind, 'triangle', `<p class="pt"><span class="pk">${esc(l.kind)}</span> ${withUnits(l.text)}</p>${row?.val ? `<p class="pb">${esc(stubOf(row.val))}</p>` : ''}`);
    if (i === riskIdx) out += planB;
  });
  if (bookingHtml) out += li('Book', 'triangle', `<div class="pt"><span class="pk">Book</span> ${bookingHtml}</div>`);
  for (const h of haz) out += li('Hazard', 'triangle', `<p class="pt"><span class="pk">Hazard</span> ${withUnits(h)}</p>`);
  for (const r of noneRows) out += li('', 'check', `<p class="pt">${r.key === 'access_cost' ? 'No booking or permit needed' : `${esc(r.label)}: none`}</p>${r.val ? `<p class="pb">${esc(stubOf(r.val))}</p>` : ''}`, 'ps-line ps-line-none');
  let closingText = sec.closing;
  if (unknownBooking) {
    const label = sec.rows.find((r) => r.key === 'access_cost')!.label.toLowerCase();
    const rest = (sec.closing ?? '').replace(/^Not checked yet: /, '').split(', ').filter((x) => x && x !== label);
    closingText = `Not checked yet: ${['bookings and permits', ...rest].join(', ')}`;
  }
  return `${out ? `<ul class="ps-lines">${out}</ul>` : ''}${closing(closingText)}`;
}
