import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WEB, readText, walkFiles } from './helpers';

const OUT = path.join(WEB, 'out');
const pages = walkFiles(OUT).filter((f) => f.endsWith('index.html') && !f.includes(`${path.sep}specimen${path.sep}`));
const imgs = pages.flatMap((f) => [...readText(f).matchAll(/<img\b[^>]*>/g)].map((m) => ({ page: path.relative(OUT, f), tag: m[0] })));

describe('images (backlog 2.14)', () => {
  it('finds images to check', () => expect(imgs.length).toBeGreaterThan(50));

  it('asks Commons for a thumbnail width, never the original, and never wider than 1600', () => {
    for (const { page, tag } of imgs) {
      const src = /\ssrc="([^"]+)"/.exec(tag)?.[1] ?? '';
      if (!/commons\.wikimedia\.org/.test(src)) continue;
      const w = Number(/[?&]width=(\d+)/.exec(src)?.[1]);
      expect(w, `${page}: ${src}`).toBeGreaterThan(0);
      expect(w, `${page}: ${src}`).toBeLessThanOrEqual(1600);
    }
  });

  it('sets width and height on every image so the box is reserved before it loads', () => {
    for (const { page, tag } of imgs) {
      expect(tag, page).toMatch(/\swidth="\d+"/);
      expect(tag, page).toMatch(/\sheight="\d+"/);
    }
  });

  it('lazy-loads every image except the one hero a page marks high priority', () => {
    for (const { page, tag } of imgs) {
      if (/fetchPriority="high"/i.test(tag)) continue;
      expect(tag, page).toContain('loading="lazy"');
    }
  });
});
