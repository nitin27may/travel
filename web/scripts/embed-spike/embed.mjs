// Embeds the public place cards with gte-small q8 in Node, writes int8 shards and the timings.
//   node embed.mjs            first run: downloads the pinned model once into .cache/models
//   node embed.mjs --offline  later runs: no network at all (env.allowRemoteModels = false)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { env, pipeline } from '@huggingface/transformers';
import { CACHE, MODEL, cardText } from './common.mjs';

const offline = process.argv.includes('--offline');
env.cacheDir = path.join(CACHE, 'models');
// Offline: read the pinned snapshot the first run cached, from disk only; the network is switched off in the library.
const snapshot = path.join(CACHE, 'models', MODEL.id, MODEL.revision);
if (offline) {
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = path.dirname(snapshot) + path.sep;
}

const places = JSON.parse(readFileSync(path.join(CACHE, 'places.json'), 'utf8'));
const labels = JSON.parse(readFileSync(path.join(import.meta.dirname, 'labels.json'), 'utf8')).queries;

const t0 = performance.now();
const extractor = await pipeline('feature-extraction', offline ? MODEL.revision : MODEL.id, { dtype: MODEL.dtype, revision: offline ? 'main' : MODEL.revision });
const loadMs = performance.now() - t0;

const embed = async (texts, batch = 16) => {
  const out = [];
  for (let i = 0; i < texts.length; i += batch) {
    const t = await extractor(texts.slice(i, i + batch), { pooling: MODEL.pooling, normalize: MODEL.normalize });
    const [n, d] = t.dims;
    for (let r = 0; r < n; r++) out.push(Array.from(t.data.slice(r * d, (r + 1) * d)));
  }
  return out;
};

const texts = places.map(cardText);
const t1 = performance.now();
const vecs = await embed(texts);
const catalogueMs = performance.now() - t1;

// one query at a time, as the browser does it
const qvecs = [];
const qms = [];
for (const l of labels) {
  const s = performance.now();
  qvecs.push((await embed([l.query], 1))[0]);
  qms.push(performance.now() - s);
}

// int8 shards by country, ids only: header (JSON) + per row a uint16 row index and 384 int8 values
const q8 = (v) => Int8Array.from(v, (x) => Math.max(-127, Math.min(127, Math.round(x * 127))));
const byCountry = new Map();
places.forEach((p, i) => {
  const c = p.cc || 'xx';
  if (!byCountry.has(c)) byCountry.set(c, []);
  byCountry.get(c).push(i);
});
mkdirSync(path.join(CACHE, 'shards'), { recursive: true });
const shards = [];
for (const [cc, idxs] of [...byCountry].sort()) {
  const header = Buffer.from(JSON.stringify({ model: MODEL.id, revision: MODEL.revision, dims: MODEL.dims, quant: 'int8', count: idxs.length }) + '\n');
  const rows = Buffer.alloc(idxs.length * (2 + MODEL.dims));
  idxs.forEach((pi, n) => {
    rows.writeUInt16LE(n, n * (2 + MODEL.dims));
    Buffer.from(q8(vecs[pi]).buffer).copy(rows, n * (2 + MODEL.dims) + 2);
  });
  const raw = Buffer.concat([header, rows]);
  writeFileSync(path.join(CACHE, 'shards', `place-${cc}.bin`), raw);
  shards.push({ shard: `place-${cc}`, count: idxs.length, raw: raw.length, gzip: gzipSync(raw, { level: 9 }).length });
}

// int8 quantisation loss: rank agreement against float
let worst = 1;
for (let i = 0; i < Math.min(50, vecs.length); i++) {
  const a = q8(vecs[i]);
  const na = Math.hypot(...a), dot = a.reduce((s, x, k) => s + x * vecs[i][k], 0);
  worst = Math.min(worst, dot / na);
}

const onnx = path.join(CACHE, 'models', MODEL.id, MODEL.revision, MODEL.file);
const found = existsSync(onnx) ? onnx : null;
const sha = found ? createHash('sha256').update(readFileSync(found)).digest('hex') : null;

writeFileSync(path.join(CACHE, 'vectors.json'), JSON.stringify({ slugs: places.map((p) => p.slug), vecs: vecs.map((v) => v.map((x) => +x.toFixed(6))), qvecs }));
const report = {
  model: MODEL, offline, texts: texts.length, loadMs, catalogueMs, perPlaceMs: catalogueMs / texts.length,
  queryMs: { min: Math.min(...qms), median: [...qms].sort((a, b) => a - b)[Math.floor(qms.length / 2)], max: Math.max(...qms) },
  shards, shardTotals: { raw: shards.reduce((s, x) => s + x.raw, 0), gzip: shards.reduce((s, x) => s + x.gzip, 0) },
  int8CosineWorst50: worst, onnxPath: found, onnxSha256: sha, shaMatchesPin: sha === MODEL.sha256,
  node: process.version, transformersJs: JSON.parse(readFileSync(path.join(import.meta.dirname, 'node_modules/@huggingface/transformers/package.json'), 'utf8')).version,
};
writeFileSync(path.join(CACHE, 'embed-report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
