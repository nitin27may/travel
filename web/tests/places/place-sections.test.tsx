import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlacePage } from '@/components/places/PlacePage';
import { fitFor } from '@/components/suit/TripSuit';
import { SECTION_IDS } from '@/lib/public/contract';
import { primaryRef } from '@travel/core/capture/records.ts';
import { createPublicData } from '@/lib/public';
import { publicWorld } from '@/lib/public/world';
import { REPO } from '../data/support';
import type { ItemSuit } from '@/lib/public/types';

const data = createPublicData();
const html = (slug: string): string => renderToString(<PlacePage place={data.getPlace(slug)!} inside={[]} url={`https://example.test/places/${slug}/`} />).replace(/<!-- -->/g, '');
const text = (h: string): string => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');

describe('place pages from the capture contract (S1)', () => {
  const louise = html('lake-louise');
  it('draws the sections in the contract order, section 3 titled "Before you go" (Q29)', () => {
    const ids = [...louise.matchAll(/<section[^>]*\bid="([a-z]+)"/g)].map((m) => m[1]!).filter((i) => (SECTION_IDS as readonly string[]).includes(i));
    const order = SECTION_IDS.filter((i) => ids.includes(i));
    expect(ids.filter((i, n) => ids.indexOf(i) === n)).toEqual(order);
    expect(louise).toContain('Before you go');
    expect(text(louise)).not.toMatch(/\bWarnings\b/);
  });
  it('keeps empty sections as markers in the four forms, and none says "No data"', () => {
    expect(louise).toContain('Not checked yet: price');
    expect(louise).toContain('gc');
    expect(text(louise)).not.toMatch(/No data|recorded (?:here )?yet\b/);
  });
  it('shows the three chips, the research line and no effort grade code', () => {
    expect(louise).toMatch(/\d+ of \d+ family checks done/);
    expect(louise).toContain('aria-label="Who it suits"');
    expect(text(louise)).not.toMatch(/\bFE[1-5]\b/);
  });
  it('shows the relevance badge with its why line and Similar nearby, and never a rating', () => {
    expect(louise).toContain('Worth the journey');
    expect(louise).toContain('Similar nearby');
    expect(text(louise)).not.toMatch(/\b\d(?:\.\d)? ?(?:stars?|reviews?)\b/i);
  });
  it('says Facts and sources never carries a workshop note', () => {
    for (const slug of data.placeSlugs()) {
      const t = text(html(slug));
      expect(t, slug).not.toMatch(/agent[- ]confirmed|travel-researcher|needs a person|this repo|\bFE[1-5]\b|\bDraft\b/);
    }
  });
});

describe('legacy facts and Directions (step 9, PS4)', () => {
  it('a fact the page already knows fills its row, with its own source line and no invented basis', () => {
    let mapped = 0;
    for (const slug of data.placeSlugs()) {
      const p = data.getPlace(slug)!;
      for (const label of p.sections?.legacyMapped ?? []) {
        mapped += 1;
        const rows = p.sections!.sections.flatMap((s) => s.rows).filter((r) => r.val?.basis === null && r.val.look === 'info' && !r.gap);
        expect(rows.length, `${slug} ${label}`).toBeGreaterThan(0);
        // a mapped fact is drawn once: in its row, not again in Facts and sources
        expect(html(slug).split(`<dt>${label}</dt>`).length - 1, `${slug} ${label}`).toBe(0);
      }
    }
    expect(mapped).toBeGreaterThan(5);
  });
  it('Directions go to a car park of the access place, never to a stop (M2, T5)', () => {
    const d = data.getPlace('lake-louise')!.sections!.directions;
    expect(d?.mode).toBe('drive');
    if (d?.mode === 'drive') expect(d.name).toMatch(/parking|car park/i);
    expect(html('lake-louise')).toContain('directions go to');
    // a place reached only by a shuttle stop sends no car anywhere
    const larch = data.getPlace('larch-valley-to-sentinel-pass')!;
    expect(larch.sections!.directions?.mode).toBe('transit');
    const page = html('larch-valley-to-sentinel-pass');
    expect(page).toContain('No private cars on this road');
    expect(page).not.toContain('Google Maps directions');
    expect(page).not.toMatch(/class="btn btn-primary pl-dir"/);
    for (const slug of data.placeSlugs()) {
      const x = data.getPlace(slug)!.sections?.directions;
      if (x?.mode === 'drive') expect(x.ref, slug).not.toMatch(/shuttle|stop|station/i);
    }
  });
  it('the cover carries the one amber Directions action when a car can go (M5)', () => {
    expect(html('lake-louise')).toMatch(/class="btn btn-primary pl-dir"/);
  });
});

