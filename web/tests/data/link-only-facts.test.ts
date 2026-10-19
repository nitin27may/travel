import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { citesLinkOnlyPlatform, publicSource } from '@/lib/public/places';
import { createPublicData } from '@/lib/public';
import { WEB, readText, walkFiles } from '../helpers';

/**
 * Backlog 2.31: AllTrails, Komoot, Gaia, Outdooractive, Wikiloc, Strava, Google and Tripadvisor are link-only
 * platforms. No fact on a public page may cite one as its source; the platform stays as a link.
 */
const PLATFORM = /\b(alltrails|komoot|gaia|outdooractive|wikiloc|strava|google|tripadvisor)\b/i;

describe('link-only platforms never source a public fact', () => {
  it('recognises the platforms in a source string', () => {
    for (const s of ['AllTrails listing', 'AllTrails listing: moderately challenging', 'Komoot rates the loop easy', 'ALLTRAILS summary', 'Belluno route (outdooractive.com)', 'Wikiloc track', 'Strava heatmap', 'Google reviews', 'Tripadvisor'])
      expect(citesLinkOnlyPlatform(s), s).toBe(true);
    for (const s of ['PLAN.md, read Oct 2026', 'official https://www.dolomiti.it', 'osm_node 123', undefined, ''])
      expect(citesLinkOnlyPlatform(s as string | undefined), String(s)).toBe(false);
  });

  it('keeps a fact that has an own source next to a platform, and drops one that has none or copies the platform', () => {
    expect(publicSource('AllTrails (best months) and PLAN.md', 'Jun-Oct')).toBe('PLAN.md');
    expect(publicSource('bookatrekking.com / AllTrails summaries', 'Late May')).toBe('bookatrekking.com');
    expect(publicSource('AllTrails listing', 'Dogs welcome')).toBeNull();
    expect(publicSource('AllTrails and PLAN.md', 'May-Oct on AllTrails')).toBeNull();
    expect(publicSource('PLAN.md', 'Jun-Oct')).toBe('PLAN.md');
  });

  it('the adapter drops those facts (and conflicting values) from every place', () => {
    const data = createPublicData();
    let facts = 0;
    for (const slug of data.placeSlugs()) {
      const place = data.getPlace(slug)!;
      for (const f of place.facts) {
        facts += 1;
        expect(f.provenance, `${slug}: ${f.label}`).not.toMatch(PLATFORM);
        expect(f.value, `${slug}: ${f.label} value`).not.toMatch(PLATFORM);
        for (const c of f.conflicts) expect(c.provenance, `${slug}: ${f.label} conflict`).not.toMatch(PLATFORM);
      }
    }
    expect(facts).toBeGreaterThan(50);
  });

  it('keeps a trail built from the Rockies research clean: AllTrails is a link, never a fact, a track value or a point', () => {
    const data = createPublicData();
    const trail = data.getPlace('larch-valley-to-sentinel-pass')!;
    expect(trail.links.flatMap((g) => g.links).some((l) => l.kind === 'alltrails' && l.linkOnly)).toBe(true);
    for (const f of trail.facts) expect(`${f.value} ${f.provenance}`, f.label).not.toMatch(PLATFORM);
    // every stored line and point is OpenStreetMap, Wikidata or our own: never a link-only platform
    for (const p of data.internals.places) {
      for (const l of p.lines) expect(`${l.ref} ${l.source} ${l.credit ?? ''} ${l.label}`, p.slug).not.toMatch(PLATFORM);
      if (p.point) expect(p.point.pointSource, p.slug).not.toMatch(PLATFORM);
    }
  });

  it('keeps the Tre Cime difficulty out of the facts', () => {
    const place = createPublicData().getPlace('tre-cime-di-lavaredo-loop')!;
    expect(place.facts.some((f) => /AllTrails listing/i.test(f.provenance) || /moderately challenging/i.test(f.value))).toBe(false);
  });
});

describe('built place pages', () => {
  const OUT = path.join(WEB, 'out');
  const pages = walkFiles(path.join(OUT, 'places')).filter((f) => f.endsWith('index.html'));

  it('has pages to check', () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  it('shows no "AllTrails listing" text and no source line that cites a link-only platform', () => {
    for (const f of pages) {
      const html = readText(f);
      expect(html, f).not.toMatch(/AllTrails listing/i);
      // every visible source line (the muted provenance text beside a fact)
      for (const m of html.matchAll(/<span class="pl-prov">([\s\S]*?)<\/span>/g)) {
        const text = m[1].replace(/<[^>]+>/g, '');
        expect(text, `${f}: ${text}`).not.toMatch(PLATFORM);
      }
    }
  });
});
