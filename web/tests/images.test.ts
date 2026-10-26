import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readText, walkFiles } from './helpers';
import { WEB, builtOutDir } from './helpers/built';

const OUT = builtOutDir();
const pages = walkFiles(OUT).filter((f) => f.endsWith('index.html') && !f.includes(`${path.sep}specimen${path.sep}`));
const imgs = pages.flatMap((f) => [...readText(f).matchAll(/<img\b[^>]*>/g)].map((m) => ({ page: path.relative(OUT, f), tag: m[0] })));

describe('images (backlog 2.14)', () => {
  it('finds images to check', () => expect(imgs.length).toBeGreaterThan(50));

  it('serves photos from our own /img renditions, 320, 640 or 960 px, and every file exists (backlog 2.38)', () => {
    let local = 0;
    for (const { page, tag } of imgs) {
      const src = /\ssrc="([^"]+)"/.exec(tag)?.[1] ?? '';
      expect(src, `${page}: a photo is never hot-linked from Commons (IMG-1b)`).not.toMatch(/wikimedia\.org/);
      if (!src.startsWith('/img/')) continue;
      local++;
      expect(src, page).toMatch(/^\/img\/[a-z0-9]+-(320|640|960)\.webp$/);
      expect(existsSync(path.join(OUT, src)), `${page}: ${src}`).toBe(true);
      const set = /\ssrcSet="([^"]+)"/.exec(tag)?.[1];
      if (set) for (const part of set.split(', ')) expect(part, page).toMatch(/^\/img\/[a-z0-9]+-(320|640|960)\.webp (320|640|960)w$/);
    }
    expect(local).toBeGreaterThan(50);
  });

  it('keeps Wikimedia out of the pages: no photo is a Commons hot-link, and the /img keys are the ones the prebuild made', () => {
    expect(imgs.filter(({ tag }) => /wikimedia\.org/.test(tag))).toEqual([]);
    const web = WEB;
    const map = JSON.parse(readFileSync(path.join(web, '.generated', 'image-map.json'), 'utf8')) as Record<string, string>;
    const listed = JSON.parse(readFileSync(path.join(web, '.generated', 'prebuild-photos.json'), 'utf8')) as string[];
    expect(Object.keys(map).filter((n) => !listed.includes(n)), 'mapped photos the collector did not list').toEqual([]);
    const keys = new Set(Object.values(map));
    for (const { page, tag } of imgs) {
      const k = /\/img\/([a-z0-9]+)-\d+\.webp/.exec(tag)?.[1];
      if (k) expect(keys.has(k), `${page}: ${k}`).toBe(true);
    }
  });

  it('sets width and height on every image so the box is reserved before it loads', () => {
    for (const { page, tag } of imgs) {
      expect(tag, page).toMatch(/\swidth="\d+"/);
      expect(tag, page).toMatch(/\sheight="\d+"/);
    }
  });

  it('lazy-loads every image except the hero a page marks high priority and at most three eager cards beside it', () => {
    for (const { page, tag } of imgs) {
      if (/fetchPriority="high"/i.test(tag) || /loading="eager"/.test(tag)) continue;
      expect(tag, page).toContain('loading="lazy"');
    }
    for (const page of pages) {
      const tags = [...readText(page).matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
      expect(tags.filter((t) => /loading="eager"/.test(t)).length, path.relative(OUT, page)).toBeLessThanOrEqual(4);
      expect(tags.filter((t) => /fetchPriority="high"/i.test(t)).length, path.relative(OUT, page)).toBeLessThanOrEqual(1);
    }
  });

  it('gives the first card on the home page, the lists and the hero of a trip or place high priority', () => {
    for (const rel of ['index.html', 'trips/index.html', 'places/index.html', 'trips/dolomites-2027/index.html', 'places/arches-national-park/index.html']) {
      const html = readText(path.join(OUT, rel));
      // the first page of the places list can hold only photoless cards (the capture-seeded pages have no photo yet): then there is no image to prioritise
      if (rel === 'places/index.html' && !/<img\b/i.test(html)) continue;
      expect(html, rel).toMatch(/<img\b[^>]*fetchPriority="high"/i);
    }
  });
});
