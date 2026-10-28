// Review ACCT-PSEC S5: the name is re-read before it is rendered (spec 4.3), the joiners Persian and Indic names need are allowed, mark
// stacks are capped, and the header's initial never splits a character. Every invisible character is written as an escape.
import { describe, expect, it } from 'vitest';
import { checkName, displayName, initialOf, NAME_MAX } from '@/lib/account/name';

const ZWNJ = '‌';
const ZWJ = '‍';
const PERSIAN = `می${ZWNJ}خواهم`; // mi-khaham, with the non-joiner after the prefix
const DEVANAGARI_EYELASH = `कर्${ZWJ}नाटक`; // ra + virama + ZWJ + na
const MALAYALAM_CONJUNCT = `ക്${ZWJ}ഷ`;
const MALAYALAM_CHILLU_END = `അവന്${ZWJ}`; // a chillu written as na + virama + ZWJ at the end of a word
const marks = (n: number) => '̀́̂̃̄̅̆'.slice(0, n);

describe('checkName: joiners and mark stacks', () => {
  it('allows ZWNJ and ZWJ between letters (Persian, Devanagari, Malayalam) and ZWJ after a virama at a word end', () => {
    for (const n of [PERSIAN, DEVANAGARI_EYELASH, MALAYALAM_CONJUNCT, MALAYALAM_CHILLU_END, `${MALAYALAM_CHILLU_END} Menon`]) {
      expect(checkName(n), JSON.stringify(n)).toMatchObject({ ok: true });
    }
  });
  it('refuses a joiner at the start, after a space or punctuation, doubled, at the end after a letter, and every other format character', () => {
    for (const n of [`${ZWJ}Ana`, `Ana ${ZWNJ}Lee`, `O'${ZWJ}Brien`, `Ana${ZWNJ}${ZWNJ}Lee`, `Ana${ZWNJ}`, 'Ana​Lee', 'Ana⁦Lee', 'a‮b']) {
      expect(checkName(n), JSON.stringify(n)).toEqual({ ok: false, reason: 'chars' });
    }
  });
  it('caps combining marks at 4 on one base character', () => {
    // q has no precomposed form, so NFC leaves every mark on it
    expect(checkName(`Zq${marks(4)}e`)).toMatchObject({ ok: true });
    expect(checkName(`Zq${marks(5)}e`)).toEqual({ ok: false, reason: 'chars' });
  });
});

describe('displayName (the name as rendered)', () => {
  it('cuts to 60 code points, NFC, and collapses spaces', () => {
    expect([...displayName('\u{1D49C}'.repeat(500))].length).toBe(NAME_MAX);
    expect(displayName('a'.repeat(10_000)).length).toBe(NAME_MAX);
    expect(displayName('  José   Ruiz \n')).toBe('José Ruiz');
  });
  it('drops bidi overrides, zero-width spaces, controls and stray joiners; keeps the joiners a script needs', () => {
    expect(displayName('Ana‮gnirts‬')).toBe('Anagnirts');
    expect(displayName('A​na\u0000Lee')).toBe('Ana Lee');
    expect(displayName(`${ZWJ}Ana${ZWNJ} Lee`)).toBe('Ana Lee');
    expect(displayName(PERSIAN)).toBe(PERSIAN);
    expect(displayName(MALAYALAM_CHILLU_END)).toBe(MALAYALAM_CHILLU_END);
  });
  it('caps a mark stack at 4 and answers empty for a non-string', () => {
    expect(displayName(`Zq${'̀'.repeat(40)}e`)).toBe(`Zq${'̀'.repeat(4)}e`);
    expect(displayName(null)).toBe('');
    expect(displayName(undefined)).toBe('');
    expect(displayName(42)).toBe('');
  });
});

describe('initialOf (the header avatar)', () => {
  it('takes the first grapheme, never half a surrogate pair', () => {
    expect(initialOf('\u{1D49C}lice', 'a@x.test')).toBe('\u{1D49C}');
    expect(initialOf('\u{1D49C}lice', null)).not.toBe('\u{1D49C}lice'.charAt(0)); // charAt(0) answers the lone high surrogate
    expect(initialOf('nitin', 'a@x.test')).toBe('N');
    expect(initialOf('q́uinn', null)).toBe('Q́');
    expect(initialOf('\u{1F600}x', null)).toBe('\u{1F600}');
  });
  it('falls back to the email, then ?; a name of only invisibles counts as none', () => {
    expect(initialOf('', 'zed@x.test')).toBe('Z');
    expect(initialOf('​‮', 'zed@x.test')).toBe('Z');
    expect(initialOf(null, null)).toBe('?');
  });
});
