// The place page's "known vs blank" model for UXB-7 (trip-and-places-ux-fixes.md 8.3 to 8.5, W10; Q300). Pure over the page model
// that buildSections already returns: it changes no field of it (the place HTML budget has 113 B of headroom), it reads it.
//
// The hide-empty rule (8.4):
//  - a non-safety gap is never a row: its name goes to one "Not checked yet" block, one line per section;
//  - a safety gap keeps its own row where the decision is made (P2 exception);
//  - a section with no value and no safety gap is not drawn, and leaves the section index;
//  - a link kind with no link is not a tab: the block says "Links: official, booking, conditions";
//  - "At this place / On this route / With this you can also" is not drawn until a value exists, and is not a research gap;
//  - a basics-only page (the level word "Basics only") gets the compact template.
//
// "Safety" is the registry's own mark: a property whose display levels include `rest!` (core/src/schema/capture/properties.ts:
// "the safety tier a page keeps at rest, P2"). Today that is the limits (age, height, weight, adult required, group minimum),
// closures, permits and booking windows, exposure, hazards, access season, life jackets, last rides and the wildlife rules.
// Tides and river crossings are not marked `rest!` yet: a request for the field-audit owner, not a list kept here.
import { PROPERTIES, PROPERTY_BY_KEY, SUITABILITY_PROPERTIES } from '@travel/core/schema/capture/properties.ts';
import { labelOf } from './suitability';
import { closingWord, type PageModel, type Row, type SectionModel } from './sections';
import { LEVEL_WORDS } from './levelWord';
import { WORDS } from './vals';
import type { SectionId } from './contract';

/** True when the registry keeps the property at rest as safety (P2): its gap stays a visible row. */
export function isSafetyProperty(key: string): boolean {
  return PROPERTY_BY_KEY.get(key)?.display.includes('rest!') ?? false;
}

/**
 * Word -> key, to read the closing line's names back (the model keeps the missing optional properties only as words). Two wordings
 * reach a closing line: the registry label through `closingWord` (capture properties) and the suitability block's own label in
 * lower case (`labelOf`: "stay in vehicle", "pass"). The registry's wins when both exist.
 */
const KEY_OF_WORD = new Map<string, string>([
  ...SUITABILITY_PROPERTIES.map((p) => [labelOf(p.key).toLowerCase(), p.key] as const),
  ...PROPERTIES.map((p) => [closingWord(p.label), p.key] as const),
]);
/** The longest label in words, in comma-separated pieces ("Nearby, worth adding" is two). */
const MAX_PIECES = Math.max(...[...KEY_OF_WORD.keys()].map((w) => w.split(', ').length));

/** The names in a closing line ("Not checked yet: toilets, drinking water"), each with its registry key when one has that label. */
export function closingNames(closing: string | null): { word: string; key: string | null }[] {
  if (!closing) return [];
  const rest = closing.startsWith(WORDS.closingPrefix) ? closing.slice(WORDS.closingPrefix.length) : closing;
  const parts = rest.split(', ').map((x) => x.trim()).filter(Boolean);
  const out: { word: string; key: string | null }[] = [];
  for (let i = 0; i < parts.length; ) {
    let took = 1;
    let key: string | null = null;
    for (let n = Math.min(MAX_PIECES, parts.length - i); n >= 1; n--) {
      const word = parts.slice(i, i + n).join(', ');
      const k = KEY_OF_WORD.get(word);
      if (k) {
        took = n;
        key = k;
        break;
      }
    }
    out.push({ word: parts.slice(i, i + took).join(', '), key });
    i += took;
  }
  return out;
}

export interface SafetyGap {
  key: string;
  label: string;
  /** The registry's honest-gap wording: "Minimum age: not checked yet" is drawn from it. */
  gapWording: string;
}

export interface KnownSection {
  id: SectionId;
  title: string;
  /** Rows with a value (a value, a "not stated" source line): the only rows drawn. */
  rows: Row[];
  /** Safety properties with no value: drawn as rows, never folded into the block. */
  safetyGaps: SafetyGap[];
}

export interface GapLine {
  id: SectionId | 'links';
  title: string;
  /** Names in words, in the section's order: "best weeks, best time of day". */
  items: string[];
}

