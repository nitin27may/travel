import { describe, expect, it } from 'vitest';
import type { PlanOp } from '@travel/core/plan/ops.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { copyWithDraft, findCopy, openTrip, saveOps, syncWord, type AccountHandle } from '@/lib/trip-edit/open';
import { changeCount, changesLine, endOf, kickerWords } from '@/lib/trip-edit/marks';
import { copy, ID_A, ID_B, items, memory } from './helpers';

// The document source on the device (STEP2-T1 step 2): a copy read as a template document, the six edits the page has, written back into
// the same copy item. The account path is the EM-2 engine (tests/mine/sync.test.ts); here a fake handle pins what this module asks of it.

const op = (o: Record<string, unknown>): PlanOp => ({ id: `o-${Math.random().toString(36).slice(2, 10)}`, ...o }) as PlanOp;

describe('openTrip', () => {
  it('reads a device copy as a template document and says where it came from', () => {
    const r = openTrip(ID_A, { storage: memory([copy()]) });
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.where).toBe('device');
    expect(r.doc.id).toBe(ID_A);
    expect(r.doc.template?.trip).toBe('dolomites-2027');
    expect(r.doc.template?.overrides).toEqual({ '2': 'B' });
    expect(r.doc.travellers).toEqual({ adults: 2, children: [6] });
  });

  it('answers missing for an id that is not here, a malformed id and an empty device, with the same answer (no existence signal)', () => {
    expect(openTrip(ID_B, { storage: memory([copy()]) })).toEqual({ kind: 'missing' });
    expect(openTrip('not-an-id', { storage: memory([copy()]) })).toEqual({ kind: 'missing' });
    expect(openTrip(ID_A, { storage: memory() })).toEqual({ kind: 'missing' });
  });

  it('answers newer for a list written by a newer version, and never writes it', () => {
    const s = memory();
    s.setItem('travel.copies.local', JSON.stringify({ schema: 'copies/2', items: [] }));
    expect(findCopy(s, ID_A)).toEqual({ kind: 'newer' });
    expect(saveOps(ID_A, [op({ kind: 'setTitle', title: 'x' })], { storage: s })).toEqual({ ok: false, reason: 'newer' });
    expect(s.getItem('travel.copies.local')).toBe(JSON.stringify({ schema: 'copies/2', items: [] }));
  });

  it('prefers the account document when the engine holds one', () => {
    const doc = copyToPlanDraft(copy()) as { success: true; data: PlanDraft };
    const account: AccountHandle = { view: (id) => (id === ID_A ? doc.data : null), edit: () => ({ ok: true }) };
    const r = openTrip(ID_A, { storage: memory(), account });
    expect(r.kind === 'ok' && r.where).toBe('account');
  });

  it('uses the facts for a copy moved from the old key (no country, no days)', () => {
    const old = copy({ cc: null, days: null });
    expect(openTrip(ID_A, { storage: memory([old]) })).toEqual({ kind: 'missing' });
    const r = openTrip(ID_A, { storage: memory([old]), facts: () => ({ cc: 'IT', days: 14 }) });
    expect(r.kind).toBe('ok');
  });
});

