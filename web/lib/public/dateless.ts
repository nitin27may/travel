import { sunFor } from '@travel/core/sun/index.ts';
import { publicOrigin } from './origin';

// Public trips are dateless templates (docs/v2/design/public-trips-dateless.md): Day 1 to Day N, a length, a season.
// Text that carries a calendar date is dropped from the public view and listed in the report for a person to rewrite.

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const WEEKDAY = '(?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)(?:day|sday|nesday|rsday|urday)?';
/** ISO date, "15 Jun", "10-12 Oct", "Jun 15", "February 2027", "Tue 15". A year on its own ("2026 price") is fine. */
export const DATE_TEXT = new RegExp(
  `\\d{4}-\\d{2}-\\d{2}|\\b\\d{1,2}(?:st|nd|rd|th)?\\s*(?:[-–]\\s*\\d{1,2}\\s*)?${MONTH}\\b|\\b${MONTH}\\.?\\s+\\d{1,2}\\b|\\b${MONTH}\\s+\\d{4}\\b|\\b${WEEKDAY}\\.?,?\\s+\\d{1,2}\\b`,
  'i',
);

export interface DroppedText {
  where: string;
  text: string;
  why: string;
}

/** Collects what was dropped while building, so the snapshot report can list it. */
export class DropLog {
  readonly items: DroppedText[] = [];
  add(where: string, text: string, why: string): void {
    if (!this.items.some((i) => i.where === where && i.text === text)) this.items.push({ where, text, why });
  }
}

export const isDated = (text: string): boolean => DATE_TEXT.test(text);

/** The text, or null (and a log entry) when it carries a calendar date. */
export function undated(text: string | null | undefined, where: string, log: DropLog): string | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  if (isDated(t)) {
    log.add(where, t, 'carries a calendar date; rewrite it relative to a day or a season');
    return null;
  }
  return t;
}

/**
 * Household capture notes that never go public: which trip a place was planned as, the hotel or stay the household has in
 * mind, and a street address. The sentence is dropped whole.
 */
export const HOUSEHOLD_TEXT = new RegExp(
  [
    String.raw`\bplanned as\b`,
    String.raw`\b(?:hotel|stay|lodging|airbnb|accommodation|campsite|hut)\s+(?:idea|ideas|choice|pick|booked)\b`,
    String.raw`\bbase camp:`,
    String.raw`\b\d{2,5}\s+[A-Z][\w'. -]{2,30}\s(?:Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Ln|Lane|Blvd|Way)\b`,
  ].join('|'),
  'i',
);
const URL_TEXT = /\s*\bhttps?:\/\/[^\s)]*[^\s).,;]/gi;

/**
 * The one scrubber every public text path goes through. Splits into sentences (never inside a URL or a number such as
 * "3.2 km"), drops household sentences and dated sentences (logging each), and strips bare URLs.
 */
export function undatedSentences(text: string | null | undefined, where: string, log: DropLog): string {
  const t = (text ?? '').trim();
  if (!t) return '';
  // a full stop inside a number, a name or a URL is not a sentence end: only split where whitespace or the end follows
  const parts = t.match(/(?:[^.!?]|[.!?](?![\s]|$))+[.!?]*\s*/g) ?? [t];
  const kept: string[] = [];
  for (const p of parts) {
    if (HOUSEHOLD_TEXT.test(p)) {
      log.add(where, p.trim(), 'household capture note (plan link, stay idea or address); never published');
      continue;
    }
    const noUrl = p.replace(URL_TEXT, '').replace(/\b[A-Z][a-z]+:\s*$/, '').trim();
    if (noUrl !== p.trim() && !/[a-z]{3}/i.test(noUrl.replace(/\b[A-Z][a-z]+:/, ''))) continue; // nothing left but a label
    if (isDated(noUrl)) log.add(where, p.trim(), 'carries a calendar date; rewrite it relative to a day or a season');
    else if (noUrl) kept.push(noUrl);
  }
  return publicOrigin(kept.join(' '));
}

/** A trip title without calendar dates: "Muskoka and Algonquin, 10–12 October 2026" becomes "Muskoka and Algonquin". */
export function undatedTitle(title: string): string {
  const MON = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const date = `(?:\\d{1,2}\\s*[-–]\\s*)?(?:\\d{1,2}\\s+)?${MON}(?:\\s*[-–]\\s*${MON})?(?:\\s+\\d{1,2})?(?:,?\\s+(?:19|20)\\d\\d)?`;
  return publicOrigin(title)
    .replace(new RegExp(`\\s*[,:·(-]?\\s*${date}\\)?\\s*$`, 'i'), '')
    .replace(new RegExp(`\\s*[,:·]\\s*${date}(?=\\s*[,:·])`, 'ig'), '')
    .replace(/\s+(?:19|20)\d\d\s*$/, '')
    .replace(/[\s,:·-]+$/, '')
    .trim();
}

/** Scrubs a note for a public data file or a list row, with no build log. */
export const publicSentences = (text: string | null | undefined): string => undatedSentences(text, 'public text', new DropLog());

const round5 = (min: number) => Math.round(min / 5) * 5;
const clock = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Sunrise and sunset ranges across the first and last day of each season month, rounded to 5 minutes. */
export function sunRange(lat: number, lon: number, zone: string, months: number[]): { sunrise: [string, string]; sunset: [string, string] } | null {
  const rises: number[] = [];
  const sets: number[] = [];
  for (const m of months) {
    for (const d of ['01', '28']) {
      const t = sunFor(lat, lon, `2027-${String(m).padStart(2, '0')}-${d}`, zone);
      if (!t) return null;
      rises.push(toMin(t.sunrise));
      sets.push(toMin(t.sunset));
    }
  }
  const r = (xs: number[]): [string, string] => [clock(round5(Math.min(...xs))), clock(round5(Math.max(...xs)))];
  return { sunrise: r(rises), sunset: r(sets) };
}

/** "Sunrise 05:32" -> "Sunrise about 05:15 to 05:55 in this window", computed with core/src/sun for the season range. */
export function relativeSun(note: string, range: ReturnType<typeof sunRange>): string {
  if (!range) return note;
  return note.replace(/\b(Sunrise|Sunset)\s+\d{1,2}:\d{2}/gi, (_m, w: string) => {
    const [a, b] = w.toLowerCase() === 'sunrise' ? range.sunrise : range.sunset;
    return `${w} about ${a} to ${b} in this window`;
  });
}
