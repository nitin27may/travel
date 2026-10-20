// The full-text pass (backlog 3.60, the SQ2s recommendation). When the parser leaves words over, the list used to look for them as a
// substring of the place's name, area and tags and show nothing when none matched. This ranks the places by BM25 over the text a place
// card already shows (name, kind, area chain, the one-line summary, tag labels) and offers those instead of an empty list.
//
// P8: the index is scoped files, one per list row file (a country, or 300 rows of a large one), never one catalogue file; it holds
// stemmed terms with counts, not the sentences. P9: `searchTexts` is the shape of a server call, and a server step replaces the files.
import { normalize } from './normalize';

/** One file of the full-text index: the places of one list row file. Terms are a list of pairs, so a word is data and never an object key. */
export interface TextIndex {
  v: 1;
  /** Place slugs, in the order the postings count them. */
  ids: string[];
  /** Tokens in each place's text. */
  len: number[];
  /** Term and its postings, flat: place index, count, place index, count ... */
  terms: [term: string, postings: number[]][];
}

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'is', 'are', 'it', 'its', 'this', 'that', 'as', 'be', 'near', 'into', 'than', 'up', 'out',
]);

/** Light stemming: a plural and an -ing ending. The same function runs on the text and on the query, so a false merge is harmless. */
export function stem(w: string): string {
  if (w.length > 6 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

/** The terms of a text: normalised, split on anything that is not a letter or digit, stop words dropped, stemmed. */
export function terms(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

/** The text of a place card that the index covers. Only what a card shows. */
export function cardText(p: { name: string; kindLabel: string; areaChain: { name: string }[]; summary: string; tags: string[] }): string {
  return [p.name, p.kindLabel, ...p.areaChain.map((a) => a.name), p.summary, ...p.tags].filter(Boolean).join(' ');
}

export function buildTextIndex(docs: readonly { id: string; text: string }[]): TextIndex {
  const post = new Map<string, number[]>();
  const len: number[] = [];
  docs.forEach((doc, i) => {
    const tf = new Map<string, number>();
    const ts = terms(doc.text);
    len.push(ts.length);
    for (const t of ts) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      const list = post.get(t);
      if (list) list.push(i, n);
      else post.set(t, [i, n]);
    }
  });
  return { v: 1, ids: docs.map((d) => d.id), len, terms: [...post].sort((a, b) => (a[0] < b[0] ? -1 : 1)) };
}

const K1 = 1.2;
const B = 0.75;

export interface TextHit {
  id: string;
  score: number;
}

/**
 * BM25 over one or more index files as if they were one (document counts and lengths are summed, so a place scores the same however
 * the catalogue is split). A place must hold at least half of the query's distinct terms, so one common word does not list the catalogue.
 * Best first; ties by id so the order is stable.
 */
export function searchTexts(indexes: readonly TextIndex[], query: string, limit = 200): TextHit[] {
  const q = [...new Set(terms(query))];
  if (!q.length) return [];
  let n = 0;
  let total = 0;
  for (const ix of indexes) {
    n += ix.ids.length;
    for (const l of ix.len) total += l;
  }
  if (!n) return [];
  const avg = total / n || 1;
  const maps = indexes.map((ix) => new Map(ix.terms));
  const df = new Map<string, number>();
  for (const t of q) df.set(t, maps.reduce((a, m) => a + (m.get(t)?.length ?? 0) / 2, 0));
  const out: TextHit[] = [];
  indexes.forEach((ix, k) => {
    const score = new Map<number, number>();
    const matched = new Map<number, number>();
    for (const t of q) {
      const list = maps[k]!.get(t);
      const d = df.get(t) ?? 0;
      if (!list || !d) continue;
      const idf = Math.log(1 + (n - d + 0.5) / (d + 0.5));
      for (let i = 0; i < list.length; i += 2) {
        const doc = list[i]!;
        const tf = list[i + 1]!;
        const s = (idf * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * (ix.len[doc] ?? avg)) / avg));
        score.set(doc, (score.get(doc) ?? 0) + s);
        matched.set(doc, (matched.get(doc) ?? 0) + 1);
      }
    }
    const need = Math.ceil(q.length / 2);
    for (const [doc, s] of score) if ((matched.get(doc) ?? 0) >= need) out.push({ id: ix.ids[doc]!, score: s });
  });
  return out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1)).slice(0, limit);
}
