import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_COPIES_KEY, LEGACY_MOVED_KEY, memoryStorage, readCopies, COPIES_KEY } from '@travel/core/schema/copies.ts';
import type { CopyInput, StorageLike } from '@travel/core/schema/copies.ts';
import { PLAN_DRAFTS_SCHEMA } from '@travel/core/schema/plan-draft.ts';
import { moveLegacyOnce, saveCopy } from '@/lib/mine/copies';
import { DRAFT_CHIP, DRAFT_CLOSED_CHIP, deviceCount, deviceRowId, groupDevice, isDraftRow } from '@/lib/mine/deviceList';
import { PLANS_KEY, draftHref } from '@/lib/plan/keys';
import { hasDeviceDrafts, readDeviceDrafts, removeDeviceDraft } from '@/lib/plan/device';
import { DraftRow } from '@/components/mine/DraftRow';
import { sampleDraft } from '../../../core/test/plan/helpers';

// STEP2-P2: one Mine list for the copies and the plans the builder keeps on this device. Each trip is listed once; the device keeps
// `copies/2` where /t/ and the sync engine read it, and the builder's `plan-drafts/1` where the builder writes it.

const TODAY = '2026-10-28';
const ID_A = '2d9f6a3e-1b8c-4f2a-8e47-0a1b2c3d4e5f';
const ID_B = '3e0a7b4f-2c9d-4a3b-9f58-1b2c3d4e5f6a';
const copy = (slug: string, o: Partial<CopyInput> = {}): CopyInput => ({
  slug, title: slug, days: 7, cc: null, photo: null, start: '2027-07-03', adults: 2, children: [], profile: null, overrides: {}, added: [], ...o,
});
const putDrafts = (s: StorageLike, ...items: unknown[]) => s.setItem(PLANS_KEY, JSON.stringify({ schema: PLAN_DRAFTS_SCHEMA, items }));
const unbuilt = (id = ID_A) => sampleDraft({ id, title: 'Alps loop', nights: 3, lastBuild: null });

let s: StorageLike;
beforeEach(() => {
  s = memoryStorage();
  vi.stubGlobal('window', { dispatchEvent: () => true });
});
afterEach(() => vi.unstubAllGlobals());

const copies = (st: StorageLike) => {
  const r = readCopies(st.getItem(COPIES_KEY));
  if (!r.ok) throw new Error(r.reason);
  return r.envelope.items;
};

describe('the one device list', () => {
  it('a device with three copies and one draft lists four rows, once each', () => {
    for (const slug of ['a-trip', 'b-trip', 'c-trip']) saveCopy(s, copy(slug));
    putDrafts(s, unbuilt());
    const d = readDeviceDrafts(s);
    if (!d.ok) throw new Error(d.reason);
    const g = groupDevice(copies(s), d.items, TODAY);
    const rows = [...g.upcoming, ...g.nodate, ...g.past];
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map(deviceRowId)).size).toBe(4);
    expect(rows.filter(isDraftRow)).toHaveLength(1);
    expect(deviceCount(copies(s), d.items)).toBe(4);
  });

  it('a document held under both keys is listed once (the copy wins)', () => {
    saveCopy(s, copy('a-trip'));
    const id = copies(s)[0]!.id;
    putDrafts(s, unbuilt(), { ...unbuilt(), id });
    const d = readDeviceDrafts(s);
    if (!d.ok) throw new Error(d.reason);
    const g = groupDevice(copies(s), d.items, TODAY);
    const ids = [...g.upcoming, ...g.nodate, ...g.past].map(deviceRowId);
    expect(ids.filter((x) => x === id)).toHaveLength(1);
    expect(ids).toHaveLength(2);
    expect(deviceCount(copies(s), d.items)).toBe(2);
  });

  it('the old key still moves once and the move is idempotent: reading twice lists the same rows', () => {
    s.setItem(LEGACY_COPIES_KEY, JSON.stringify([{ slug: 'old-trip', start: '2027-05-01', adults: 2, children: [] }]));
    const first = moveLegacyOnce(s);
    const again = moveLegacyOnce(s);
    expect(first.status).toBe('moved');
    expect(again.status).not.toBe('moved');
    expect(s.getItem(LEGACY_MOVED_KEY)).not.toBeNull();
    expect(copies(s)).toHaveLength(1);
    putDrafts(s, unbuilt());
    const d = readDeviceDrafts(s);
    if (!d.ok) throw new Error(d.reason);
    expect(deviceCount(copies(s), d.items)).toBe(2);
  });

  it('puts an undated draft in No date and a dated one among the others by start', () => {
    saveCopy(s, copy('soon', { start: '2026-12-01' }));
    putDrafts(s, unbuilt(ID_A), { ...unbuilt(ID_B), start: '2026-11-15', month: 11 });
    const d = readDeviceDrafts(s);
    if (!d.ok) throw new Error(d.reason);
    const g = groupDevice(copies(s), d.items, TODAY);
    expect(g.upcoming.map((r) => r.title)).toEqual(['Alps loop', 'soon']);
    expect(g.nodate.map(deviceRowId)).toEqual([ID_A]);
  });
});