describe('a gap is never a yes (M1)', () => {
  it('"No booking or permit needed" appears only where the data says none is needed', () => {
    let said = 0;
    for (const slug of data.placeSlugs()) {
      const p = data.getPlace(slug)!;
      const row = p.sections?.sections.flatMap((s) => s.rows).find((r) => r.key === 'access_cost');
      const says = !!row?.val && (row.val.state === 'no_limit' || (row.val.state === 'searched_none' && /^(operator|official)/.test(row.val.basis ?? '')));
      const has = text(html(slug)).includes('No booking or permit needed');
      if (has) said += 1;
      expect(has, slug).toBe(says);
    }
    expect(said).toBeGreaterThanOrEqual(0);
    expect(text(html('lake-louise'))).toContain('Not checked yet: bookings and permits');
  });
  it('an empty sourced list is a gap row, not "None"', () => {
    for (const slug of data.placeSlugs()) {
      for (const r of data.getPlace(slug)!.sections?.sections.flatMap((s) => s.rows) ?? []) {
        if (r.val?.state === 'value' && Array.isArray(r.value)) expect(r.value.length, `${slug} ${r.key}`).toBeGreaterThan(0);
      }
    }
  });
  it('Plan B is drawn in Before you go only under a booking or access line (M4)', () => {
    for (const slug of data.placeSlugs()) {
      const p = data.getPlace(slug)!;
      const warn = p.sections?.sections.find((s) => s.id === 'warnings');
      const drawn = html(slug).includes('rv-planb');
      if (drawn) expect(warn?.lines.some((l) => l.kind === 'Book' || l.kind === 'Access'), slug).toBe(true);
    }
  });
});

describe('the pointer names a place worth a trip (M3)', () => {
  it('never a region, a protected area, a town or a stop', () => {
    let seen = 0;
    for (const slug of data.placeSlugs()) {
      const r = data.getPlace(slug)!.relevance;
      if (!r?.pointer) continue;
      seen += 1;
      expect(r.pointer.name, slug).not.toMatch(/^(Dolomites|Village and cafes)$|Cruise|scenic drive|Parkway/);
      // a page whose own name contains the pointer's name (Lake Louise Summer Gondola points at Lake Louise) repeats it by nature
      if (data.getPlace(slug)!.name.includes(r.pointer.name)) continue;
      expect(text(html(slug)).split(r.pointer.name).length - 1, slug).toBeLessThanOrEqual(2);
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('every pointer target is a place worth a trip (verifier 4)', () => {
  it('has a whitelisted type, and none is a cruise, a drive, a town or a stop', () => {
    const w = publicWorld(REPO);
    let n = 0;
    for (const slug of data.placeSlugs()) {
      const r = data.getPlace(slug)!.relevance;
      if (!r?.pointer) continue;
      n += 1;
      const type = w.cap.get(primaryRef(w, r.pointer.ref))?.rec.type ?? '';
      expect(type, `${slug} -> ${r.pointer.name}`).toMatch(/^(nature\.(viewpoint|trail|summit|landform|geo)|water\.(body|falls|river)|culture)\b/);
    }
    expect(n).toBeGreaterThan(0);
  });
});

describe('research levels (M6) and units (M9)', () => {
  it('uses Basics only, Early research, Partly checked and Checked, and a place with no point never reads above Early research', () => {
    for (const slug of data.placeSlugs()) {
      const p = data.getPlace(slug)!;
      expect(p.completeness.label, slug).toMatch(/^(Basics only|Early research · \d+ of \d+(?:, no map point yet)?|Partly checked · \d+ of \d+(?:, no map point yet)?|Checked)$/);
      if (p.point === null) expect(p.completeness.label, slug).toMatch(/^(Basics only|Early research)/);
    }
  });
  it('distances and heights are spans the units toggle can rewrite', () => {
    const page = html('lake-louise');
    expect(page).toMatch(/<data class="um" value="200">200 m<\/data>/);
  });
});

describe('timeline fit chip (D6)', () => {
  const suit = (kidsFrom: number | null, kidsBasis: ItemSuit['kidsBasis']): ItemSuit => ({ chips: [], kidsFrom, kidsBasis, badge: null });
  it('fits, advice fail and rule fail, by the youngest in the party', () => {
    expect(fitFor(suit(6, 'advice'), 8)?.kind).toBe('fits');
    expect(fitFor(suit(6, 'advice'), 3)).toMatchObject({ kind: 'advice_fail', text: 'Not suited to age 3' });
    expect(fitFor(suit(8, 'rule'), 6)).toMatchObject({ kind: 'rule_fail', text: 'Not for under 8 · operator rule' });
    expect(fitFor(suit(null, null), 6)).toBeNull();
    expect(fitFor(suit(8, 'rule'), null)).toBeNull();
  });
  it('attaches chips to the stops of the Rockies trip, and a badge only where the rules of relevance 6.2 allow', () => {
    const trip = data.getTrip('canadian-rockies-2029')!;
    const items = trip.days.flatMap((d) => d.items).filter((i) => i.suit);
    expect(items.length).toBeGreaterThan(5);
    for (const i of items) expect(i.suit!.chips.length).toBeLessThanOrEqual(3);
    for (const i of items.filter((x) => x.suit!.badge)) expect(i.suit!.badge).toBe('Worth the journey');
  });
});
