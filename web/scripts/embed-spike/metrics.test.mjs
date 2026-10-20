// node --test scripts/embed-spike/metrics.test.mjs   (from web/; deliberately outside the web test suite and check-all)
import test from 'node:test';
import assert from 'node:assert/strict';
import { bm25Index, ndcg, recall, rrf, tokenize } from './metrics.mjs';

test('tokenize drops stop words, accents and simple plurals', () => {
  assert.deepEqual(tokenize('Waterfalls in the Dolomités'), ['waterfall', 'dolomite']);
});

test('bm25 scores a matching document above a non-matching one, and 0 for no overlap', () => {
  const score = bm25Index(['Lake Louise. Lake in Banff', 'Johnston Canyon. Canyon in Banff', 'Skogafoss. Waterfall in Iceland']);
  const s = score('lake');
  assert.ok(s[0] > 0);
  assert.equal(s[1], 0);
  assert.equal(s[2], 0);
});

test('rrf puts an item both lists rank first ahead of items one list ranks first', () => {
  assert.deepEqual(rrf([['a', 'b', 'c'], ['b', 'a', 'd']]).slice(0, 2), ['a', 'b']);
  assert.deepEqual(rrf([['x', 'y'], ['y', 'z']])[0], 'y');
});

test('ndcg is 1 for the ideal order and drops when the best item is lower', () => {
  const rel = { a: 2, b: 1 };
  assert.equal(ndcg(['a', 'b'], rel), 1);
  assert.ok(ndcg(['x', 'a', 'b'], rel) < 1);
  assert.equal(ndcg(['x', 'y'], rel), 0);
  assert.equal(ndcg(['a'], {}), 0);
});

test('recall caps the denominator at k', () => {
  const rel = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`p${i}`, 1]));
  assert.equal(recall(Array.from({ length: 10 }, (_, i) => `p${i}`), rel), 1);
  assert.equal(recall(['p0', 'x'], { p0: 1, p1: 1 }), 0.5);
});
