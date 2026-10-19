// Wikidata P18 images and their Commons credits for the globe's place cards (owner feedback F6, spec 4.3 and 11).
//
//   node scripts/globe-images.mjs
//
// The card's image comes from a fallback chain: the place's own credited photo, a gallery photo of a public trip, then the image
// Wikidata names for the place (P18) with its Commons credit. This script fills the third step: for every place in the store that
// has a Wikidata id it reads P18, then asks Commons for the author and licence of each file. The answer is committed in
// data/reference/globe/p18.json, so the build never calls Wikidata or Commons.
//
// Rules: Wikidata by QID only, one request a second. Commons in batches of 50 titles, sequential, two seconds apart, backing off
// on 429 and stopping after the second. User-Agent without an email. Commons is one runner for the whole machine: the run holds
// /tmp/travel-commons.lock and gives up, rather than waits, when another job (the capture crawler) holds it.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'data', 'reference', 'globe', 'p18.json');
const UA = 'travel-relevance-signals/1.0 (+https://nks-travel.pages.dev/about/)';
const LOCK = '/tmp/travel-commons.lock';

if (!process.env.GLOBE_IMAGES_LOCKED) {
  const r = spawnSync('flock', ['-n', LOCK, process.execPath, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, GLOBE_IMAGES_LOCKED: '1' } });
  if (r.status === 1 && !r.signal) console.log('another Commons job holds /tmp/travel-commons.lock (or this run failed): nothing was started');
  process.exit(r.status ?? 1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
let tooMany = 0;
let wikidataCalls = 0;
let commonsCalls = 0;
async function get(url, gap) {
  const wait = last + gap - Date.now();
  if (wait > 0) await sleep(wait);
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  last = Date.now();
  if (res.status === 429) {
    if (++tooMany >= 2) throw new Error('429 twice: stopping, the cache so far is kept');
    console.log('429: waiting 90 s');
    await sleep(90_000);
    return get(url, gap);
  }
  if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 100)}`);
  return res.json();
}

const store = JSON.parse(readFileSync(path.join(ROOT, 'data', 'locations', 'locations.json'), 'utf8'));
const qids = [...new Set(store.places.map((p) => p.wikidata).filter((q) => /^Q\d+$/.test(q ?? '')))].sort();
const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
mkdirSync(path.dirname(OUT), { recursive: true });
const save = () => writeFileSync(OUT, `${JSON.stringify(Object.fromEntries(Object.entries(cache).sort()), null, 1)}\n`);

// 1. P18 per QID (skipping those already answered)
const todo = qids.filter((q) => !cache[q]);
console.log(`${qids.length} places with a Wikidata id, ${todo.length} to look up`);
for (const [i, q] of todo.entries()) {
  const j = await get(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${q}&property=P18&format=json`, 1000);
  wikidataCalls += 1;
  const v = j.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  cache[q] = typeof v === 'string' ? { file: v.replace(/_/g, ' ') } : { none: true };
  if (i % 10 === 9) { save(); console.log(`  wikidata ${i + 1}/${todo.length}`); }
}
save();

// 2. credits for every file that has none yet, 50 titles a request
const need = Object.entries(cache).filter(([, r]) => r.file && !r.author).map(([q, r]) => [q, r.file]);
for (let i = 0; i < need.length; i += 50) {
  const batch = need.slice(i, i + 50);
  const titles = batch.map(([, f]) => `File:${f}`).join('|');
  const j = await get(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=extmetadata&format=json&formatversion=2`, 2000);
  commonsCalls += 1;
  const byTitle = new Map((j.query?.pages ?? []).map((p) => [p.title, p.imageinfo?.[0]?.extmetadata]));
  for (const [q, file] of batch) {
    const m = byTitle.get(`File:${file}`) ?? byTitle.get(`File:${file.replace(/_/g, ' ')}`);
    const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const author = strip(m?.Artist?.value);
    const licence = strip(m?.LicenseShortName?.value);
    // a photo without an author and a licence is not shown (spec 4.3), so it is recorded as none
    if (!author || !licence) { cache[q] = { none: true, file }; continue; }
    cache[q] = { file, author, licence, licenceUrl: strip(m?.LicenseUrl?.value) || null, sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}` };
  }
  save();
}
save();
const withImage = Object.values(cache).filter((r) => r.author).length;
console.log(`p18.json: ${Object.keys(cache).length} places, ${withImage} with a credited image. Calls: ${wikidataCalls} Wikidata, ${commonsCalls} Commons, ${tooMany} 429.`);
