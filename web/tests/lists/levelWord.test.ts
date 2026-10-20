import { describe, expect, it } from 'vitest';
import { LEVEL_WORDS, levelLabel } from '@/lib/public/levelWord';
import { createPublicData } from '@/lib/public';

// Review 4.29: "Partly checked · 25 of 25" contradicted itself. The level word and the count come from one scope: a "Partly" never
// carries a full count, and "Checked" only stands on a full one.
describe('levelLabel', () => {
  it('Partly checked counts the open checks after "of", so it never reads as a full count', () => {
    expect(levelLabel('usable', 25, 25, false, 4)).toBe('Partly checked · 25 of 29');
    expect(levelLabel('usable', 12, 15, false, 23)).toBe('Partly checked · 12 of 38');
    expect(levelLabel('usable', 12, 15)).toBe('Partly checked · 12 of 15');
  });

  it('a full count with nothing open reads Checked, and Checked needs a full count', () => {
    expect(levelLabel('usable', 25, 25, false, 0)).toBe(LEVEL_WORDS.complete);
    expect(levelLabel('complete', 25, 25)).toBe(LEVEL_WORDS.complete);
    expect(levelLabel('complete', 20, 25)).toBe('Partly checked · 20 of 25');
  });

  it('early research and basics keep their count, and a place with no point never reads above Early research', () => {
    expect(levelLabel('draft', 20, 32)).toBe('Early research · 20 of 32');
    expect(levelLabel('draft', 3, 32)).toBe('Basics only');
    expect(levelLabel('complete', 25, 25, true)).toBe('Early research · 25 of 25, no map point yet');
    expect(levelLabel('usable', 10, 12, true, 3)).toBe('Early research · 10 of 12, no map point yet');
  });
});

describe('the words on real places', () => {
  const data = createPublicData();
  const slugs = data.placeSlugs();
  const words = (label: string) => {
    const m = /^(Partly checked|Early research) · (\d+) of (\d+)/.exec(label);
    return m ? { word: m[1]!, n: Number(m[2]), of: Number(m[3]) } : null;
  };

  it('no card or page says Partly checked with a full count, or Checked with a count that is not full', () => {
    let partly = 0;
    for (const slug of slugs) {
      const c = data.getPlace(slug)!.completeness;
      const w = words(c.label);
      if (w?.word === 'Partly checked') {
        partly += 1;
        expect(w.n, `${slug}: ${c.label}`).toBeLessThan(w.of);
      }
      if (c.label === LEVEL_WORDS.complete) expect(c.passed, slug).toBeGreaterThanOrEqual(c.total);
    }
    expect(partly).toBeGreaterThan(0);
  });

  it('the list rows carry the same words as the pages', () => {
    for (const card of data.listPlaces()) expect(card.completeness.label, card.slug).toBe(data.getPlace(card.slug)!.completeness.label);
  });
});
