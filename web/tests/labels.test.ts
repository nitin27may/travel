import { describe, expect, it } from 'vitest';
import { loadPlaces } from '@/lib/data/places';
import { placeBadges } from '@/lib/entities/descriptors/place';
import { KID_ICONS, KID_LABELS } from '@/lib/entities/labels';

describe('kid fit labels', () => {
  it('pins the four honest labels', () => {
    expect(KID_LABELS).toEqual({ yes: 'Kid friendly', 'strong-kid': 'Strong kids only', no: 'Not for young kids', unknown: 'Not assessed' });
  });

  it('strong-kid has its own glyph, so the cue is not colour or text alone', () => {
    expect(KID_ICONS['strong-kid']).not.toBe(KID_ICONS.yes);
  });

  it('shows no kid badge for unknown, and the right text for the rest', () => {
    const base = loadPlaces()[0];
    const kidBadge = (kid: string) => placeBadges({ ...base, kid_fit: kid }).find((b) => b.tone === 'kid');
    expect(kidBadge('unknown')).toBeUndefined();
    expect(kidBadge('yes')?.text).toBe('Kid friendly');
    expect(kidBadge('strong-kid')?.text).toBe('Strong kids only');
    expect(kidBadge('no')?.text).toBe('Not for young kids');
  });
});
