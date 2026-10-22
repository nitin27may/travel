import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { offSiteImages } from '../../../core/test/catalogue/contract/images.cases';
import { renditionOf, withRenditions } from '@/lib/server/images';
import { createJsonSource } from '@/lib/server/source';

// The site never reads a photo from Commons at runtime: API responses take the build's renditions (scripts/images.mjs record), bucketed to
// 320, 640 or 960, and a photo with no rendition is left out. Needs the build's .generated/image-map.json (check-all builds first).
const MAP = path.join(process.cwd(), '.generated', 'image-map.json');

describe('photo URLs in API output', () => {
  it('every place, trip and globe card of the real data is free of off-site images, and carries renditions', () => {
    expect(existsSync(MAP), 'run the web build first: it writes .generated/image-map.json').toBe(true);
    const src = createJsonSource();
    const hits: string[] = [];
    let local = 0;
    const scan = (x: unknown, where: string) => {
      hits.push(...offSiteImages(x, where));
      local += JSON.stringify(x).match(/"\/img\/[a-z0-9]+-(?:320|640|960)\.webp"/g)?.length ?? 0;
    };
    for (const r of src.placeRows) {
      scan(r, `row ${r.slug}`);
      scan(src.placeDetail(r.slug), `place ${r.slug}`);
      const card = src.globe.card(`place:${r.slug}`);
      if (card) scan(card, `card ${r.slug}`);
    }
    for (const t of src.tripRows) {
      scan(t, `tripRow ${t.slug}`);
      scan(src.tripDetail(t.slug), `trip ${t.slug}`);
      const card = src.globe.card(`trip:${t.slug}`);
      if (card) scan(card, `card trip ${t.slug}`);
    }
    expect(hits).toEqual([]);
    expect(local, 'the real data has photos').toBeGreaterThan(100);
  });

  it('the globe card of Lake Louise names a same-origin rendition', () => {
    const card = createJsonSource().globe.card('place:lake-louise');
    if (card?.card.image) expect(card.card.image.url).toMatch(/^\/img\/[a-z0-9]+-960\.webp$/);
  });

  it('buckets the asked width and drops a photo with no rendition, never falling back to Commons', () => {
    const known = Object.keys(JSON.parse(readFileSync(MAP, 'utf8')) as Record<string, string>)[0]!;
    const at = (w: number) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(known)}?width=${w}`;
    expect(renditionOf(at(300))).toMatch(/-320\.webp$/);
    expect(renditionOf(at(500))).toMatch(/-640\.webp$/);
    expect(renditionOf(at(2000))).toMatch(/-960\.webp$/);
    const unknown = 'https://commons.wikimedia.org/wiki/Special:FilePath/No_such_photo_here.jpg?width=960';
    expect(renditionOf(unknown)).toBeNull();
    const out = withRenditions({ photo: { url: unknown, width: 960 }, photos: [{ url: unknown }, { url: at(640) }], image: unknown, name: 'x' });
    expect(out.photo).toBeNull();
    expect(out.photos).toHaveLength(1);
    expect(out.image).toBeNull();
    expect(JSON.stringify(out)).not.toMatch(/commons|wikimedia/);
  });
});
