import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPIES_KEY as CORE_COPIES_KEY, copyItem, readCopies } from '@travel/core/schema/copies.ts';
import { FAV_LOCAL_KEY, favItem } from '@travel/core/schema/favourites.ts';
import { readFavourites } from '@travel/core/favourites/envelope.ts';
import { hasNewItems } from '@/lib/mine/dot';
import { COPIES_KEY, FAV_KEY, SEEN_KEY } from '@/lib/mine/keys';
import { PLANS_KEY } from '@/lib/plan/keys';
import { PLAN_DRAFTS_SCHEMA, readPlanDrafts } from '@travel/core/schema/plan-draft.ts';
import { sampleDraft } from '../../../core/test/plan/helpers';

// web/lib/mine/keys.ts copies the two storage keys as literals (the bar must not import Zod), and dot.ts reads two item fields by name.
// This file is the guard: if core renames a key or a field, the dot would go dark without an error.

const copy = (at: string) => ({
  id: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03',
  adults: 2, children: [], profile: null, overrides: {}, added: [], copiedAt: at,
});
const copies = (at: string) => JSON.stringify({ schema: 'copies/1', items: [copy(at)], noteSeen: null, snoozedUntil: null, merged: {} });
const fav = (at: string) => ({ space: 'place', slug: 'lago-di-braies', ref: null, name: 'Lago di Braies', kind: 'lake', cc: 'IT', favouredAt: at, unlistedAt: null });
const favourites = (at: string) =>
  JSON.stringify({ schema: 'favourites/1', items: [fav(at)], noteSeen: null, snoozedUntil: null, snoozedAtCount: null, merged: {}, pending: [] });

function stubStorage(kv: Record<string, string>) {
  const m = new Map(Object.entries(kv));
  vi.stubGlobal('window', { localStorage: { getItem: (k: string) => m.get(k) ?? null } });
}

describe('Mine storage keys and fields stay pinned to core', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('COPIES_KEY equals the core constant', () => expect(COPIES_KEY).toBe(CORE_COPIES_KEY));
  it('FAV_KEY equals the core favourites key', () => expect(FAV_KEY).toBe(FAV_LOCAL_KEY));
  it('the timestamp fields dot.ts reads are keys of the core item schemas', () => {
    expect(Object.keys(copyItem.shape)).toContain('copiedAt');
    expect(Object.keys(favItem.shape)).toContain('favouredAt');
  });

  describe('hasNewItems on valid envelopes', () => {
    beforeEach(() => {
      // the fixtures really are valid core envelopes, so the pin is on real shapes
      expect(readCopies(copies('2026-10-20T10:00:00.000Z')).ok).toBe(true);
      expect(readFavourites(favourites('2026-10-22T10:00:00.000Z')).ok).toBe(true);
    });
    it('is true when seen is older than a copy or a favourite', () => {
      stubStorage({ [COPIES_KEY]: copies('2026-10-20T10:00:00.000Z'), [SEEN_KEY]: '2026-10-19T00:00:00.000Z' });
      expect(hasNewItems()).toBe(true);
      stubStorage({ [FAV_KEY]: favourites('2026-10-22T10:00:00.000Z'), [SEEN_KEY]: '2026-10-21T00:00:00.000Z' });
      expect(hasNewItems()).toBe(true);
    });
    it('is false when seen is newer than both', () => {
      stubStorage({
        [COPIES_KEY]: copies('2026-10-20T10:00:00.000Z'),
        [FAV_KEY]: favourites('2026-10-22T10:00:00.000Z'),
        [SEEN_KEY]: '2026-10-23T00:00:00.000Z',
      });
      expect(hasNewItems()).toBe(false);
    });

  describe('hasNewItems on builder drafts', () => {
    const drafts = (...items: ReturnType<typeof sampleDraft>[]) => JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA, items });
    const at = (created: string) => sampleDraft({ lastBuild: null, createdAt: created, updatedAt: '2026-10-25T00:00:00.000Z' });
    afterEach(() => vi.unstubAllGlobals());

    it('PLANS_KEY is read as a real drafts envelope', () => {
      expect(readPlanDrafts(drafts(at('2026-10-20T10:00:00.000Z'))).ok).toBe(true);
    });
    it('counts a draft with no build, like a copy', () => {
      stubStorage({ [PLANS_KEY]: drafts(at('2026-10-20T10:00:00.000Z')), [SEEN_KEY]: '2026-10-19T00:00:00.000Z' });
      expect(hasNewItems()).toBe(true);
      stubStorage({ [PLANS_KEY]: drafts(at('2026-10-20T10:00:00.000Z')), [SEEN_KEY]: '2026-10-21T00:00:00.000Z' });
      expect(hasNewItems()).toBe(false);
    });
    it('ignores a built draft, and an edit (updatedAt) of an unbuilt one after Mine was seen', () => {
      const built = sampleDraft({ createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z' });
      expect(built.lastBuild).not.toBeNull();
      stubStorage({ [PLANS_KEY]: drafts(built), [SEEN_KEY]: '2026-10-19T00:00:00.000Z' });
      expect(hasNewItems()).toBe(false);
      stubStorage({ [PLANS_KEY]: drafts(at('2026-10-20T10:00:00.000Z')), [SEEN_KEY]: '2026-10-22T00:00:00.000Z' });
      expect(hasNewItems()).toBe(false);
    });
    it('a damaged drafts value gives no dot', () => {
      stubStorage({ [PLANS_KEY]: '{not json', [SEEN_KEY]: '2026-10-19T00:00:00.000Z' });
      expect(hasNewItems()).toBe(false);
    });
  });
  });
});
