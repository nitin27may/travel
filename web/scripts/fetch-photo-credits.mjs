#!/usr/bin/env node
// Fetches author and licence for every Wikimedia Commons file the public site uses that has no credit yet:
// locations.json images, hub hero images, and gallery.json photos missing an author or licence.
// Writes web/data-snapshots/photo-credits.json. ONE request at a time, 2 s apart, descriptive User-Agent.
// A 429 stops the script and keeps what it has. Never run this from parallel agents.
//
//   node web/scripts/fetch-photo-credits.mjs            fetch what is missing, merge into the file
//   node web/scripts/fetch-photo-credits.mjs --list     print the files that still need a credit
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(WEB, '..');
const OUT = path.join(WEB, 'data-snapshots', 'photo-credits.json');
const UA = 'TravelPlannerCreditFetch/1.0 (https://nks-travel.pages.dev; nitin27may@gmail.com) one-off licence lookup';
const BATCH = 50;
const PAUSE_MS = 2000;

/** "https://commons.wikimedia.org/wiki/Special:FilePath/Foo%20bar.jpg?width=900" -> "Foo bar.jpg" */
export function fileFromUrl(url) {
  const m = /Special:FilePath\/([^?#]+)/.exec(url ?? '');
  return m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
}

function wantedFiles() {
  const files = new Set();
  const loc = JSON.parse(readFileSync(path.join(ROOT, 'data', 'locations', 'locations.json'), 'utf8'));
  for (const p of loc.places) { const f = fileFromUrl(p.image); if (f) files.add(f); }

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'hub-'));
  try {
    const out = path.join(tmp, 'trips.json');
    execFileSync('python3', [path.join(ROOT, 'tools', 'hub.py'), '--json', out], { cwd: ROOT, stdio: 'pipe' });
    const hub = JSON.parse(readFileSync(out, 'utf8'));
    for (const t of Array.isArray(hub) ? hub : hub.trips) { const f = fileFromUrl(t.img); if (f) files.add(f); }
  } finally { rmSync(tmp, { recursive: true, force: true }); }

  for (const dir of readdirSync(path.join(ROOT, 'legacy'))) {
    const g = path.join(ROOT, 'legacy', dir, 'gallery', 'gallery.json');
    if (!existsSync(g)) continue;
    const doc = JSON.parse(readFileSync(g, 'utf8'));
    for (const s of doc.sections ?? []) for (const ph of s.photos ?? []) if (ph.file && (!ph.author || !ph.license)) files.add(ph.file);
  }
  return [...files].sort();
}

const strip = (html) => String(html ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** Some uploaders write a paragraph in the author field; keep the first sentence, at most 120 characters. */
export function shortAuthor(a) {
  if (a.length <= 120) return a;
  const first = a.split(/\.\s/)[0];
  return (first.length > 120 ? `${first.slice(0, 117)}...` : first).replace(/\.$/, '');
}

async function fetchBatch(titles) {
  const qs = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'extmetadata|url', titles: titles.map((t) => `File:${t}`).join('|') });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${qs}`, { headers: { 'User-Agent': UA } });
  if (res.status === 429) { const e = new Error('429'); e.code = 429; throw e; }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const norm = new Map((json.query?.normalized ?? []).map((n) => [n.to, n.from]));
  const out = {};
  for (const page of Object.values(json.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const title = String(page.title ?? '').replace(/^File:/, '');
    const original = (norm.get(page.title) ?? page.title ?? '').replace(/^File:/, '') || title;
    if (!info) continue;
    const m = info.extmetadata ?? {};
    out[original] = {
      author: shortAuthor(strip(m.Artist?.value)) || null,
      licence: strip(m.LicenseShortName?.value) || null,
      licenceUrl: strip(m.LicenseUrl?.value) || null,
      sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replace(/ /g, '_'))}`,
    };
  }
  return out;
}

async function main() {
  const have = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { schema: 'photo-credits/1', files: {} };
  const todo = wantedFiles().filter((f) => !have.files[f]);
  if (process.argv.includes('--list')) { console.log(todo.join('\n')); return; }
  console.log(`${todo.length} files need a credit`);
  const save = () => writeFileSync(OUT, JSON.stringify({ schema: have.schema, files: Object.fromEntries(Object.keys(have.files).sort().map((k) => [k, have.files[k]])) }, null, 2) + '\n');
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    try {
      Object.assign(have.files, await fetchBatch(chunk));
    } catch (e) {
      save();
      console.error(e.code === 429 ? 'Commons answered 429; stopped. Kept what was fetched. Try again later.' : `fetch failed: ${e.message}`);
      process.exit(1);
    }
    save();
    if (i + BATCH < todo.length) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  const missing = wantedFiles().filter((f) => !have.files[f]);
  console.log(missing.length ? `still without a credit (${missing.length}):\n${missing.join('\n')}` : 'all files credited');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exit(1); });
