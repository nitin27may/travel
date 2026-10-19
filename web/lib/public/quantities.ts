// Quantities in prose (trip-timeline spec 5.2). Pure and import-free so the page can run it in the browser: a note's
// "1.9 km" and "500 m" become tokens that <Prose> renders through the unit preference, so a note and the item line next to it
// always agree. Values are metric.

/** A run of prose: plain text, or a quantity the reader sees in their units. Values are metric. */
export type ProseRun =
  | { text: string }
  | { qty: number; to?: number; unit: 'km' | 'm' | 'C'; dim: 'distance' | 'elevation' | 'temperature'; decimals: number };

/** Cleaned text with its chips. Quantities stay in the text as the source wrote them (metric); `<Prose>` turns them into
 * runs with `quantityRuns` at render, so the page follows the unit preference and the item lines agree with the notes. */


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


/** "4-5 h" -> [240, 300]; "3-3.5 h" -> [180, 210]; "45 min" -> null (a single value is not a range). */
export function parseHoursRange(text: string | null | undefined): [number, number] | null {
  if (!text) return null;
  const m = /(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(h|hours?|min)\b/i.exec(text);
  if (!m) return null;
  const k = /^h/i.test(m[3]!) ? 60 : 1;
  return [Math.round(Number(m[1]) * k), Math.round(Number(m[2]) * k)];
}
