import { describe, expect, it } from 'vitest';
import { daysUntil, urgency } from '@/components/ui/urgency';

// tokens.md 3.1, worked on 18 Oct 2026
const now = new Date(2026, 9, 18, 10, 0);

describe('urgency (one rule, tokens.md 3.1)', () => {
  it('counts whole local days', () => {
    expect(daysUntil('2026-10-18', now)).toBe(0);
    expect(daysUntil('2026-10-31', now)).toBe(13);
    expect(daysUntil('2026-10-17', now)).toBe(-1);
  });
  it('urgent: today to day 7, or missed', () => {
    expect(urgency({ due: '2026-10-18', now })).toBe('urgent');
    expect(urgency({ due: '2026-10-25', now })).toBe('urgent');
    expect(urgency({ due: '2026-10-01', now })).toBe('urgent');
  });
  it('caution: 8 to 30 days', () => {
    expect(urgency({ due: '2026-10-26', now })).toBe('caution');
    expect(urgency({ due: '2026-10-31', now })).toBe('caution'); // Patagonia, 13 days
    expect(urgency({ due: '2026-11-17', now })).toBe('caution'); // day 30
  });
  it('neutral beyond 30 days or with no date', () => {
    expect(urgency({ due: '2026-11-18', now })).toBe('neutral');
    expect(urgency({ due: '2027-03-15', now })).toBe('neutral'); // Ortisei stay
    expect(urgency({ now })).toBe('neutral');
  });
  it('a window opening within 48 hours is urgent; open now is caution; later is neutral', () => {
    expect(urgency({ windowOpens: new Date(2026, 9, 19, 9, 0), now })).toBe('urgent'); // Elora tubing slot
    expect(urgency({ windowOpens: new Date(2027, 5, 15), now })).toBe('neutral'); // Tre Cime toll slot
    expect(urgency({ windowOpen: true, now })).toBe('caution');
  });
});
