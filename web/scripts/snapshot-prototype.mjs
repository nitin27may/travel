#!/usr/bin/env node
// Snapshots the prototype's data files (prototype/src/data/{trip,places,trails,public-trips}.ts) into
// web/data-snapshots/prototype.json so the web build never needs prototype/node_modules.
//
//   node web/scripts/snapshot-prototype.mjs           write the snapshot (and web/redirects.json)
//   node web/scripts/snapshot-prototype.mjs --check   exit 1 if either file would change
//
// PRIVACY: prototype TRIP is household data (travellers, ages, booking codes, costs, phones, emails,
// addresses, seats, payments, attachments, tasks, lists). It goes through an allow-list below. Anything not
// named here never reaches the snapshot. Do not widen it without a reason and a privacy-test update.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const ROOT = path.resolve(WEB, '..');
const PROTO = path.join(ROOT, 'prototype');
const OUT = path.join(WEB, 'data-snapshots', 'prototype.json');

/** Recursively sort object keys so the file is stable. */
export function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

/** Reservations become generic rows. Only these ids get a hand-written label; the rest use the venue title. */
const FIXED_LOGISTICS = {
  'r-flight': { kind: 'flight', label: 'Flight · Toronto to Venice' },
  'r-car': { kind: 'car', label: 'Car hire · Venice airport' },
};
const LOGISTICS_KINDS = new Set(['parking', 'lift', 'activity', 'restaurant']);
/** The example hotels are not places. Each base day points at the town instead. */
const BASE_TOWN = { 'hotel-san-candido': 'san-candido', 'hotel-cortina': 'cortina', 'hotel-ortisei': 'ortisei', 'hotel-bolzano': 'bolzano' };

/** A note survives only if it names no traveller and says nothing about a booking. */
export function makeNoteFilter(travellers) {
  const names = travellers.map((t) => t.name).filter(Boolean);
  const res = [...names, 'Partner', 'Kai', 'Nitin'].map((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
  return (note) => {
    if (!note) return undefined;
    if (res.some((r) => r.test(note))) return undefined;
    if (/\b(booked|confirm\w*|code|reservation)\b|€\s?\d+\s?(pp|per person)?\s?$/i.test(note)) return undefined;
    return note;
  };
}

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
/** A calendar date in prose: ISO, "15 Jun", "Jun 15", "Tue 15 Jun 2027", "February 2027". Years alone are fine. */
export const DATE_TEXT = new RegExp(`\\d{4}-\\d{2}-\\d{2}|\\b\\d{1,2}(?:st|nd|rd|th)?\\s*(?:[-–]\\s*\\d{1,2}\\s*)?${MONTH}\\b|\\b${MONTH}\\.?\\s+\\d{1,2}\\b|\\b${MONTH}\\s+\\d{4}\\b`, 'i');

export function snapshotTrip(TRIP, dropped = []) {
  const okNote = makeNoteFilter(TRIP.travellers);
  const days = TRIP.days.map((d) => ({
    n: d.n,
    title: d.title ?? `Day ${d.n}`,
    baseTown: d.base ? (BASE_TOWN[d.base] ?? null) : null,
    items: d.itemIds
      .map((id) => TRIP.items[id])
      .filter(Boolean)
      .map((it) => {
        const o = { id: it.id, placeId: it.placeId };
        if (it.time) o.time = it.time;
        if (it.variant) o.variant = it.variant;
        const note = okNote(it.note);
        if (note) o.note = note;
        return o;
      }),
  }));
  const logistics = [];
  for (const r of TRIP.reservations) {
    if (r.kind === 'stay') continue; // stays become the base rows
    const fixed = FIXED_LOGISTICS[r.id];
    if (!fixed && !LOGISTICS_KINDS.has(r.kind)) continue;
    // titles of parking, lift and ticket rows name a venue ("Seceda lift, 08:30 slot"), never a person
    const row = { id: r.id, kind: fixed?.kind ?? r.kind, dayN: r.dayN ?? null, label: fixed?.label ?? r.title };
    if (r.opensAt && !fixed) {
      // public trips are dateless: a booking window is a rule relative to a day, never a date
      const rel = /(\d+)\s+days?\s+before/i.exec(r.opensAt);
      if (rel) row.bookRule = { daysBefore: Number(rel[1]), dayN: r.dayN ?? null, time: null, tz: r.tz ?? null };
      else if (DATE_TEXT.test(r.opensAt)) dropped.push({ where: `Dolomites booking ${r.id}`, text: r.opensAt, why: 'booking window given as a date' });
      else row.bookNote = r.opensAt;
    }
    logistics.push(row);
  }
  return { id: TRIP.id, title: TRIP.title, nights: TRIP.nights, zone: TRIP.zone, days, logistics }; // no start date: day_n only
}

export function snapshotPlaces(PLACES) {
  return PLACES.filter((p) => p.kind !== 'stay'); // example hotels are never published
}

export function snapshotPublicTrips(PUBLIC_TRIPS, travellers) {
  const okNote = makeNoteFilter(travellers);
  return PUBLIC_TRIPS.map((t) => {
    const { by: _by, copies: _copies, ...rest } = t; // publisher name and copy counter are not site content
    void _by; void _copies;
    return { ...rest, days: t.days.map((d) => ({ ...d, stops: d.stops.map((s) => { const { note, ...r } = s; const n = okNote(note); return n ? { ...r, note: n } : r; }) })) };
  });
}

function needRolldown() {
  const entry = path.join(PROTO, 'node_modules', 'rolldown', 'dist', 'index.mjs');
  if (!existsSync(entry)) {
    console.error('prototype/node_modules is missing. Run `npm install` in prototype/ (see docs/v2/design/prototype.md), then re-run.');
    process.exit(1);
  }
  return entry;
}

/** Bundles a TypeScript entry with the prototype's rolldown, then imports the bundle. `alias` maps module names. */
async function bundleAndImport(entry, alias, tmp) {
  const { build } = await import(pathToFileURL(needRolldown()).href);
  const outFile = path.join(tmp, `bundle-${path.basename(entry)}.mjs`);
  await build({ input: entry, platform: 'node', logLevel: 'silent', resolve: { alias }, output: { file: outFile, format: 'esm' } });
  return import(pathToFileURL(outFile).href + `?t=${Date.now()}`);
}

async function loadPrototypeModules() {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'snap-proto-'));
  try {
    const stub = path.join(tmp, 'react-stub.mjs');
    writeFileSync(stub, 'export const useSyncExternalStore = (_s, get) => get();\nexport const useMemo = (f) => f();\nexport default {};\n');
    const d = (f) => path.join(PROTO, 'src', 'data', f);
    const entry = path.join(tmp, 'entry.ts');
    writeFileSync(entry, [
      `export { TRIP } from ${JSON.stringify(d('trip.ts'))};`,
      `export { PLACES } from ${JSON.stringify(d('places.ts'))};`,
      `export { TRAILS, ACCESS, CHECK_KINDS, LINK_KINDS, LINK_GROUPS, FIELDS, GROUPS, DIFFICULTY } from ${JSON.stringify(d('trails.ts'))};`,
      `export { PUBLIC_TRIPS } from ${JSON.stringify(d('public-trips.ts'))};`,
    ].join('\n'));
    return await bundleAndImport(entry, { react: stub }, tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Runs the adapter (bundled with rolldown) for the generated files that depend on it. */
async function adapterOutputs(snapshotDropped) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'snap-adapter-'));
  const prevCwd = process.cwd();
  try {
    process.chdir(WEB); // the data loaders resolve the repo root and .generated from cwd = web/
    const mod = await bundleAndImport(path.join(WEB, 'lib', 'public', 'cli.ts'), { '@': WEB }, tmp);
    return { redirects: JSON.stringify(mod.buildRedirects(), null, 2) + '\n', report: JSON.stringify(mod.buildReport(snapshotDropped), null, 2) + '\n' };
  } finally {
    process.chdir(prevCwd);
    rmSync(tmp, { recursive: true, force: true });
  }
}

