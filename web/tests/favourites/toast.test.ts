import { describe, expect, it } from 'vitest';
import * as say from '@/lib/favourites/toast';

// The words are the spec's (mine-and-bar-spec 7); each is pinned so a rewrite is a decision, not a drift. Never "saved" (visitor spec 3).
describe('the heart\'s words', () => {
  it('first favourite, sign-in on and off', () => {
    expect(`${say.FIRST_SIGN_IN_TEXT} Sign in to keep them on every device.`).toBe(say.firstNote(true));
    expect(say.firstNote(true)).toBe('Added to favourites on this device. Sign in to keep them on every device.');
    expect(say.firstNote(false)).toBe('Added to favourites. They are kept in this browser.');
  });
  it('later favourites, removal and the cap', () => {
    expect(say.added('Moraine Lake')).toBe('Added Moraine Lake to favourites');
    expect(say.removed('Moraine Lake')).toBe('Removed Moraine Lake from favourites');
    expect(say.capReached).toBe('You have 500 favourites, the most we keep. Remove one to add another.');
  });
  it('times: 8 s for the first note, 6 s with Undo', () => {
    expect(say.FIRST_TOAST).toBe(8000);
    expect(say.UNDO_TOAST).toBe(6000);
  });
  it('never says "saved", never an exclamation mark', () => {
    for (const v of Object.values(say)) if (typeof v === 'string') expect(v).not.toMatch(/\bsaved?\b|!/i);
    for (const s of [say.added('X'), say.removed('X'), say.cannotRestore('X')]) expect(s).not.toMatch(/\bsaved?\b|!/i);
  });
});

import { FAVOURITES_CAP } from '@travel/core/schema/favourites.ts';
describe('the cap written in the toast module', () => {
  it('equals the core constant (the module does not import core: it would pull Zod into the heart chunk)', () => expect(say.CAP).toBe(FAVOURITES_CAP));
});
