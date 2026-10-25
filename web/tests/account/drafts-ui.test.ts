import { describe, expect, it } from 'vitest';
import { applyOptimistic, commitAction, newestFirst, fetchDrafts, type OptimisticDraft } from '@/lib/drafts-ui';
import type { DraftRow } from '@/lib/drafts-shared';

const row = (id: string, title: string, updated = '2026-01-02T00:00:00.000Z'): DraftRow => ({
  id,
  title,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date(updated),
});

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('fetchDrafts (guarded re-fetch interpreter)', () => {
  it('returns ok with parsed rows on a well-formed body', async () => {
    const seq = { current: 0 };
    const r = await fetchDrafts(seq, async () => jsonResponse({ rows: [{ id: 'd1', title: 'Rome', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z' }] }));
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]).toMatchObject({ id: 'd1', title: 'Rome' });
      expect(r.rows[0].updated_at).toBeInstanceOf(Date);
    }
  });

  it('returns unauthenticated on 401', async () => {
    const seq = { current: 0 };
    expect((await fetchDrafts(seq, async () => new Response('', { status: 401 }))).kind).toBe('unauthenticated');
  });

  it('returns failed on a non-ok status', async () => {
    const seq = { current: 0 };
    expect((await fetchDrafts(seq, async () => new Response('', { status: 503 }))).kind).toBe('failed');
  });

  it('returns failed when the fetch itself throws (network error)', async () => {
    const seq = { current: 0 };
    expect((await fetchDrafts(seq, async () => { throw new Error('offline'); })).kind).toBe('failed');
  });

  it('returns failed on a malformed success body (bad JSON) — never an unhandled rejection', async () => {
    const seq = { current: 0 };
    expect((await fetchDrafts(seq, async () => new Response('not json{', { status: 200 }))).kind).toBe('failed');
  });

  it('returns failed when the JSON parses but the rows are the wrong shape', async () => {
    const seq = { current: 0 };
    expect((await fetchDrafts(seq, async () => jsonResponse({ rows: [{ title: 'no id' }] }))).kind).toBe('failed');
  });

  it('returns stale when a newer re-fetch superseded this one before the body resolved', async () => {
    const seq = { current: 0 };
    // This call is seq 1; simulate a newer re-fetch (seq 2) starting before our json() resolves.
    const r = await fetchDrafts(seq, async () => {
      const res = jsonResponse({ rows: [] });
      seq.current = 2;
      return res;
    });
    expect(r.kind).toBe('stale');
  });

  it('returns stale, not failed, when a non-ok lands after a newer fetch started', async () => {
    const seq = { current: 0 };
    const r = await fetchDrafts(seq, async () => {
      seq.current = 5;
      return new Response('', { status: 503 });
    });
    expect(r.kind).toBe('stale');
  });
});

describe('applyOptimistic (re-runnable optimistic layer)', () => {
  const base: readonly OptimisticDraft[] = [row('a', 'Alpha'), row('b', 'Beta')];

  it('adds a new row once and is a no-op if the id is already present (re-run safe)', () => {
    const added = applyOptimistic(base, { type: 'add', draft: row('c', 'Gamma') });
    expect(added.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(added[0].pending).toBe(true);
    expect(applyOptimistic(added, { type: 'add', draft: row('c', 'Gamma') })).toBe(added);
  });

  it('renames in place and marks pending; no-op once the title already matches', () => {
    const renamed = applyOptimistic(base, { type: 'rename', id: 'a', title: 'Alpha 2' });
    expect(renamed.find((r) => r.id === 'a')).toMatchObject({ title: 'Alpha 2', pending: true });
    const again = applyOptimistic(renamed, { type: 'rename', id: 'a', title: 'Alpha 2' });
    expect(again.find((r) => r.id === 'a')!.title).toBe('Alpha 2');
  });

  it('deletes by id', () => {
    expect(applyOptimistic(base, { type: 'delete', id: 'a' }).map((r) => r.id)).toEqual(['b']);
  });
});

describe('commitAction (fold a durable write into the server-truth snapshot)', () => {
  const base: readonly DraftRow[] = [row('a', 'Alpha'), row('b', 'Beta')];

  it('keeps a committed add visible and strips the pending flag', () => {
    const next = commitAction(base, { type: 'add', draft: row('c', 'Gamma') });
    expect(next.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect((next[0] as OptimisticDraft).pending).toBeUndefined();
  });

  it('does not duplicate when the base already carries the committed row (re-run safe)', () => {
    const once = commitAction(base, { type: 'add', draft: row('a', 'Alpha') });
    expect(once.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('applies a committed rename and delete', () => {
    expect(commitAction(base, { type: 'rename', id: 'b', title: 'Beta 2' }).find((r) => r.id === 'b')!.title).toBe('Beta 2');
    expect(commitAction(base, { type: 'delete', id: 'b' }).map((r) => r.id)).toEqual(['a']);
  });
});

describe('newestFirst', () => {
  it('sorts by updated_at descending, then by id descending for ties', () => {
    const rows = [row('a', 'A', '2026-01-01T00:00:00.000Z'), row('b', 'B', '2026-01-03T00:00:00.000Z'), row('c', 'C', '2026-01-01T00:00:00.000Z')];
    expect([...rows].sort(newestFirst).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});
