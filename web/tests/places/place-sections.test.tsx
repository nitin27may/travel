import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlacePage } from '@/components/places/PlacePage';
import { fitFor } from '@/components/suit/TripSuit';
import { SECTION_IDS } from '@/lib/public/contract';
import { createPublicData } from '@/lib/public';
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
    expect(louise).toContain('su-gapchip');
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
  it('Directions go to the access place when the record has no car park of its own', () => {
    const d = data.getPlace('lake-louise')!.sections!.directions;
    expect(d).not.toBeNull();
    expect(d!.name).toMatch(/parking|stop/i);
    expect(html('lake-louise')).toContain(`directions go to ${d!.name}`);
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
