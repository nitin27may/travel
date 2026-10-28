import { describe, expect, it, vi } from 'vitest';
import { copyToPlanDraft, draftContentKey, planCopyMerge, planRowFields } from '@travel/core/plan/doc.ts';
import { applyOps } from '@travel/core/plan/ops.ts';
import { decideDelete, decidePut } from '@travel/core/schema/api/account-plans.ts';
import type { CopyItem, StorageLike } from '@travel/core/schema/copies.ts';
import { COPIES_KEY, emptyCopies, readCopies } from '@travel/core/schema/copies.ts';
import { parsePlanDraft, type PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { ACCT_KEY_PREFIX, OUTBOX_KEY_PREFIX } from '@/lib/mine/keys';
import { AccountSync, clearAccountData, purgeOtherAccounts, sendWaiting, unsentSummary, type SyncFetch } from '@/lib/mine/sync';
import { accountTripsFlag } from '@/lib/mine/flag';
import { storeDeviceEdits } from '@/lib/trip-edit/deviceEdits';

// The signed-in Mine sync (edit-my-trip 4.2 to 4.7, EM-2) against a fake account server that applies the real routes' decisions
// (`decidePut`, `decideDelete`, `planCopyMerge`): the merge, a conflict rebased, the offline outbox, idempotence, a tombstone and its Undo,
// the sign-out question, and the flag.

const H = 'a1b2c3d4e5f60718';
const A = '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b';
const B = '7a2d1b63-9e1f-4c8f-8b62-3d4e5f6a7b8c';
const C = '8b3e2c74-0f20-4d90-9c73-4e5f6a7b8c9d';
const NOW = new Date('2026-10-27T10:00:00.000Z');

const copy = (id: string, over: Partial<CopyItem> = {}): CopyItem => ({
  id,
  slug: 'dolomites-2027',
  title: 'Dolomites',
  days: 14,
  cc: 'IT',
  photo: null,
  start: '2027-07-03',
  adults: 2,
  children: [6],
  profile: { party: 'family', youngest: 6, pace: 'standard', adults: 2, walk: null, split: false },
  overrides: { '2': 'B' },
  added: [],
  copiedAt: '2026-10-20T10:00:00.000Z',
  ...over,
});

class Store implements StorageLike {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

function putCopies(s: StorageLike, items: CopyItem[]): void {
  s.setItem(COPIES_KEY, JSON.stringify({ ...emptyCopies(), items }));
}
const deviceIds = (s: StorageLike): string[] => {
  const r = readCopies(s.getItem(COPIES_KEY));
  return r.ok ? r.envelope.items.map((i) => i.id) : [];
};

interface Row {
  id: string;
  title: string;
  doc: PlanDraft | null;
  revision: number;
  deleted_at: string | null;
  fields: ReturnType<typeof planRowFields> | null;
}

/** The account, in memory, deciding as the routes do. `mode` makes it unavailable; `bump` makes every write conflict. */
class Server {
  rows = new Map<string, Row>();
  calls: string[] = [];
  mode: 'ok' | 'net' | 404 | 503 | 500 | 401 = 'ok';
  bump = false;
  refuse: { status: number; body: unknown } | null = null;
  gate: Promise<void> | null = null;

  json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }

  other(id: string, edit: (d: PlanDraft) => PlanDraft): void {
    const r = this.rows.get(id)!;
    r.doc = edit(r.doc!);
    r.revision += 1;
  }

  tombstone(id: string): void {
    const r = this.rows.get(id)!;
    r.doc = null;
    r.fields = null;
    r.deleted_at = NOW.toISOString();
    r.revision += 1;
  }

  fetch: SyncFetch = async (url, init) => {
    const method = init?.method ?? 'GET';
    const path = url.replace('/api/account/plans', '');
    this.calls.push(`${method} ${path || '/'}`);
    if (this.mode === 'net') throw new TypeError('Failed to fetch');
    if (this.mode === 401) return this.json(401, { code: 'UNAUTHENTICATED' });
    if (this.mode !== 'ok') return this.json(this.mode, { code: this.mode === 404 ? 'NOT_FOUND' : 'SERVICE_UNAVAILABLE' });
    if (this.gate && method === 'PUT') await this.gate;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;

    if (method === 'GET' && path === '') {
      const items = [...this.rows.values()].map((r) => ({
        id: r.id,
        title: r.title,
        kind: r.fields?.kind ?? null,
        source_trip: r.fields?.source_trip ?? null,
        start: r.fields?.start ?? null,
        days: r.fields?.days ?? null,
        revision: r.revision,
        updated_at: NOW.toISOString(),
        deleted_at: r.deleted_at,
      }));
      return this.json(200, { items });
    }
    if (method === 'POST' && path === '/merge') {
      const live = [...this.rows.values()].filter((r) => r.deleted_at === null);
      const keys = live.map((r) => ({ id: r.id, source_trip: r.fields?.source_trip ?? null, start: r.fields?.start ?? null, content: null as string | null }));
      // the real content key, so M3 behaves as in the route
      keys.forEach((k, i) => (k.content = draftContentKey(live[i]!.doc)));
      const plan = planCopyMerge(body, keys, { facts: () => ({ cc: 'IT', days: 14 }), cap: 50 });
      if (!plan.success) return this.json(400, { code: 'VALIDATION_ERROR' });
      const inserted: string[] = [];
      const already = [...plan.data.already];
      for (const r of plan.data.insert) {
        if (this.rows.has(r.id)) {
          already.push(r.id);
          continue;
        }
        this.rows.set(r.id, { id: r.id, title: r.title, doc: r.doc, revision: 0, deleted_at: null, fields: planRowFields(r.doc) });
        inserted.push(r.id);
      }
      return this.json(200, { inserted, already, sameTrip: plan.data.sameTrip, both: plan.data.both.filter((i) => inserted.includes(i)), overCap: plan.data.overCap, refused: plan.data.refused });
    }
    const id = path.slice(1);
    const row = this.rows.get(id) ?? null;
    if (method === 'GET') {
      if (!row || row.deleted_at !== null) return this.json(404, { code: 'NOT_FOUND' });
      return this.json(200, { revision: row.revision, doc: row.doc });
    }
    if (method === 'PUT') {
      if (this.refuse) return this.json(this.refuse.status, this.refuse.body);
      const b = body as { base: number | null; title: string; doc: unknown; restore?: boolean };
      const parsed = parsePlanDraft(b.doc);
      if (!parsed.success) return this.json(400, { code: 'VALIDATION_ERROR' });
      if (this.bump && row) {
        row.revision += 1;
        return this.json(409, { revision: row.revision, doc: row.doc, deleted_at: row.deleted_at });
      }
      const d = decidePut(b.base, row ? { revision: row.revision, deleted_at: row.deleted_at } : null, b.restore === true);
      if (d === 'not-found') return this.json(404, { code: 'NOT_FOUND' });
      if (d === 'conflict') return this.json(409, { revision: row!.revision, doc: row!.doc, deleted_at: row!.deleted_at });
      if (d === 'insert') {
        this.rows.set(id, { id, title: b.title, doc: parsed.data, revision: 0, deleted_at: null, fields: planRowFields(parsed.data) });
        return this.json(201, { revision: 0 });
      }
      row!.doc = parsed.data;
      row!.fields = planRowFields(parsed.data);
      row!.deleted_at = null;
      row!.revision += 1;
      return this.json(200, { revision: row!.revision });
    }
    if (method === 'DELETE') {
      const d = decideDelete((body as { base: number }).base, row ? { revision: row.revision, deleted_at: row.deleted_at } : null);
      if (d === 'not-found') return this.json(404, { code: 'NOT_FOUND' });
      if (d === 'conflict') return this.json(409, { revision: row!.revision, doc: row!.doc, deleted_at: row!.deleted_at });
      if (d === 'delete') this.tombstone(id);
      return this.json(200, { revision: row!.revision });
    }
    return this.json(404, { code: 'NOT_FOUND' });
  };
}

function setup(over: { online?: () => boolean; now?: () => Date; schedule?: (fn: () => void, ms: number) => unknown; store?: Store; server?: Server } = {}) {
  const store = over.store ?? new Store();
  const server = over.server ?? new Server();
  let n = 0;
  const engine = new AccountSync({
    storage: store,
    hash: H,
    fetch: server.fetch,
    now: over.now ?? (() => NOW),
    online: over.online ?? (() => true),
    newId: () => `o-t${++n}`,
    schedule: over.schedule ?? (() => 0),
    cancel: () => undefined,
  }).init();
  return { store, server, engine };
}

/** An account that already holds one trip, as another device left it. */
async function withTrip() {
  const s = setup();
  putCopies(s.store, [copy(A)]);
  await s.engine.sync();
  return s;
}

describe('the accountTrips flag', () => {
  it('is on only with sign-in and NEXT_PUBLIC_ACCOUNT_TRIPS=1', () => {
    expect(accountTripsFlag({ signIn: '1', accountTrips: '1' })).toBe(true);
    expect(accountTripsFlag({ signIn: '1' })).toBe(false);
    expect(accountTripsFlag({ accountTrips: '1' })).toBe(false);
    expect(accountTripsFlag({ signIn: '1', accountTrips: 'true' })).toBe(false);
    expect(accountTripsFlag({})).toBe(false);
  });
});

describe('the sign-in merge (4.2)', () => {
  it('moves device copies into the account, empties the device of what the server confirmed, and shows them as account rows', async () => {
    const s = setup();
    putCopies(s.store, [copy(A), copy(B, { slug: 'algonquin-muskoka-2026', start: '2028-06-01', title: 'Algonquin' })]);
    await s.engine.sync();
    const snap = s.engine.snapshot();
    expect(s.server.rows.size).toBe(2);
    expect(deviceIds(s.store)).toEqual([]);
    expect(snap.items.map((i) => i.id).sort()).toEqual([A, B].sort());
    expect(snap.merge).toMatchObject({ added: 2 });
    expect(snap.reachable).toBe(true);
    // the device records the account it merged into (a hint only)
    const env = readCopies(s.store.getItem(COPIES_KEY));
    expect(env.ok && Object.keys(env.envelope.merged)).toEqual([H]);
    // the quiet default: no chip state
    expect(snap.rows[A]).toMatchObject({ state: 'quiet', pending: 0 });
  });

  it('is safe to repeat: a crash between the write and emptying the device leaves one row per copy', async () => {
    const s = setup();
    putCopies(s.store, [copy(A)]);
    const backup = s.store.getItem(COPIES_KEY)!;
    await s.engine.sync();
    expect(s.server.rows.size).toBe(1);
    s.store.setItem(COPIES_KEY, backup); // the device still holds the copy
    await s.engine.sync();
    expect(s.server.rows.size).toBe(1);
    expect(deviceIds(s.store)).toEqual([]);
    expect(s.engine.snapshot().items).toHaveLength(1);
  });

  it('keeps both when the same trip and start differ in content, the device one titled "(from this device)" (M3)', async () => {
    const s = setup();
    s.server.rows.set(B, { id: B, title: 'Dolomites', doc: copyDoc(copy(B)), revision: 3, deleted_at: null, fields: planRowFields(copyDoc(copy(B))) });
    putCopies(s.store, [copy(A, { overrides: { '2': 'C' } })]);
    await s.engine.sync();
    expect(s.server.rows.get(A)?.title).toBe('Dolomites (from this device)');
    expect(s.engine.snapshot().items.map((i) => i.id).sort()).toEqual([A, B].sort());
    expect(deviceIds(s.store)).toEqual([]);
  });

  it('skips an identical copy of a trip the account already holds (M3)', async () => {
    const s = setup();
    s.server.rows.set(B, { id: B, title: 'Dolomites', doc: copyDoc(copy(B)), revision: 0, deleted_at: null, fields: planRowFields(copyDoc(copy(B))) });
    putCopies(s.store, [copy(A)]);
    await s.engine.sync();
    expect(s.server.rows.has(A)).toBe(false);
    expect(deviceIds(s.store)).toEqual([]);
    expect(s.engine.snapshot().items.map((i) => i.id)).toEqual([B]);
  });

  it('a copy over the cap stays on the device (M4) and the list says so', async () => {
    const s = setup();
    for (let i = 0; i < 50; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const doc = copyDoc(copy(id, { start: `2030-01-${String((i % 28) + 1).padStart(2, '0')}`, slug: i % 2 ? 'dolomites-2027' : 'algonquin' }));
      s.server.rows.set(id, { id, title: `T${i}`, doc, revision: 0, deleted_at: null, fields: planRowFields(doc) });
    }
    putCopies(s.store, [copy(A, { start: '2031-02-02' })]);
    await s.engine.sync();
    expect(deviceIds(s.store)).toEqual([A]);
    expect(s.engine.snapshot().merge).toMatchObject({ added: 0, overCap: 1 });
  });
});

function copyDoc(c: CopyItem): PlanDraft {
  const r = copyToPlanDraft(c);
  if (!r.success) throw new Error(r.issues.join(';'));
  return r.data;
}

describe('editing through the outbox (4.3)', () => {
  it('Change dates shows at once, is queued before it is sent, and leaves the outbox when the account confirms', async () => {
    const s = await withTrip();
    const calls = s.server.calls.length;
    const r = s.engine.changeDates(A, { start: '2027-08-10', adults: 3, children: [] });
    expect(r.ok).toBe(true);
    // the screen already shows it, and the outbox holds it on the device
    expect(s.engine.snapshot().items.find((i) => i.id === A)).toMatchObject({ start: '2027-08-10', adults: 3, children: [] });
    expect(unsentSummary(s.store).count).toBe(2);
    expect(s.store.getItem(`${OUTBOX_KEY_PREFIX}${H}`)).toContain('setDates');
    await s.engine.sync();
    expect(s.server.calls.slice(calls).some((c) => c.startsWith('PUT'))).toBe(true);
    const doc = s.server.rows.get(A)!.doc!;
    expect(doc.start).toBe('2027-08-10');
    expect(doc.travellers).toEqual({ adults: 3, children: [] });
    // the plan's profile follows the party (B1)
    expect(doc.template?.profile).toMatchObject({ adults: 3, party: 'adults', youngest: null });
    expect(unsentSummary(s.store).count).toBe(0);
    expect(s.store.getItem(`${OUTBOX_KEY_PREFIX}${H}`)).toBeNull();
    expect(s.engine.snapshot().rows[A]?.state).toBe('quiet');
  });

  it('Undo applies the inverse as new changes', async () => {
    const s = await withTrip();
    const r = s.engine.changeDates(A, { start: '2027-08-10', adults: 3, children: [] });
    if (!r.ok) throw new Error('edit');
    await s.engine.sync();
    expect(s.engine.undo(A, r.inverse).ok).toBe(true);
    await s.engine.sync();
    const doc = s.server.rows.get(A)!.doc!;
    expect(doc.start).toBe('2027-07-03');
    expect(doc.travellers).toEqual({ adults: 2, children: [6] });
  });

  it('the same operation queued twice is one change', async () => {
    const s = await withTrip();
    s.server.mode = 'net';
    const op = { kind: 'setDates' as const, id: 'o-same', start: '2027-09-01' };
    s.engine.edit(A, [op]);
    s.engine.edit(A, [op]);
    expect(unsentSummary(s.store).count).toBe(1);
  });

  it('refuses an edit that breaks the document, and an unknown trip', async () => {
    const s = await withTrip();
    expect(s.engine.edit(A, [{ kind: 'setDates', id: 'bad id', start: '2027-09-01' }])).toEqual({ ok: false, reason: 'invalid' });
    expect(s.engine.edit(C, [{ kind: 'setDates', id: 'o-x', start: '2027-09-01' }])).toEqual({ ok: false, reason: 'unknown' });
    expect(unsentSummary(s.store).count).toBe(0);
  });
});

describe('a conflict is rebased (4.4)', () => {
  it('re-applies the device change onto the account document and sends again', async () => {
    const s = await withTrip();
    s.server.mode = 'net';
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    // another device changes a day's version while this one is offline
    s.server.mode = 'ok';
    s.server.other(A, (d) => ({ ...d, template: { ...d.template!, overrides: { ...d.template!.overrides, '4': 'C' } } }));
    await s.engine.sync();
    const doc = s.server.rows.get(A)!.doc!;
    expect(doc.start).toBe('2027-08-10');
    expect(doc.template?.overrides['4']).toBe('C');
    expect(doc.template?.overrides['2']).toBe('B');
    expect(unsentSummary(s.store).count).toBe(0);
    expect(s.engine.snapshot().rows[A]?.state).toBe('quiet');
  });

  it('after three lost rounds the row reads Not synced Retry, and Retry runs the rounds again', async () => {
    const s = await withTrip();
    s.server.bump = true;
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    await s.engine.sync();
    expect(s.engine.snapshot().rows[A]?.state).toBe('retry');
    expect(s.server.calls.filter((c) => c.startsWith('PUT'))).toHaveLength(3);
    expect(unsentSummary(s.store).count).toBe(2);
    s.server.bump = false;
    await s.engine.retry(A);
    expect(s.engine.snapshot().rows[A]?.state).toBe('quiet');
    expect(s.server.rows.get(A)!.doc!.start).toBe('2027-08-10');
  });

  it('a 409 with a code is an error, not a conflict to rebase', async () => {
    const s = await withTrip();
    s.server.refuse = { status: 409, body: { code: 'PLAN_CAP' } };
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    await s.engine.sync();
    expect(s.engine.snapshot().rows[A]?.state).toBe('retry');
    expect(s.server.calls.filter((c) => c.startsWith('PUT'))).toHaveLength(1);
  });

  it('a validation refusal reads Retry; the change is kept', async () => {
    const s = await withTrip();
    s.server.refuse = { status: 400, body: { code: 'VALIDATION_ERROR' } };
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    await s.engine.sync();
    expect(s.engine.snapshot().rows[A]?.state).toBe('retry');
    expect(unsentSummary(s.store).count).toBe(2);
  });

  it('an operation whose target is gone is skipped and said once (4.4 step 6)', async () => {
    const s = await withTrip();
    s.server.mode = 'net';
    s.engine.edit(A, [{ kind: 'addPlace', id: 'o-add', day: 3, ref: 'place/moraine-lake' }]);
    s.server.mode = 'ok';
    // another device already added the same place
    s.server.other(A, (d) => ({ ...d, template: { ...d.template!, added: [{ op: 'o-other', day: 3, ref: 'place/moraine-lake' }] } }));
    await s.engine.sync();
    const snap = s.engine.snapshot();
    expect(snap.notices).toHaveLength(1);
    expect(snap.notices[0]).toMatchObject({ kind: 'skipped', count: 1 });
    expect(unsentSummary(s.store).count).toBe(0);
    expect(s.server.rows.get(A)!.doc!.template!.added).toHaveLength(1);
  });
});

describe('offline and unavailable (4.4 step 5)', () => {
  it('edits made offline stay in the outbox, the row reads Not synced yet, and they send when the device is online', async () => {
    let online = true;
    const s = setup({ online: () => online });
    putCopies(s.store, [copy(A)]);
    await s.engine.sync();
    online = false;
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    expect(s.engine.snapshot().rows[A]?.state).toBe('offline');
    const calls = s.server.calls.length;
    await s.engine.sync();
    expect(s.server.calls.length).toBe(calls);
    // the outbox survives a reload of the page
    const again = setup({ store: s.store, server: s.server, online: () => online });
    expect(again.engine.snapshot().rows[A]?.state).toBe('offline');
    expect(again.engine.snapshot().items.find((i) => i.id === A)?.start).toBe('2027-08-10');
    online = true;
    await again.engine.sync();
    expect(again.engine.snapshot().rows[A]?.state).toBe('quiet');
    expect(s.server.rows.get(A)!.doc!.start).toBe('2027-08-10');
  });

  it.each([404, 503, 500, 'net'] as const)('routes answering %s keep every device copy and read as Not synced yet', async (mode) => {
    const s = setup();
    putCopies(s.store, [copy(A)]);
    s.server.mode = mode;
    await s.engine.sync();
    expect(deviceIds(s.store)).toEqual([A]);
    expect(s.engine.snapshot().reachable).toBe(false);
    expect(s.engine.snapshot().items).toEqual([]);
    expect(s.server.calls.some((c) => c.startsWith('POST'))).toBe(false);
  });

  it('an account trip edited while the routes are unavailable stays queued, quiet, never lost', async () => {
    const s = await withTrip();
    s.server.mode = 503;
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    await s.engine.sync();
    expect(s.engine.snapshot().rows[A]?.state).toBe('offline');
    s.server.mode = 'ok';
    await s.engine.sync();
    expect(s.server.rows.get(A)!.doc!.start).toBe('2027-08-10');
  });

  it('a 401 keeps the outbox and says the session ended', async () => {
    const s = await withTrip();
    s.server.mode = 401;
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    await s.engine.sync();
    expect(s.engine.snapshot().expired).toBe(true);
    expect(unsentSummary(s.store).count).toBe(2);
  });

  it('reads the cache when the network is down: the account trips are still listed', async () => {
    const s = await withTrip();
    const again = setup({ store: s.store, server: s.server, online: () => false });
    expect(again.engine.snapshot().items.map((i) => i.id)).toEqual([A]);
  });
});

describe('Syncing shows after a second (4.7)', () => {
  it('a send held for over a second reads Syncing, and Quiet again when it lands', async () => {
    let now = NOW.getTime();
    const timers: (() => void)[] = [];
    const s = setup({ now: () => new Date(now), schedule: (fn) => timers.push(fn) });
    putCopies(s.store, [copy(A)]);
    await s.engine.sync();
    let release!: () => void;
    s.server.gate = new Promise<void>((r) => (release = r));
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    await Promise.resolve();
    expect(s.engine.snapshot().rows[A]?.state).toBe('quiet'); // under a second
    now += 1500;
    timers.forEach((t) => t());
    expect(s.engine.snapshot().rows[A]).toMatchObject({ state: 'syncing', spin: true });
    expect(s.engine.snapshot().announce).toBe('Syncing your changes.');
    release();
    await s.engine.sync();
    await new Promise((r) => setTimeout(r, 0));
    expect(s.engine.snapshot().rows[A]?.state).toBe('quiet');
  });
});

describe('Remove is a tombstone with Undo (4.5)', () => {
  it('hides the trip at once, sends the tombstone, and Undo restores it with its document', async () => {
    const s = await withTrip();
    const res = s.engine.remove(A);
    expect(res).toEqual({ title: 'Dolomites' });
    expect(s.engine.snapshot().items).toEqual([]);
    await s.engine.sync();
    expect(s.server.rows.get(A)!.deleted_at).not.toBeNull();
    const back = await s.engine.undoRemove(A);
    expect(back).toEqual({ ok: true });
    expect(s.server.rows.get(A)).toMatchObject({ deleted_at: null });
    expect(s.server.rows.get(A)!.doc!.template!.overrides['2']).toBe('B');
    expect(s.engine.snapshot().items.map((i) => i.id)).toEqual([A]);
  });

  it('Undo before the tombstone was sent just brings the trip and its unsent changes back', async () => {
    const s = await withTrip();
    s.server.mode = 'net';
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    s.engine.remove(A);
    expect(s.engine.snapshot().items).toEqual([]);
    expect(unsentSummary(s.store).count).toBe(0);
    expect(await s.engine.undoRemove(A)).toEqual({ ok: true });
    expect(s.engine.snapshot().items.map((i) => i.id)).toEqual([A]);
    expect(unsentSummary(s.store).count).toBe(2);
    expect(s.server.rows.get(A)!.deleted_at).toBeNull();
  });

  it('a Remove made offline is sent when the device is back, and the trip stays hidden meanwhile', async () => {
    let online = true;
    const s = setup({ online: () => online });
    putCopies(s.store, [copy(A)]);
    await s.engine.sync();
    online = false;
    s.engine.remove(A);
    expect(s.engine.snapshot().items).toEqual([]);
    const reloaded = setup({ store: s.store, server: s.server, online: () => online });
    expect(reloaded.engine.snapshot().items).toEqual([]);
    online = true;
    await reloaded.engine.sync();
    expect(s.server.rows.get(A)!.deleted_at).not.toBeNull();
  });

  it('a trip removed on another device leaves this list; unsent changes are set aside with a way back', async () => {
    const s = await withTrip();
    s.server.mode = 'net';
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    s.server.mode = 'ok';
    s.server.tombstone(A);
    await s.engine.sync();
    const snap = s.engine.snapshot();
    expect(snap.items).toEqual([]);
    expect(snap.notices[0]).toMatchObject({ kind: 'removed', title: 'Dolomites', count: 2 });
    expect(unsentSummary(s.store).count).toBe(0);
    // Undo restores it, with the changes made here
    expect(await s.engine.undoRemove(A)).toEqual({ ok: true });
    expect(s.server.rows.get(A)!.doc!.start).toBe('2027-08-10');
  });

  it('a trip removed elsewhere with nothing unsent just leaves the list', async () => {
    const s = await withTrip();
    s.server.tombstone(A);
    await s.engine.sync();
    expect(s.engine.snapshot().items).toEqual([]);
    expect(s.engine.snapshot().notices).toEqual([]);
  });

  it('Undo that the account refuses (full) says so and changes nothing', async () => {
    const s = await withTrip();
    s.engine.remove(A);
    await s.engine.sync();
    s.server.refuse = { status: 409, body: { code: 'PLAN_CAP' } };
    expect(await s.engine.undoRemove(A)).toEqual({ ok: false, reason: 'full' });
  });
});

describe('sign-out (4.6) and the device across accounts', () => {
  it('names the changes that are not in the account, and Try again sends them', async () => {
    const s = await withTrip();
    s.server.mode = 'net';
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    expect(unsentSummary(s.store)).toEqual({ count: 2, trips: [{ id: A, title: 'Dolomites', count: 2 }] });
    const still = await sendWaiting(s.store, H, { fetch: s.server.fetch });
    expect(still.count).toBe(2);
    s.server.mode = 'ok';
    const done = await sendWaiting(s.store, H, { fetch: s.server.fetch });
    expect(done.count).toBe(0);
    expect(s.server.rows.get(A)!.doc!.start).toBe('2027-08-10');
  });

  it('Sign out and discard deletes the cache and the outbox; copies made while signed out stay', async () => {
    const s = await withTrip();
    s.server.mode = 'net';
    s.engine.changeDates(A, { start: '2027-08-10', adults: 2, children: [6] });
    putCopies(s.store, [copy(C, { start: '2029-01-01' })]);
    clearAccountData(s.store);
    expect(s.store.getItem(`${ACCT_KEY_PREFIX}${H}`)).toBeNull();
    expect(s.store.getItem(`${OUTBOX_KEY_PREFIX}${H}`)).toBeNull();
    expect(deviceIds(s.store)).toEqual([C]);
    expect(unsentSummary(s.store).count).toBe(0);
  });

  it('a user switch deletes the other account\'s cache and an empty outbox; a non-empty one is kept and never sent as this account', async () => {
    const s = await withTrip();
    s.store.setItem(`${ACCT_KEY_PREFIX}ffffffffffffffff`, '{}');
    s.store.setItem(`${OUTBOX_KEY_PREFIX}eeeeeeeeeeeeeeee`, JSON.stringify({ schema: 'plan-outbox/1', items: [] }));
    s.store.setItem(`${OUTBOX_KEY_PREFIX}dddddddddddddddd`, JSON.stringify({ schema: 'plan-outbox/1', items: [{ draft: C, op: { kind: 'setDates', id: 'o-z', start: '2027-01-01' }, base: 1, at: NOW.toISOString() }] }));
    purgeOtherAccounts(s.store, H);
    expect(s.store.getItem(`${ACCT_KEY_PREFIX}ffffffffffffffff`)).toBeNull();
    expect(s.store.getItem(`${OUTBOX_KEY_PREFIX}eeeeeeeeeeeeeeee`)).toBeNull();
    expect(s.store.getItem(`${OUTBOX_KEY_PREFIX}dddddddddddddddd`)).not.toBeNull();
    const before = s.server.calls.length;
    await sendWaiting(s.store, H, { fetch: s.server.fetch });
    expect(s.server.calls.length).toBe(before);
  });
});

describe('the flag off is today', () => {
  it('nothing is read or sent until an engine is created; an engine never touches the copies envelope without a signed-in merge', () => {
    const store = new Store();
    putCopies(store, [copy(A)]);
    const server = new Server();
    new AccountSync({ storage: store, hash: H, fetch: server.fetch }).init();
    expect(server.calls).toEqual([]);
    expect(deviceIds(store)).toEqual([A]);
  });
});

// Review STEP2-ES ES-001: the merge carries the whole document. A device copy's removals, notes and Maybe live in the device edits envelope
// (`travel.trip-edit.device`), not in `copies/1`; they must reach the account, and the envelope must not outlive the copy on the device.
describe('the sign-in merge carries the device edits (ES-001)', () => {
  const DEVICE = 'travel.trip-edit.device';
  const NOTE = 'Bring the blue bag';
  const edits = [
    { kind: 'removePlace' as const, id: 'o-rm', day: 2, item: 'tre-cime-loop' },
    { kind: 'setNote' as const, id: 'o-nt', key: '3', text: NOTE },
    { kind: 'addMaybe' as const, id: 'o-mb', ref: 'place/lago-di-braies' },
  ];
  /** A copy on the device with edits laid on it the way the trip page saves them. */
  function editedCopy(store: Store, id: string, over: Partial<CopyItem> = {}): PlanDraft {
    const c = copy(id, over);
    putCopies(store, [...(readCopies(store.getItem(COPIES_KEY)).ok ? (readCopies(store.getItem(COPIES_KEY)) as { envelope: { items: CopyItem[] } }).envelope.items : []), c]);
    const d = applyOps(copyDoc(c), edits);
    expect(d.skipped).toEqual([]);
    storeDeviceEdits(store, id, d.doc, deviceIds(store));
    expect(store.getItem(DEVICE)).toContain(NOTE);
    return d.doc;
  }
  const allValues = (s: Store): string => Array.from({ length: s.length }, (_, i) => s.getItem(s.key(i)!)).join('\n');

  it('device edits survive the merge: the account holds them, the device entry goes with the copy', async () => {
    const s = setup();
    const want = editedCopy(s.store, A);
    await s.engine.sync();
    const row = s.server.rows.get(A)!;
    expect(row.doc!.template!.removed).toEqual(want.template!.removed);
    expect(row.doc!.template!.notes).toEqual({ '3': NOTE });
    expect(row.doc!.template!.maybe).toEqual(want.template!.maybe);
    expect(row.revision).toBe(1);
    // the screen reads the account document with the edits, and nothing waits
    expect(s.engine.view(A)!.template!.notes).toEqual({ '3': NOTE });
    expect(s.engine.snapshot().rows[A]).toMatchObject({ state: 'quiet', pending: 0 });
    // no device entry outlives its copy
    expect(deviceIds(s.store)).toEqual([]);
    expect(s.store.getItem(DEVICE)).toBeNull();
  });

  it('sign-out after the merge leaves no notes on the device', async () => {
    const s = setup();
    editedCopy(s.store, A);
    await s.engine.sync();
    clearAccountData(s.store);
    expect(allValues(s.store)).not.toContain(NOTE);
    expect(s.store.getItem(DEVICE)).toBeNull();
  });

  it('the edits are kept in the account cache until they are sent, across a reload, when the send fails', async () => {
    const s = setup();
    editedCopy(s.store, A);
    s.server.refuse = { status: 503, body: { code: 'SERVICE_UNAVAILABLE' } };
    await s.engine.sync();
    expect(s.server.rows.get(A)!.revision).toBe(0); // the merge inserted the copy only
    expect(s.server.rows.get(A)!.doc!.template!.notes).toEqual({});
    expect(s.store.getItem(DEVICE)).toBeNull(); // the device entry left with the copy...
    expect(s.store.getItem(`${ACCT_KEY_PREFIX}${H}`)).toContain(NOTE); // ...because the account cache holds the edited document
    // a reload, then the account answers: the whole document goes, and a list never put the copy-only document over it
    s.server.refuse = null;
    const again = setup({ store: s.store, server: s.server });
    expect(again.engine.view(A)!.template!.notes).toEqual({ '3': NOTE });
    await again.engine.sync();
    expect(s.server.rows.get(A)!.doc!.template!.notes).toEqual({ '3': NOTE });
    expect(s.server.rows.get(A)!.revision).toBe(1);
  });

  it('is idempotent: the merge repeated after a crash leaves one row with the edits, and no second write', async () => {
    const s = setup();
    editedCopy(s.store, A);
    const copies = s.store.getItem(COPIES_KEY)!;
    const device = s.store.getItem(DEVICE)!;
    await s.engine.sync();
    const puts = s.server.calls.filter((c) => c.startsWith('PUT')).length;
    s.store.setItem(COPIES_KEY, copies); // the device still holds the copy and its edits
    s.store.setItem(DEVICE, device);
    await s.engine.sync();
    expect(s.server.rows.size).toBe(1);
    expect(s.server.rows.get(A)!.doc!.template!.notes).toEqual({ '3': NOTE });
    expect(s.server.calls.filter((c) => c.startsWith('PUT')).length).toBe(puts);
    expect(deviceIds(s.store)).toEqual([]);
    expect(s.store.getItem(DEVICE)).toBeNull();
  });

  it('conflict: an account document newer than the insert is the source; the device edits do not overwrite it', async () => {
    const s = setup();
    editedCopy(s.store, A);
    // an earlier merge inserted A and another device changed it since; this device still holds the copy (a crash before it left)
    const theirs = applyOps(copyDoc(copy(A)), [{ kind: 'setNote', id: 'o-th', key: '5', text: 'Theirs' }]).doc;
    s.server.rows.set(A, { id: A, title: 'Dolomites', doc: theirs, revision: 2, deleted_at: null, fields: planRowFields(theirs) });
    await s.engine.sync();
    expect(s.server.rows.get(A)!.doc!.template!.notes).toEqual({ '5': 'Theirs' });
    expect(s.server.rows.get(A)!.revision).toBe(2);
    expect(s.engine.view(A)!.template!.notes).toEqual({ '5': 'Theirs' });
    expect(s.store.getItem(DEVICE)).toBeNull();
  });

  it('conflict: the account moves between the insert and the send; the account wins and the row settles', async () => {
    const s = setup();
    editedCopy(s.store, A);
    s.server.bump = true;
    await s.engine.sync();
    s.server.bump = false;
    expect(s.server.rows.get(A)!.doc!.template!.notes).toEqual({});
    expect(s.engine.view(A)!.template!.notes).toEqual({});
    expect(s.engine.snapshot().rows[A]?.state).toBe('quiet');
  });

  it('a copy M3 would skip as the same trip is kept beside it when the person changed it on this device', async () => {
    const s = setup();
    s.server.rows.set(B, { id: B, title: 'Dolomites', doc: copyDoc(copy(B)), revision: 0, deleted_at: null, fields: planRowFields(copyDoc(copy(B))) });
    editedCopy(s.store, A);
    await s.engine.sync();
    expect(s.server.rows.get(A)?.title).toBe('Dolomites (from this device)');
    expect(s.server.rows.get(A)!.doc!.template!.notes).toEqual({ '3': NOTE });
    expect(s.engine.snapshot().items.map((i) => i.id).sort()).toEqual([A, B].sort());
    expect(deviceIds(s.store)).toEqual([]);
    expect(s.store.getItem(DEVICE)).toBeNull();
  });

  it('that copy stays on the device, with its edits, when the account refuses it (the cap)', async () => {
    const s = setup();
    s.server.rows.set(B, { id: B, title: 'Dolomites', doc: copyDoc(copy(B)), revision: 0, deleted_at: null, fields: planRowFields(copyDoc(copy(B))) });
    editedCopy(s.store, A);
    s.server.refuse = { status: 409, body: { code: 'PLAN_CAP' } };
    await s.engine.sync();
    expect(s.server.rows.has(A)).toBe(false);
    expect(deviceIds(s.store)).toEqual([A]);
    expect(s.store.getItem(DEVICE)).toContain(NOTE);
  });
});

// Review STEP2-ES ES-006: the tab's undo stacks hold earlier notes and travellers; sign-out and a user switch take them.
describe('the tab undo stacks at sign-out (ES-006)', () => {
  it('clearAccountData and a user switch remove every travel.trip-edit.undo.* key of the tab', () => {
    const session = new Store();
    vi.stubGlobal('window', { sessionStorage: session, dispatchEvent: () => true });
    try {
      session.setItem(`travel.trip-edit.undo.${A}`, '{"v":1,"past":[{"ops":[],"label":"Emma"}],"future":[]}');
      session.setItem('travel.other', 'kept');
      clearAccountData(new Store());
      expect(session.getItem(`travel.trip-edit.undo.${A}`)).toBeNull();
      expect(session.getItem('travel.other')).toBe('kept');

      session.setItem(`travel.trip-edit.undo.${B}`, '{}');
      const local = new Store();
      local.setItem(`${ACCT_KEY_PREFIX}${H}`, '{}');
      purgeOtherAccounts(local, H); // the same account: the stacks stay
      expect(session.getItem(`travel.trip-edit.undo.${B}`)).toBe('{}');
      local.setItem(`${ACCT_KEY_PREFIX}ffffffffffffffff`, '{}');
      purgeOtherAccounts(local, H); // another account was here: they go
      expect(session.getItem(`travel.trip-edit.undo.${B}`)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// SW-008, SW-026: an undated account trip is a Mine row (the "No date" group), and its colour comes with it.
describe('copyOfRow (copies/2)', () => {
  it('an account trip with no start is a row with start null, and carries the document\'s colour', async () => {
    const { copyOfRow } = await import('@/lib/mine/sync');
    const base = copyToPlanDraft(copy('6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', { start: null, identity: 'sky' }));
    if (!base.success) throw new Error(base.issues.join('; '));
    expect(base.data.start).toBeUndefined();
    const item = copyOfRow({ id: base.data.id, title: 'Dolomites', days: 14 }, base.data);
    expect(item).not.toBeNull();
    expect(item!.start).toBeNull();
    expect(item!.identity).toBe('sky');
  });
});
