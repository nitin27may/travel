import { describe, expect, it } from 'vitest';
import { checkName, NAME_MAX } from '@/lib/account/name';

describe('checkName (spec 4.2)', () => {
  it('trims, collapses spaces and NFC-normalises', () => {
    expect(checkName('  Nitin   Singh ')).toEqual({ ok: true, name: 'Nitin Singh' });
    expect(checkName('José')).toEqual({ ok: true, name: 'José' });
  });
  it('allows letters of any script, digits and simple punctuation', () => {
    for (const n of ["O'Brien-Smith, Jr.", 'Zoë 2', '李小龍', 'Ünal Ağa']) expect(checkName(n).ok).toBe(true);
  });
  it('1 to 60 characters', () => {
    expect(checkName('a'.repeat(NAME_MAX))).toMatchObject({ ok: true });
    expect(checkName('a'.repeat(NAME_MAX + 1))).toEqual({ ok: false, reason: 'too_long' });
    expect(checkName('a'.repeat(5000))).toEqual({ ok: false, reason: 'too_long' });
    expect(checkName('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkName(undefined)).toEqual({ ok: false, reason: 'empty' });
  });
  it('refuses markup, addresses, links and control characters', () => {
    for (const n of ['<b>x</b>', 'a@b.co', 'see/this', 'http://x', 'a\u0000b', 'a‮b', 'x_y', 'smile \u{1F600}']) {
      expect(checkName(n)).toEqual({ ok: false, reason: 'chars' });
    }
  });
});
