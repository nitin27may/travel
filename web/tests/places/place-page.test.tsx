import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PlaceRoute, * as route from '@/app/places/[slug]/page';
import { publicText, summaryOrKind } from '@/components/places/model';
import { PlacePage } from '@/components/places/PlacePage';
import { placeRows } from './support';
import { createPublicData } from '@/lib/public';

const data = createPublicData();
const html = (slug: string): string => {
  const place = data.getPlace(slug);
  if (!place) throw new Error(slug);
  const district = place.areaChain.find((a) => a.level === 'district');
  const inside = data.listPlaces().filter((c) => c.slug !== slug && c.areaChain.find((a) => a.level === 'district')?.slug === district?.slug).slice(0, 8);
  return renderToString(<PlacePage place={place} inside={inside} url={`https://example.test/places/${slug}/`} />).replace(/<!-- -->/g, '');
};

describe('the place route', () => {
  it('builds one page per place slug, nothing else, and no placeholder', () => {
    expect(route.generateStaticParams().map((p) => p.slug)).toEqual(data.placeSlugs());
    expect(route.generateStaticParams().some((p) => p.slug === 'stub')).toBe(false);
    expect(route.dynamicParams).toBe(false);
  });
  it('renders through the route and sets metadata from the place', async () => {
    const el = await PlaceRoute({ params: Promise.resolve({ slug: 'lago-di-braies' }) });
    expect(renderToString(el)).toContain('Lago di Braies');
    const meta = await route.generateMetadata({ params: Promise.resolve({ slug: 'lago-di-braies' }) });
    expect(meta.title).toBe('Lago di Braies');
  });
});