describe('the builder drafts reader', () => {
  it('reads nothing when the key is absent, and leaves an unreadable list as it is', () => {
    expect(hasDeviceDrafts(s)).toBe(false);
    expect(readDeviceDrafts(s)).toEqual({ ok: true, items: [] });
    s.setItem(PLANS_KEY, '{nope');
    expect(readDeviceDrafts(s)).toMatchObject({ ok: false, reason: 'corrupt' });
    expect(s.getItem(PLANS_KEY)).toBe('{nope');
    expect(removeDeviceDraft(s, ID_A)).toEqual({ ok: false });
    expect(s.getItem(PLANS_KEY)).toBe('{nope');
  });

  it('a draft with no lastBuild is "Draft · ready to build" and opens the builder on stage 4; the address matches the builder keys file', () => {
    putDrafts(s, unbuilt());
    const d = readDeviceDrafts(s);
    if (!d.ok) throw new Error(d.reason);
    const row = groupDevice([], d.items, TODAY, true).nodate[0]!;
    if (!isDraftRow(row)) throw new Error('not a draft row');
    expect(row.chip).toBe(DRAFT_CHIP);
    expect(row.href).toBe(draftHref(ID_A));
    expect(row.editHref).toBeNull();
    expect(row.when).toBe('No date');
    expect(row.who).toBe('4 days');
  });

  it('remove takes the draft out and Undo puts it back where it was', () => {
    putDrafts(s, unbuilt(ID_A), unbuilt(ID_B));
    const r = removeDeviceDraft(s, ID_A);
    if (!r.ok) throw new Error('not removed');
    expect((readDeviceDrafts(s) as { items: { id: string }[] }).items.map((x) => x.id)).toEqual([ID_B]);
    expect(r.restore()).toBe(true);
    expect((readDeviceDrafts(s) as { items: { id: string }[] }).items.map((x) => x.id)).toEqual([ID_A, ID_B]);
    expect(r.restore()).toBe(false);
    const last = removeDeviceDraft(s, ID_B);
    const only = removeDeviceDraft(s, ID_A);
    expect(last.ok && only.ok).toBe(true);
    expect(s.getItem(PLANS_KEY)).toBeNull();
  });
});

describe('a draft row', () => {
  const rowOf = (o: Record<string, unknown> = {}, builder = true) => {
    putDrafts(s, { ...unbuilt(), ...o });
    const d = readDeviceDrafts(s);
    if (!d.ok) throw new Error(d.reason);
    const row = groupDevice([], d.items, TODAY, builder).nodate[0]!;
    if (!isDraftRow(row)) throw new Error('x');
    return row;
  };
  it('carries the chip and a menu named for the trip, with Open as Continue and Remove last', () => {
    const h = renderToStaticMarkup(<ul><DraftRow row={rowOf()} onRemove={() => undefined} /></ul>);
    expect(h).toContain('Draft · ready to build');
    expect(h).toContain('aria-label="Actions for Alps loop"');
    expect(h).toMatch(new RegExp(`href="/plan/?\\?draft=${ID_A}&amp;s=4"`));
    // the link's name is its visible text (PR-023): no aria-label rewriting it
    expect(h).not.toContain('aria-label="Alps loop');
  });
  it('with the builder off an unbuilt draft is no link, says why, and its menu holds Remove only (PR-010)', () => {
    const row = rowOf({}, false);
    expect(row.href).toBeNull();
    expect(row.chip).toBe(DRAFT_CLOSED_CHIP);
    const h = renderToStaticMarkup(<ul><DraftRow row={row} onRemove={() => undefined} /></ul>);
    expect(h).not.toContain('<a ');
    expect(h).not.toContain('/plan/');
    expect(h).toContain('Draft · the planner is not open yet');
    expect(h).toContain('aria-label="Actions for Alps loop"');
  });
  it('a built draft opens only where tripEdit is on; with neither flag it leads nowhere, and says so', () => {
    const row = rowOf({ lastBuild: sampleDraft().lastBuild }, false);
    expect(row.href).toBeNull();
    expect(row.chip).toBe(DRAFT_CLOSED_CHIP);
  });
  it('a built draft has no Draft chip', () => {
    const row = rowOf({ lastBuild: sampleDraft().lastBuild });
    expect(row.chip).toBeNull();
  });
});

// The row menu's Edit and the empty state's words follow two build flags, read when the module loads.
describe('flags', () => {
  const item = {
    id: ID_A, slug: 'dolomites-2027', title: 'Dolomites', days: 14, cc: 'IT', photo: null, start: '2027-07-03',
    adults: 2, children: [], profile: null, overrides: {}, added: [], copiedAt: '2026-10-20T10:00:00.000Z',
  };
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it('the copy row menu has Edit (to /t/<id>/?edit=1) only with tripEdit on, and Open then leads to /t/<id>/', async () => {
    vi.stubEnv('NEXT_PUBLIC_TRIP_EDIT', '1');
    vi.resetModules();
    const { editHref, openHref } = await import('@/lib/mine/rows');
    expect(editHref(ID_A)).toBe(`/t/${ID_A}/?edit=1&view=day`);
    expect(openHref(item as never)).toBe(`/t/${ID_A}/?view=day`);
    vi.stubEnv('NEXT_PUBLIC_TRIP_EDIT', '');
    vi.resetModules();
    const off = await import('@/lib/mine/rows');
    expect(off.openHref(item as never)).toMatch(/^\/trips\/dolomites-2027\//);
  });
  it('the planBuilder flag is read from NEXT_PUBLIC_PLAN_BUILDER', async () => {
    vi.stubEnv('NEXT_PUBLIC_PLAN_BUILDER', '1');
    vi.resetModules();
    expect((await import('@/lib/mine/flag')).PLAN_BUILDER_ON).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_PLAN_BUILDER', '');
    vi.resetModules();
    expect((await import('@/lib/mine/flag')).PLAN_BUILDER_ON).toBe(false);
  });
});