export async function buildSnapshot() {
  const m = await loadPrototypeModules();
  const dropped = [];
  return sortKeys({
    schema: 'prototype-snapshot/1',
    trip: snapshotTrip(m.TRIP, dropped),
    dropped,
    places: snapshotPlaces(m.PLACES),
    trails: m.TRAILS,
    access: m.ACCESS,
    checkKinds: m.CHECK_KINDS,
    linkKinds: m.LINK_KINDS,
    linkGroups: m.LINK_GROUPS,
    fields: m.FIELDS,
    groups: m.GROUPS,
    difficulty: m.DIFFICULTY,
    publicTrips: snapshotPublicTrips(m.PUBLIC_TRIPS, m.TRIP.travellers),
  });
}

/** Writes or checks one generated file. Returns true when it differs from disk. */
function emit(file, text, check) {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const differs = current !== text;
  if (differs && !check) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return differs;
}

async function main() {
  const check = process.argv.includes('--check');
  const snapshot = await buildSnapshot();
  const stale = [];
  if (emit(OUT, JSON.stringify(snapshot, null, 2) + '\n', check)) stale.push(path.relative(ROOT, OUT));

  // redirects.json and the report come from the adapter, which reads the snapshot just written above
  const out = await adapterOutputs(snapshot.dropped ?? []);
  if (emit(path.join(WEB, 'redirects.json'), out.redirects, check)) stale.push('web/redirects.json');
  if (emit(path.join(WEB, 'data-snapshots', 'snapshot-report.json'), out.report, check)) stale.push('web/data-snapshots/snapshot-report.json');

  if (check && stale.length) {
    console.error(`stale: ${stale.join(', ')}. Run \`pnpm --dir web snapshot\` and commit.`);
    process.exit(1);
  }
  console.log(check ? 'snapshot is current' : `wrote ${stale.length ? stale.join(', ') : 'nothing (already current)'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