export interface PlaceKnown {
  template: 'full' | 'basics';
  /** Sections to draw, in the model's order. Cover, glance, photos, sources and the delegated sections are not judged here. */
  known: KnownSection[];
  /** Sections drawn by their own block (Who it suits: publicSuitability; Nearby: relevance): the caller judges their values. */
  delegated: SectionId[];
  /** The "Not checked yet" block: one line per section with non-safety gaps, then Links. */
  gaps: GapLine[];
  /** The basics template's one line: the safety gaps first, then the required gaps, then the rest (8.4, W10 Akureyri). */
  notResearched: string[];
  counts: { values: number; safetyGaps: number; gapItems: number; sectionsDrawn: number; sectionsHidden: number };
}

/** Sections this model never draws or hides: the identity band, the glance (echoes of home rows), photos (a header line) and the sources drawer. */
const NOT_JUDGED: ReadonlySet<SectionId> = new Set(['cover', 'glance', 'photos', 'sources'] as SectionId[]);

const uniq = (xs: string[]): string[] => [...new Set(xs)];

function judge(s: SectionModel): { known: KnownSection | null; gapWords: string[]; safety: SafetyGap[]; requiredWords: string[] } {
  const rows = s.rows.filter((r) => !r.gap && !r.echo);
  const safety: SafetyGap[] = [];
  const gapWords: string[] = [];
  const requiredWords: string[] = [];
  for (const r of s.rows) {
    if (!r.gap || r.echo) continue;
    if (isSafetyProperty(r.key)) safety.push({ key: r.key, label: r.label, gapWording: r.gapWording });
    else {
      gapWords.push(closingWord(r.label));
      if (r.mark === 'R') requiredWords.push(closingWord(r.label));
    }
  }
  for (const n of closingNames(s.closing)) {
    if (n.key && isSafetyProperty(n.key)) {
      if (!safety.some((x) => x.key === n.key)) {
        const def = PROPERTY_BY_KEY.get(n.key)!;
        safety.push({ key: n.key, label: def.label, gapWording: def.gap });
      }
    } else gapWords.push(n.word);
  }
  const drawn = rows.length > 0 || safety.length > 0;
  return { known: drawn ? { id: s.id, title: s.title, rows, safetyGaps: safety } : null, gapWords: uniq(gapWords.filter((w) => !safety.some((x) => closingWord(x.label) === w))), safety, requiredWords };
}

/**
 * Groups a place page model into the sections to draw and one gap list. `levelWord` is the completeness label the page shows
 * ("Basics only", "Early research · 30 of 32"): "Basics only" selects the compact template.
 */
export function placeKnown(model: PageModel, levelWord: string): PlaceKnown {
  const known: KnownSection[] = [];
  const delegated: SectionId[] = [];
  const gaps: GapLine[] = [];
  const safetyAll: SafetyGap[] = [];
  const required: string[] = [];
  let hidden = 0;
  for (const s of model.sections) {
    if (!s.drawn || NOT_JUDGED.has(s.id)) continue;
    if (s.delegate) {
      delegated.push(s.id);
      continue;
    }
    if (s.id === 'links') continue;
    if (s.id === 'around') {
      // drawn only with an offer; never a research gap of the place
      if (model.around.length) known.push({ id: s.id, title: s.title, rows: [], safetyGaps: [] });
      else hidden += 1;
      continue;
    }
    const j = judge(s);
    if (j.known) known.push(j.known);
    else hidden += 1;
    if (j.gapWords.length) gaps.push({ id: s.id, title: s.title, items: j.gapWords });
    safetyAll.push(...j.safety);
    required.push(...j.requiredWords);
  }
  const filledLinks = model.links.filter((l) => l.state === 'filled' || l.state === 'found_in_search');
  const missingLinks = model.links.filter((l) => l.state === 'not_checked').map((l) => l.kind.replace(/_/g, ' '));
  if (filledLinks.length) known.push({ id: 'links', title: model.sections.find((s) => s.id === 'links')?.title ?? 'Links', rows: [], safetyGaps: [] });
  if (missingLinks.length) gaps.push({ id: 'links', title: model.sections.find((s) => s.id === 'links')?.title ?? 'Links', items: missingLinks });

  const gapItems = gaps.reduce((n, g) => n + g.items.length, 0);
  const others = gaps.flatMap((g) => g.items).filter((w) => !required.includes(w));
  return {
    template: levelWord.startsWith(LEVEL_WORDS.basics) ? 'basics' : 'full',
    known,
    delegated,
    gaps,
    notResearched: uniq([...safetyAll.map((x) => closingWord(x.label)), ...required, ...others]),
    counts: { values: known.reduce((n, k) => n + k.rows.length, 0), safetyGaps: safetyAll.length, gapItems, sectionsDrawn: known.length, sectionsHidden: hidden },
  };
}
