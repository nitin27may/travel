// Pure ranking helpers for the spike: BM25, reciprocal rank fusion, nDCG@k and recall@k.
const STOP = new Set('a an and the of in on at to for with from near by is it i can we you my me be or as are this that up through under over about'.split(' '));

export const tokenize = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));

/** Returns score(query) -> number[] aligned with `texts`. */
export function bm25Index(texts, k1 = 1.2, b = 0.75) {
  const docs = texts.map(tokenize);
  const avg = docs.reduce((s, d) => s + d.length, 0) / docs.length;
  const df = new Map();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) ?? 0) + 1);
  const tfs = docs.map((d) => { const m = new Map(); for (const w of d) m.set(w, (m.get(w) ?? 0) + 1); return m; });
  return (query) => {
    const q = new Set(tokenize(query));
    return docs.map((d, i) => {
      let s = 0;
      for (const w of q) {
        const f = tfs[i].get(w);
        if (!f) continue;
        const n = df.get(w);
        s += Math.log(1 + (docs.length - n + 0.5) / (n + 0.5)) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avg)));
      }
      return s;
    });
  };
}

/** Reciprocal rank fusion of ranked lists of ids: score = sum 1 / (k + rank), rank from 1. Ties break on the lower id. */
export function rrf(lists, k = 60) {
  const s = new Map();
  for (const l of lists) l.forEach((id, r) => s.set(id, (s.get(id) ?? 0) + 1 / (k + r + 1)));
  return [...s].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
}

/** Graded nDCG@k: gain is the grade, discount is log2(rank + 1). `rel` maps id -> grade. */
export function ndcg(ranked, rel, k = 10) {
  const dcg = ranked.slice(0, k).reduce((s, id, r) => s + (rel[id] ?? 0) / Math.log2(r + 2), 0);
  const ideal = Object.values(rel).sort((a, b) => b - a).slice(0, k).reduce((s, g, r) => s + g / Math.log2(r + 2), 0);
  return ideal ? dcg / ideal : 0;
}

/** Share of the relevant items found in the top k, with the denominator capped at k so 20 relevant items can still score 1. */
export function recall(ranked, rel, k = 10) {
  const total = Object.keys(rel).length;
  if (!total) return 0;
  return ranked.slice(0, k).filter((id) => rel[id]).length / Math.min(total, k);
}
