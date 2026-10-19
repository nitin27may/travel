import { describe, expect, it } from 'vitest';
import { placeBadges } from '@/lib/entities/descriptors/place';
import { KID_ICONS, KID_LABELS } from '@/lib/entities/labels';
import { placeRows } from './places/support';

describe('kid fit labels', () => {
  it('pins the four honest labels', () => {
    expect(KID_LABELS).toEqual({ yes: 'Easy with kids', 'strong-kid': 'Older or strong kids', no: 'Not for kids', unknown: 'Not checked yet' });
  });

  it('strong-kid has its own glyph, so the cue is not colour or text alone', () => {
    expect(KID_ICONS['strong-kid']).not.toBe(KID_ICONS.yes);
  });

  it('shows no kid badge for unknown, and the right text for the rest', () => {
    const base = placeRows()[0];
    const kidBadge = (kid: string) => placeBadges({ ...base, kids_from: null, kids_basis: null, kid_fit: kid }).find((b) => b.tone === 'kid');
    // nobody has checked: the dashed "Not checked yet" chip (a muted tone), never a kid label
    expect(kidBadge('unknown')).toBeUndefined();
    expect(placeBadges({ ...base, kids_from: null, kids_basis: null, kid_fit: 'unknown' }).some((b) => b.value === 'gap' && b.text === 'Not checked yet')).toBe(true);
    expect(kidBadge('yes')?.text).toBe('Easy with kids');
    expect(kidBadge('strong-kid')?.text).toBe('Older or strong kids');
    expect(kidBadge('no')?.text).toBe('Not for kids');
  });

  it('draws the kids chip as a rule, advice or gap and the effort name, plus at most one relevance chip', () => {
    const base = placeRows()[0];
    const rule = placeBadges({ ...base, kids_from: 8, kids_basis: 'rule', effort: null, badge: null });
    expect(rule.find((b) => b.value === 'rule')?.text).toBe('Age 8+');
    const advice = placeBadges({ ...base, kids_from: 6, kids_basis: 'advice', effort: 'Moderate', badge: 'Worth the journey' });
    expect(advice.find((b) => b.value === 'advice')?.text).toBe('From about 6');
    expect(advice.find((b) => b.value === 'effort')?.text).toBe('Moderate');
    expect(advice.filter((b) => b.value === 'relevance').map((b) => b.text)).toEqual(['Worth the journey']);
    expect(advice.some((b) => /FE\d/.test(b.text))).toBe(false);
  });
});
