import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlacePage } from '@/components/places/PlacePage';
import { createPublicData } from '@/lib/public';

const data = createPublicData();
const html = (slug: string): string => renderToString(<PlacePage place={data.getPlace(slug)!} inside={[]} url={`https://example.test/places/${slug}/`} />).replace(/<!-- -->/g, '');
const cover = (h: string): string => h.match(/<div class="pl-actions">[\s\S]*?<\/p><\/div>|<div class="pl-actions">[\s\S]*?<\/div><\/div>/)?.[0] ?? '';
const hasDirections = (h: string): boolean => /<a class="btn btn-primary pl-dir" href="https:\/\/www\.google\.com\/maps\/dir\//.test(h);
const saveIsPrimary = (h: string): boolean => /class="btn btn-primary pl-primary"[^>]*aria-expanded/.test(h);

describe('the cover has exactly one primary action (M19, P7)', () => {
  it('a place with a stored point has the Directions link and Save is not the primary', () => {
    // cape-cod, not capri: Capri is reached only by its ferry terminal since DATA-D2b-it, so by PS4 it has no driving Directions
    for (const slug of ['tre-cime-di-lavaredo-loop', 'cape-cod']) {
      const h = html(slug);
      expect(hasDirections(cover(h)), slug).toBe(true);
      expect(saveIsPrimary(cover(h)), slug).toBe(false);
    }
  });
  it('a place with only an approximate point still has Directions, with the approximate position said in the rail', () => {
    const slug = 'otzi-south-tyrol-museum-of-archaeology';
    const h = html(slug);
    expect(h).toContain('Approximate position');
    expect(hasDirections(cover(h))).toBe(true);
    expect(saveIsPrimary(cover(h))).toBe(false);
  });
  it('a place with no stored point has no Directions and Save to a trip is the primary', () => {
    const h = html('iceline-trail');
    expect(hasDirections(cover(h))).toBe(false);
    expect(saveIsPrimary(cover(h))).toBe(true);
    expect(h).toContain('No point is stored yet, so there are no directions.');
  });
  it('a shuttle-only place (Moraine Lake) has no Directions by design, Save is the primary, and the cover says why', () => {
    const h = html('moraine-lake');
    expect(hasDirections(cover(h))).toBe(false);
    expect(saveIsPrimary(cover(h))).toBe(true);
    expect(h).toMatch(/pl-shuttle-note[^>]*>No driving directions: no private cars on this road\. <a href="#access">Shuttle and bus details<\/a>/);
    expect(h).toContain('No private cars on this road: take the shuttle or bus');
  });
});

describe('every new-tab link opens with noopener', () => {
  it('no target="_blank" anchor in any rendered place page lacks rel="noopener" (audit 5.2-R1-2)', () => {
    const bad: string[] = [];
    for (const slug of data.placeSlugs()) {
      for (const m of html(slug).matchAll(/<a\b[^>]*\btarget="_blank"[^>]*>/g)) {
        if (!/\brel="[^"]*\bnoopener\b[^"]*"/.test(m[0])) bad.push(`${slug}: ${m[0].slice(0, 100)}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  }, 600_000);
});
