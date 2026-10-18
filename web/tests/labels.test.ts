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
    const kidBadge = (kid: string) => placeBadges({ ...base, kid_fit: kid }).find((b) => b.tone === 'kid');
    expect(kidBadge('unknown')).toBeUndefined();
    expect(kidBadge('yes')?.text).toBe('Easy with kids');
    expect(kidBadge('strong-kid')?.text).toBe('Older or strong kids');
    expect(kidBadge('no')?.text).toBe('Not for kids');
  });
});
