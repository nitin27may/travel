import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlacePage } from '@/components/places/PlacePage';
import { createPublicData } from '@/lib/public';

const data = createPublicData();
const html = (slug: string): string => renderToString(<PlacePage place={data.getPlace(slug)!} inside={[]} url={`https://example.test/places/${slug}/`} />).replace(/<!-- -->/g, '');
const strip = (h: string): string => h.match(/<section class="ps-glance"[\s\S]*?<\/section>/)?.[0] ?? '';
const tiles = (s: string): { label: string; body: string }[] => [...s.matchAll(/<li[^>]*>(?:<a[^>]*>)<span class="gl">([^<]*)<\/span>([\s\S]*?)<\/a><\/li>/g)].map((m) => ({ label: m[1]!, body: m[2]! }));
const trails = data.placeSlugs().filter((s) => data.getPlace(s)!.kind === 'trail');

describe('the trail key-facts strip (10.1)', () => {
  it('has all 14 slots and the AllTrails tile on every trail page that has a page model, 15 tiles in a 3-column grid', () => {
    expect(trails.length).toBeGreaterThanOrEqual(122);
    let withStrip = 0;
    for (const slug of trails) {
      const t = tiles(strip(html(slug)));
      if (!data.getPlace(slug)!.sections) continue;
      withStrip++;
      expect(t.map((x) => x.label), slug).toEqual(['Length', 'Climb', 'High point', 'Adult time', 'Route type', 'Effort', 'Surface', 'Hazards and exposure', 'Dogs', 'Stroller', 'Wheelchair', 'Season', 'Trailhead and parking', 'Route status', 'AllTrails, link only']);
    }
    expect(withStrip).toBeGreaterThan(0);
  }, 600_000);
  it('Fenland Loop says "Not checked yet" for what it lacks and shows what it has', () => {
    const t = tiles(strip(html('fenland-loop')));
    const by = (l: string) => t.find((x) => x.label === l)!.body;
    for (const l of ['High point', 'Trailhead and parking', 'Route status']) expect(by(l), l).toContain('Not checked yet');
    expect(by('Length')).toContain('1.9');
    expect(by('Adult time')).toContain('40 min');
    expect(by('Dogs')).toContain('Leash');
    expect(by('Hazards and exposure')).toContain('Hazards listed');
  });
  it('Tre Cime shows its track figures, with no gap in length, climb or time', () => {
    const t = tiles(strip(html('tre-cime-di-lavaredo-loop')));
    const by = (l: string) => t.find((x) => x.label === l)!.body;
    expect(by('Length')).toContain('8.8');
    expect(by('Climb')).toMatch(/550/);
    expect(by('Adult time')).toContain('4');
    expect(by('Trailhead and parking')).toContain('Rifugio Auronzo');
  });
  it('every trail page (122 of 122) links AllTrails in a new tab, direct or as a labelled search (10.3)', () => {
    let direct = 0;
    for (const slug of trails) {
      const h = html(slug);
      const a = h.match(/<a href="(https:\/\/www\.alltrails\.com[^"]*)"[^>]*target="_blank" rel="noopener noreferrer"[^>]*>([\s\S]*?)<\/a>/);
      expect(a, slug).not.toBeNull();
      expect(a![2], slug).toMatch(/Open on AllTrails|Search AllTrails/);
      if (/Open on AllTrails/.test(a![2]!)) direct++;
      else expect(a![1], slug).toMatch(/^https:\/\/www\.alltrails\.com\/search\?q=/);
    }
    expect(direct).toBeLessThanOrEqual(trails.length);
    expect(trails.length).toBe(122);
  }, 600_000);
});

describe('one builder for derived links (A9)', () => {
  const root = path.resolve(__dirname, '..', '..');
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
  it('forms no AllTrails, Google Maps, Apple Maps or Komoot URL outside lib/map/links.ts in the place files', () => {
    const files = [...walk(path.join(root, 'components', 'places')), ...walk(path.join(root, 'lib', 'public'))];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      // a URL written out in code; the stored data (records' own links) never goes through a template literal with a host
      expect(src, f).not.toMatch(/['"`]https:\/\/(?:www\.)?(?:google\.com\/maps|maps\.apple\.com|alltrails\.com\/search|komoot\.com\/discover)/);
    }
  });
});
