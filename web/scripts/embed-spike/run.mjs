// Scores the rankings on the labelled queries. Needs .cache/places.json, .cache/parser.json (dump.spike.mjs) and
// .cache/vectors.json (embed.mjs). Writes results.json (committed) and prints the Markdown tables for the report.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CACHE, HERE, cardText } from './common.mjs';
import { bm25Index, ndcg, recall, rrf } from './metrics.mjs';

const places = JSON.parse(readFileSync(path.join(CACHE, 'places.json'), 'utf8'));
const parser = JSON.parse(readFileSync(path.join(CACHE, 'parser.json'), 'utf8'));
const { slugs, vecs, qvecs } = JSON.parse(readFileSync(path.join(CACHE, 'vectors.json'), 'utf8'));
const labels = JSON.parse(readFileSync(path.join(HERE, 'labels.json'), 'utf8')).queries;
const ix = new Map(slugs.map((s, i) => [s, i]));

const score = bm25Index(places.map(cardText));
const bm25 = (query) => score(query);
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

// ---- rankers return slugs, best first
const rankBy = (scores, pool, minScore = -Infinity) => pool.filter((i) => scores[i] > minScore).sort((a, b) => scores[b] - scores[a] || a - b);
const all = places.map((_, i) => i);
const toIdx = (l) => l.map((s) => ix.get(s)).filter((i) => i !== undefined);

const METHODS = ['a', 'af', 'b', 'c', 'd', 'dsoft', 'e'];
const NAMES = { a: 'parser alone (list)', af: 'parser filters only',  b: 'full text (BM25)', c: 'vectors', d: 'hybrid RRF, hard filters', dsoft: 'hybrid RRF, where/what pool', e: 'hybrid RRF, no filters' };
const rows = [];
for (const [n, l] of labels.entries()) {
  const P = parser[l.id];
  const text = bm25(l.query);
  const sim = vecs.map((v) => dot(v, qvecs[n]));
  const hybrid = (pool) => rrf([rankBy(text, pool, 0), rankBy(sim, pool)]).map((i) => slugs[i]);
  const hard = toIdx(P.pool);
  const soft = toIdx(P.softPool);
  const out = {
    a: P.listOrder,
    af: P.filterOrder,
    b: rankBy(text, all, 0).map((i) => slugs[i]),
    c: rankBy(sim, all).map((i) => slugs[i]),
    d: hybrid(hard),
    dsoft: hybrid(soft.length ? soft : all),
    e: hybrid(all),
  };
  const row = { id: l.id, specId: l.specId, query: l.query, relevant: Object.keys(l.relevant).length, leftover: P.leftoverQ.trim(), poolHard: hard.length, poolSoft: soft.length, chips: P.chips, notYet: P.notYet };
  for (const m of METHODS) {
    row[`ndcg_${m}`] = ndcg(out[m], l.relevant);
    row[`recall_${m}`] = recall(out[m], l.relevant);
  }
  row.top3_dsoft = out.dsoft.slice(0, 3);
  row.top3_c = out.c.slice(0, 3);
  row.top3_b = out.b.slice(0, 3);
  rows.push(row);
}
const mean = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : NaN);
const groups = { all: rows, withWords: rows.filter((r) => r.leftover), parsedFully: rows.filter((r) => !r.leftover) };
const totals = {};
for (const [g, rs] of Object.entries(groups)) {
  totals[g] = { n: rs.length };
  for (const m of METHODS) { totals[g][`ndcg_${m}`] = mean(rs, (r) => r[`ndcg_${m}`]); totals[g][`recall_${m}`] = mean(rs, (r) => r[`recall_${m}`]); }
}


// paired bootstrap on the per-query nDCG@10 difference (seeded, 5000 resamples)
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const boot = (rs, x, y) => {
  if (!rs.length) return null;
  const diffs = rs.map((r) => r[`ndcg_${x}`] - r[`ndcg_${y}`]);
  const means = [];
  for (let i = 0; i < 5000; i++) { let s = 0; for (let k = 0; k < diffs.length; k++) s += diffs[rnd() * diffs.length | 0]; means.push(s / diffs.length); }
  means.sort((p, q) => p - q);
  return { diff: mean(diffs, (d) => d), lo: means[Math.floor(0.025 * means.length)], hi: means[Math.floor(0.975 * means.length)] };
};
const PAIRS = [['d', 'a'], ['d', 'af'], ['dsoft', 'af'], ['e', 'b'], ['c', 'b'], ['e', 'c'], ['dsoft', 'b']];
const paired = {};
for (const [g, rs] of Object.entries(groups)) for (const [x, y] of PAIRS) (paired[g] ??= {})[`${x}-${y}`] = boot(rs, x, y);
writeFileSync(path.join(HERE, 'results.json'), JSON.stringify({ methods: NAMES, rrfK: 60, bm25: { k1: 1.2, b: 0.75 }, totals, paired, rows }, null, 1));
const f = (x) => (Number.isNaN(x) ? 'n/a' : x.toFixed(3));
console.log('| Group | n | ' + METHODS.map((m) => `${NAMES[m]}`).join(' | ') + ' |');
console.log('|---|---|' + METHODS.map(() => '---').join('|') + '|');
for (const [g, t] of Object.entries(totals)) {
  console.log(`| nDCG@10, ${g} | ${t.n} | ` + METHODS.map((m) => f(t[`ndcg_${m}`])).join(' | ') + ' |');
  console.log(`| recall@10, ${g} | ${t.n} | ` + METHODS.map((m) => f(t[`recall_${m}`])).join(' | ') + ' |');
}
console.log('\nPER QUERY (nDCG@10 / recall@10)\n');
console.log('| # | Query | Rel | Left over | ' + METHODS.join(' | ') + ' |');
console.log('|---|---|---|---|' + METHODS.map(() => '---').join('|') + '|');
for (const r of rows) console.log(`| ${r.id} | ${r.query} | ${r.relevant} | ${r.leftover || '-'} | ` + METHODS.map((m) => `${r[`ndcg_${m}`].toFixed(2)} / ${r[`recall_${m}`].toFixed(2)}`).join(' | ') + ' |');

console.log('\nPAIRED nDCG@10 DIFFERENCE (mean, 95% bootstrap interval)\n');
for (const [g, ps] of Object.entries(paired)) for (const [k, v] of Object.entries(ps)) if (v) console.log(`${g} ${k}: ${v.diff.toFixed(3)} [${v.lo.toFixed(3)}, ${v.hi.toFixed(3)}]`);