describe('trail page: tre-cime-di-lavaredo-loop', () => {
  const page = html('tre-cime-di-lavaredo-loop');
  it('has the cover kicker, glance facts with text provenance, and hazards above the route', () => {
    expect(page).toContain('Trail');
    expect(page).toContain('Auronzo');
    expect(page).toContain('Distance');
    expect(page).toMatch(/Trip research notes, read Aug 2026/);
    expect(page).not.toContain('PLAN.md');
    expect(page.indexOf('Hazards')).toBeLessThan(page.indexOf('The route'));
  });
  it('draws the elevation profile ink-only at rest, with a text summary', () => {
    expect(page).toMatch(/role="img"[^>]*aria-label="Sketch of the elevation profile\. 10 km/);
    expect(page).toContain('pl-line');
    expect(page).not.toContain('pl-cursor');
  });
  it('shows trailhead and parking with coordinates and Google, Directions and Apple Maps links to stored points', () => {
    expect(page).toContain('Trailhead and parking');
    expect(page).toContain('46.61285,12.29267');
    expect(page).toContain('https://www.google.com/maps/dir/?api=1&amp;destination=46.61285,12.29267');
    expect(page).toContain('https://maps.apple.com/?daddr=46.61285,12.29267');
    expect(page).toContain('https://www.google.com/maps/search/?api=1&amp;query=46.61285,12.29267');
    expect(page).toContain('Booking window');
  });
  it('lists the five link tabs with counts and the research date, and a rest-state gap line for missing photos', () => {
    for (const t of ['Official', 'Booking', 'Route', 'Conditions', 'Report']) expect(page).toContain(`>${t} <`);
    expect(page).toContain('Researched 18 Oct 2026');
    expect(page).toContain('No licensed photo yet');
  });
  it('shows the completeness badge with the tracked-check tooltip, and the Usable level', () => {
    expect(page).toMatch(/Usable\s*·\s*13 of 15/);
    expect(page).toContain('13 of 15 tracked checks pass; 23 checks are not tracked yet');
  });
  it('renders the L5 stubs without implementing them', () => {
    expect(page).toContain('data-stub="ExportMenu"');
    expect(page).toContain('data-stub="ShareButton"');
  });
});

describe('honesty and conflicts', () => {
  it('marks the unconfirmed trail points "Location unconfirmed" on the page and in directions', () => {
    for (const slug of ['lago-di-braies', 'monte-piana', 'viel-dal-pan', 'alpe-di-siusi', 'cascate-di-fanes']) {
      const page = html(slug);
      expect(page, slug).toContain('Location unconfirmed');
    }
  });
  it('shows both values and their sources when sources disagree', () => {
    const page = html('lago-di-braies');
    expect(page).toContain('Sources disagree');
    expect(page).toContain('EUR 15/day');
    expect(page).toContain('EUR 44 incl. a EUR 22 voucher');
    expect(page).toContain('pragsparking.com');
  });
  it('writes dated operator facts as "observed 2026" and links public phone numbers', () => {
    expect(html('lagazuoi-cable-car-and-tunnels')).toContain('observed 2026');
    expect(html('lagazuoi-cable-car-and-tunnels')).not.toMatch(/6 Jun - 18 Oct 2026/);
    expect(html('rifugio-nuvolau-and-averau')).toContain('href="tel:+3904364660"');
  });
});

describe('every kind has its own facts and an honest empty line, never a blank', () => {
  const byKind = new Map<string, string>();
  for (const p of data.internals.places) if (!byKind.has(p.kind)) byKind.set(p.kind, p.slug);
  for (const [kind, slug] of byKind) {
    it(`${kind}: ${slug}`, () => {
      const page = html(slug);
      expect(page).toContain('At a glance');
      expect(page).toContain('Facts and sources');
      expect(page).not.toMatch(/<dd[^>]*>\s*<\/dd>/);
    });
  }
  it('a sight with no hours says so', () => {
    expect(html('million-dollar-highway')).toContain('No hours recorded yet');
  });
  it('an area lists the places inside it as rows', () => {
    expect(html('capri')).toContain('Places in Capri');
  });
});

describe('every place page renders', () => {
  it('all slugs, with no throw, a title and no private trip name', () => {
    const privateTitles = data.internals.trips.filter((t) => t.visibility !== 'public').map((t) => t.title.toLowerCase());
    for (const slug of data.placeSlugs()) {
      const page = html(slug);
      expect(page, slug).toContain('<h1>');
      for (const t of privateTitles) expect(page.toLowerCase(), `${slug} names ${t}`).not.toContain(t);
    }
  });
});

describe('no internal capture notes on public output', () => {
  const INTERNAL = /\.\s?md\b|road ?trip|\bstops? \d+\b|\bplans?\b|loose line|\bno details\b|\.json\b|\blegacy\b|\bfolder\b/i;
  const text = (h: string) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
  it('every place page, in its visible text', () => {
    const bad: string[] = [];
    for (const slug of data.placeSlugs()) {
      const m = INTERNAL.exec(text(html(slug)));
      if (m) bad.push(`${slug}: ${m[0]}`);
    }
    expect(bad).toEqual([]);
  });
  it('every list row (card summary and search text)', () => {
    const bad = placeRows().filter((r) => INTERNAL.test(r.note)).map((r) => `${r.slug}: ${r.note}`);
    expect(bad).toEqual([]);
  });
  it('publicText keeps the sentences about the place and drops the capture notes', () => {
    expect(publicText('Stop 5 of the road trip post. Remote, unpaved access; check road conditions.')).toBe('Remote, unpaved access; check road conditions.');
    expect(publicText('Loose line in Location. md, no details.')).toBe('');
    expect(publicText('Gaspesie road trip stop 7. Short family walk to a glacial cirque lake (from memory).')).toBe('Short family walk to a glacial cirque lake.');
    expect(publicText('Wide gravel loop, no exposure.')).toBe('Wide gravel loop, no exposure.');
  });
  it('a place with no public summary shows its kind and area', () => {
    const p = data.getPlace('breckenridge');
    expect(summaryOrKind(p?.summary ?? '', p?.kindLabel ?? '', p?.areaLabel ?? '')).toMatch(/^Town in /);
    expect(html('breckenridge')).toMatch(/Town in /);
  });
});