describe('saveOps on the device', () => {
  it('saves a title, the dates and the party into the same copy item and keeps its photo, id and copy date', () => {
    const s = memory([copy()]);
    const r = saveOps(
      ID_A,
      [
        op({ kind: 'setTitle', title: 'Dolomites with Kai' }),
        op({ kind: 'setDates', start: '2027-07-10' }),
        op({ kind: 'setParty', travellers: { adults: 3, children: [6, 9] }, profile: { party: 'family', youngest: 6, pace: 'relaxed', adults: 3, walk: null, split: false }, pace: 'relaxed' }),
      ],
      { storage: s },
    );
    expect(r).toEqual({ ok: true });
    const [c] = items(s);
    expect(c).toMatchObject({ id: ID_A, title: 'Dolomites with Kai', start: '2027-07-10', adults: 3, children: [6, 9], photo: '/img/abc123-960.webp', copiedAt: '2026-10-20T10:00:00.000Z', slug: 'dolomites-2027' });
    expect(c.profile).toMatchObject({ pace: 'relaxed', adults: 3 });
  });

  it('saves a version, an added place and removes the added place again', () => {
    const s = memory([copy()]);
    expect(saveOps(ID_A, [op({ kind: 'setVariant', day: 5, variant: 'C' })], { storage: s })).toEqual({ ok: true });
    expect(items(s)[0].overrides).toEqual({ '2': 'B', '5': 'C' });
    expect(saveOps(ID_A, [op({ kind: 'addPlace', day: 5, ref: 'place/moraine-lake' })], { storage: s })).toEqual({ ok: true });
    expect(items(s)[0].added).toEqual([{ day: 5, placeSlug: 'moraine-lake' }]);
    const doc = openTrip(ID_A, { storage: s });
    const entry = doc.kind === 'ok' ? doc.doc.template!.added[0] : null;
    expect(saveOps(ID_A, [op({ kind: 'removePlace', added: entry!.op })], { storage: s })).toEqual({ ok: true });
    expect(items(s)[0].added).toEqual([]);
    expect(saveOps(ID_A, [op({ kind: 'setVariant', day: 5, variant: null })], { storage: s })).toEqual({ ok: true });
    expect(items(s)[0].overrides).toEqual({ '2': 'B' });
  });

  it('writes nothing when one operation does not apply (all or nothing)', () => {
    const s = memory([copy()]);
    const before = s.raw();
    const r = saveOps(ID_A, [op({ kind: 'setTitle', title: 'New name' }), op({ kind: 'removePlace', added: 'o-nothere' })], { storage: s });
    expect(r).toEqual({ ok: false, reason: 'invalid' });
    expect(s.raw()).toBe(before);
  });

  it('leaves the other copies as they were', () => {
    const other = copy({ id: ID_B, slug: 'iceland-2028', title: 'Iceland' });
    const s = memory([copy(), other]);
    expect(saveOps(ID_A, [op({ kind: 'setTitle', title: 'Renamed' })], { storage: s })).toEqual({ ok: true });
    expect(items(s).find((c) => c.id === ID_B)).toEqual(other);
  });

  it('a missing trip is missing, not a write', () => {
    const s = memory([copy()]);
    expect(saveOps(ID_B, [op({ kind: 'setTitle', title: 'x' })], { storage: s })).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('saveOps in the account', () => {
  it('hands the operations to the engine (outbox first) and maps its refusals', () => {
    const doc = copyToPlanDraft(copy()) as { success: true; data: PlanDraft };
    const seen: PlanOp[][] = [];
    const ok: AccountHandle = { view: () => doc.data, edit: (_id, ops) => (seen.push([...ops]), { ok: true }) };
    const ops = [op({ kind: 'setTitle', title: 'A' })];
    expect(saveOps(ID_A, ops, { storage: memory(), account: ok })).toEqual({ ok: true });
    expect(seen).toEqual([ops]);
    const full: AccountHandle = { ...ok, edit: () => ({ ok: false, reason: 'full' }) };
    expect(saveOps(ID_A, ops, { storage: memory(), account: full })).toEqual({ ok: false, reason: 'full' });
    const gone: AccountHandle = { ...ok, edit: () => ({ ok: false, reason: 'unknown' }) };
    expect(saveOps(ID_A, ops, { storage: memory(), account: gone })).toEqual({ ok: false, reason: 'missing' });
  });
});

describe('copyWithDraft and the words', () => {
  it('a built document leaves the copy as it was', () => {
    const c = copy();
    const built = { ...(copyToPlanDraft(c) as { success: true; data: PlanDraft }).data, template: undefined } as PlanDraft;
    expect(copyWithDraft(c, built)).toBe(c);
  });

  it('the sync word never says Saved', () => {
    expect(syncWord('device', 'quiet')).toBe('On this device');
    expect(syncWord('account', 'quiet')).toBe('In your account');
    expect(syncWord('account', 'syncing')).toBe('Syncing');
    expect(syncWord('account', 'offline')).toBe('Not synced yet');
    expect(syncWord('account', 'retry')).toBe('Not synced · Retry');
    for (const w of ['device', 'account'] as const) for (const s of ['quiet', 'syncing', 'offline', 'retry', 'device'] as const) expect(syncWord(w, s)).not.toMatch(/saved/i);
  });

  it('counts the changes from our plan and words them', () => {
    const d = (openTrip(ID_A, { storage: memory([copy({ added: [{ day: 3, placeSlug: 'x-lake' }] })]) }) as { kind: 'ok'; doc: PlanDraft }).doc;
    expect(changeCount(d)).toBe(2);
    expect(changesLine(2)).toBe('2 changes from our plan');
    expect(changesLine(1)).toBe('1 change from our plan');
    expect(changesLine(0)).toBe('');
    expect(kickerWords(d, 'Dolomites')).toBe('Your copy · from our Dolomites trip');
    expect(endOf(d)).toBe('2027-07-16');
  });
});
