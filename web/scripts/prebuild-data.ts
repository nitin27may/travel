// The photo list and the share-image list, from the pages' own loaders (P9): the same trips, places and globe cards the pages render, run in
// plain Node (type stripping + scripts/ts-hooks.mjs) before `next build`. IMAGES_SOURCE_URLS=1 makes the loaders keep the Commons source
// URL, which is what this list is made of. Writes web/.generated/prebuild-photos.json (file names) and og-items.json. No network.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.IMAGES_SOURCE_URLS = '1';

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.IMG_GENERATED_DIR || path.join(WEB, '.generated');
const URL_RE = /https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^"?\\\s]+)/g;

const { listTrips, listPlaces, getTrip, getPlace } = await import('@/lib/public/index');
const { buildGlobeFiles } = await import('@/lib/globe/data');

const trips = listTrips();
const places = listPlaces();
const names = new Set<string>();
const scan = (x: unknown): void => {
  for (const m of JSON.stringify(x).matchAll(URL_RE)) names.add(decodeURIComponent(m[1]!));
};
scan(trips);
scan(places);
for (const t of trips) scan(getTrip(t.slug));
for (const p of places) scan(getPlace(p.slug));
scan(buildGlobeFiles().cards);

const items = [
  ...trips.map((t) => ({ kind: 'trips', slug: t.slug, title: t.title, sub: ['Trip', t.region].filter(Boolean).join(' · '), photo: t.cover ? { url: t.cover.url, author: t.cover.author, licence: t.cover.licence } : null })),
  ...places.map((p) => ({ kind: 'places', slug: p.slug, title: p.name, sub: [p.kindLabel, p.areaLabel].filter(Boolean).join(' · '), photo: p.photo ? { url: p.photo.url, author: p.photo.author, licence: p.photo.licence } : null })),
];
for (const it of items) if (it.photo) scan(it.photo.url);

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'prebuild-photos.json'), JSON.stringify([...names].sort(), null, 1) + '\n');
writeFileSync(path.join(OUT, 'og-items.json'), JSON.stringify(items) + '\n');
console.log(`prebuild-data: ${names.size} photos, ${items.length} share images`);
