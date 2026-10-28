// Signed-in Mine: the device side of the account sync (edit-my-trip.md 4.2 to 4.7; task EM-2, behind the `accountTrips` flag).
//
// One engine per signed-in account on this device. It keeps the account's trips in a device cache (`travel.mine.acct.<h>`) and the
// changes not yet sent in the outbox (`travel.mine.outbox.<h>`), refetches the light list on demand (Mine's load, focus, `online` and
// the 60 s tick: the hook in useSync.ts drives it; no Realtime), merges the device's copies into the account (M1 to M4, idempotent on the
// copy id), sends the outbox with the row's revision as `base`, rebases on a 409 (up to PLAN_SYNC.rebaseRounds), and removes a trip as
// a tombstone with an Undo that restores it (PUT `restore`).
//
// Rules this file keeps:
//   - a device copy leaves the device only for ids the server confirmed (`markMerged`), and its document is cached first, so a copy is
//     never lost to a failed fetch;
//   - a route that is not there (404), unavailable (5xx), rate limited (429) or a dead network is NOT an error the person acts on: the
//     change stays queued and the row reads "Not synced yet". "Not synced · Retry" is for three lost conflict rounds or a refusal
//     (a validation or cap answer carrying a `code`);
//   - a 409 with a `code` is an error; a 409 without one is a conflict to rebase;
//   - nothing here logs, and nothing of a trip (title, start, ages) is put in an error: only fixed words leave this module.
//
// Why this file may import the plan document: it is one of the builder fence's extension points (web/tests/plan/isolation.test.ts,
// X-EM2); it is a lazy chunk, loaded by Mine only when the flag is on and a person is signed in, so the page's start JS does not change.
import { PLAN_SYNC } from '@travel/core/config/plans.ts';
import { accountHash } from '@travel/core/favourites/account.ts';
import { copyToPlanDraft } from '@travel/core/plan/doc.ts';
import { applyOp, applyOps, touchDraft, type PlanOp, type PlanSkipReason } from '@travel/core/plan/ops.ts';
import {
  confirm,
  discardDraft,
  emptyPlanOutbox,
  enqueue,
  onConflict,
  pendingCounts,
  pendingFor,
  planRowState,
  readPlanOutbox,
  type PlanOutbox,
  type PlanPendingChange,
  type PlanRowState,
} from '@travel/core/plan/sync.ts';
import {
  accountPlanConflict,
  accountPlanGet,
  accountPlanMergeAnswer,
  accountPlanRow,
  accountPlanWritten,
  diffPlanList,
  parseAccountPlanList,
  type AccountPlanMergeAnswer,
  type AccountPlanRow,
} from '@travel/core/schema/api/account-plans.ts';
import { markMerged, needsMerge, readCopies, updateCopies, COPIES_KEY, type CopyItem, type StorageLike } from '@travel/core/schema/copies.ts';
import { parsePlanDraft, type PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { ACCT_KEY_PREFIX, CHANGED_EVENT, OUTBOX_KEY_PREFIX } from './keys';

export const ACCT_SCHEMA = 'mine-acct/1';
const PLANS = '/api/account/plans';
/** Documents fetched at once when a list brings new or moved rows. */
const FETCH_AT_ONCE = 4;
/** A send shows "Syncing" only once it has run this long, in seconds (edit-my-trip 4.7; core's `planRowState` applies the same second). */
const SYNCING_AFTER_S = 1;

// ---- the cached rows ------------------------------------------------------------------------------------------------------------

/** One account trip on this device: the list's light columns, and the confirmed document at `revision` (null until it is fetched). */
export interface CachedRow extends AccountPlanRow {
  doc: PlanDraft | null;
  /** seeded from a device copy at the merge, not yet read back from the account: fetched at the next list */
  provisional?: true;
  /** Remove was pressed and the tombstone is not confirmed yet: hidden, retried */
  removing?: true;
}

interface CacheFile {
  schema: typeof ACCT_SCHEMA;
  savedAt: string;
  rows: CachedRow[];
}

/** What the sign-in merge and the sync say to the person, once each (4.4 step 6, 4.5, M5). */
export type SyncNotice =
  | { kind: 'skipped'; id: string; title: string; count: number; reasons: PlanSkipReason[] }
  | { kind: 'removed'; id: string; title: string; count: number };

export interface RowView {
  state: PlanRowState;
  /** the chip's spinner: pending changes are being sent */
  spin: boolean;
  pending: number;
  /** the row's last change in the account (`updated_at`, ISO): the Account page's "Changed 24 Oct" and its newest-first order */
  changedAt: string;
}

export interface SyncSnapshot {
  /** the cache was read (or the list answered once) */
  ready: boolean;
  /** the account's trips as copy-shaped items, newest data first by the caller's grouping */
  items: CopyItem[];
  rows: Record<string, RowView>;
  /** the last list answered; false: routes missing, unavailable or no network; null: not asked yet */
  reachable: boolean | null;
  /** a route answered 401: the session ended while changes were waiting */
  expired: boolean;
  /** changes not yet in the account, all trips */
  unsent: number;
  notices: SyncNotice[];
  /** the last merge: trips added to the account (M5), and copies that stayed on the device */
  merge: { added: number; overCap: number; refused: number } | null;
  /** the sentence for the live region while something is waiting, '' while all is quiet (the hook says "All changes are in your account" on the way back) */
  announce: string;
}

export type SyncFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface SyncDeps {
  storage: StorageLike;
  /** `accountHash(user id)` */
  hash: string;
  fetch?: SyncFetch;
  now?: () => Date;
  online?: () => boolean;
  newId?: () => string;
  /** a timer, so a test can run the "over a second" rule without waiting */
  schedule?: (fn: () => void, ms: number) => unknown;
  cancel?: (t: unknown) => void;
}

// ---- helpers -------------------------------------------------------------------------------------------------------------------

const readJson = (raw: string | null): unknown => {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** An account trip as the Mine rows and the Open link read it (`CopyItem` shape; never parsed: it is built from a parsed document). */
export function copyOfRow(row: Pick<CachedRow, 'id' | 'title' | 'days'>, d: PlanDraft): CopyItem | null {
  const t = d.template;
  if (!t || !d.start || !d.travellers) return null;
  const added = t.added.flatMap((a) => (typeof a.day === 'number' && a.ref.startsWith('place/') ? [{ day: a.day, placeSlug: a.ref.slice('place/'.length) }] : []));
  return {
    id: row.id,
    slug: t.trip,
    title: d.title ?? row.title,
    days: row.days ?? (d.nights === null ? null : d.nights + 1),
    cc: d.where.mode === 'trip' ? d.where.cc : null,
    photo: null,
    start: d.start,
    adults: d.travellers.adults,
    children: [...d.travellers.children],
    profile: t.profile,
    overrides: t.overrides,
    added,
    copiedAt: d.createdAt,
    ...(t.rev ? { rev: t.rev } : {}),
    ...(d.fromRef !== undefined ? { fromRef: d.fromRef } : {}),
    ...(d.gw !== undefined ? { gw: d.gw } : {}),
  } as CopyItem;
}

type Out =
  | { kind: 'ok'; status: number; json: unknown }
  | { kind: 'conflict'; json: unknown }
  /** the server understood and said no: a validation, size or cap answer */
  | { kind: 'refused' }
  | { kind: 'auth' }
  /** no network, a missing route (404), unavailable (5xx), rate limited (429): try again later, say nothing alarming */
  | { kind: 'down' };

const newOpId = (): string => `o-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

// ---- the engine ---------------------------------------------------------------------------------------------------------------

interface Stash {
  row: CachedRow;
  doc: PlanDraft;
  changes: PlanPendingChange[];
  /** the tombstone's revision once the DELETE (or the list) confirmed it: what a restore sends as `base` */
  tomb?: number;
}

export type EditResult = { ok: true; inverse: PlanOp[] } | { ok: false; reason: 'unknown' | 'storage' | 'invalid' | 'full' };
export type RestoreResult = { ok: true } | { ok: false; reason: 'gone' | 'full' | 'offline' };

export class AccountSync {
  private rows = new Map<string, CachedRow>();
  private outbox: PlanOutbox = emptyPlanOutbox();
  private outboxOk = true;
  private readonly failed = new Set<string>();
  private readonly sending = new Map<string, number>();
  private readonly stashes = new Map<string, Stash>();
  private readonly deleting = new Map<string, Promise<void>>();
  private readonly flights = new Map<string, Promise<void>>();
  private notices: SyncNotice[] = [];
  private merge: SyncSnapshot['merge'] = null;
  private reachable: boolean | null = null;
  private expired = false;
  private netDown = false;
  private ready = false;
  private running: Promise<void> | null = null;
  private rerun = false;
  private listeners = new Set<() => void>();
  private timers = new Set<unknown>();
  private snap: SyncSnapshot;
  private readonly d: Required<Omit<SyncDeps, 'fetch'>> & { fetch: SyncFetch };

  constructor(deps: SyncDeps) {
    this.d = {
      storage: deps.storage,
      hash: deps.hash,
      fetch: deps.fetch ?? ((i, init) => fetch(i, init)),
      now: deps.now ?? (() => new Date()),
      online: deps.online ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false),
      newId: deps.newId ?? newOpId,
      schedule: deps.schedule ?? ((fn, ms) => setTimeout(fn, ms)),
      cancel: deps.cancel ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>)),
    };
    this.snap = this.build();
  }

  // ---- storage ----

  private get cacheKey(): string {
    return `${ACCT_KEY_PREFIX}${this.d.hash}`;
  }
  private get outboxKey(): string {
    return `${OUTBOX_KEY_PREFIX}${this.d.hash}`;
  }

  /** Reads the device cache and the outbox, drops other accounts' caches (a user switch, 4.3), and publishes the first snapshot. */
  init(): this {
    const file = readJson(this.d.storage.getItem(this.cacheKey)) as Partial<CacheFile> | null;
    this.rows = new Map();
    if (file && file.schema === ACCT_SCHEMA && Array.isArray(file.rows)) {
      for (const r of file.rows) {
        const row = this.readRow(r);
        if (row) this.rows.set(row.id, row);
      }
    }
    const ob = readPlanOutbox(this.d.storage.getItem(this.outboxKey));
    this.outboxOk = ob.ok;
    this.outbox = ob.ok ? ob.outbox : emptyPlanOutbox();
    purgeOtherAccounts(this.d.storage, this.d.hash);
    this.ready = true;
    this.publish();
    return this;
  }

  private readRow(x: unknown): CachedRow | null {
    if (!x || typeof x !== 'object') return null;
    const { doc, provisional, removing, ...light } = x as Record<string, unknown>;
    const l = accountPlanRow.safeParse(light);
    if (!l.success) return null;
    const parsed = doc === null || doc === undefined ? null : parsePlanDraft(doc);
    return { ...l.data, doc: parsed && parsed.success ? parsed.data : null, ...(provisional === true ? { provisional: true as const } : {}), ...(removing === true ? { removing: true as const } : {}) };
  }

  private saveCache(): void {
    const file: CacheFile = { schema: ACCT_SCHEMA, savedAt: this.d.now().toISOString(), rows: [...this.rows.values()] };
    try {
      this.d.storage.setItem(this.cacheKey, JSON.stringify(file));
    } catch {
      /* a full or blocked store: the cache is for offline reading only; the session keeps working from memory */
    }
  }

  private saveOutbox(): boolean {
    try {
      if (this.outbox.items.length === 0) this.d.storage.removeItem(this.outboxKey);
      else this.d.storage.setItem(this.outboxKey, JSON.stringify(this.outbox));
      return true;
    } catch {
      return false;
    }
  }

  /** Another tab wrote the cache or the outbox: read them again. */
  reload(): void {
    this.init();
  }

  // ---- the view ----

  /** A trip's document with its pending changes applied: what the screen shows. */
  view(id: string): PlanDraft | null {
    const row = this.rows.get(id);
    if (!row?.doc) return null;
    const pending = pendingFor(this.outbox, id);
    return pending.length ? applyOps(row.doc, pending).doc : row.doc;
  }

  private rowView(id: string): RowView {
    const pending = pendingFor(this.outbox, id).length;
    const since = this.sending.get(id);
    const state = planRowState({
      signedIn: true,
      onDeviceOnly: false,
      pending,
      online: this.d.online() && !this.netDown,
      failed: this.failed.has(id),
      sendingMs: since === undefined ? null : this.d.now().getTime() - since,
    });
    return { state, spin: state === 'syncing', pending, changedAt: this.rows.get(id)?.updated_at ?? '' };
  }

  private build(): SyncSnapshot {
    const items: CopyItem[] = [];
    const rows: Record<string, RowView> = {};
    for (const row of this.rows.values()) {
      if (row.removing || row.deleted_at !== null || row.kind !== 'template') continue;
      const v = this.view(row.id);
      const item = v ? copyOfRow(row, v) : null;
      if (!item) continue;
      items.push(item);
      rows[row.id] = this.rowView(row.id);
    }
    const views = Object.values(rows);
    const unsent = this.outbox.items.length;
    let announce = '';
    if (views.some((r) => r.state === 'retry')) announce = 'Some changes are not synced. Use Retry on the trip.';
    else if (views.some((r) => r.state === 'offline')) announce = 'Not synced yet. Your changes will sync when you are online.';
    else if (views.some((r) => r.state === 'syncing')) announce = 'Syncing your changes.';
    return { ready: this.ready, items, rows, reachable: this.reachable, expired: this.expired, unsent, notices: this.notices, merge: this.merge, announce };
  }

  snapshot(): SyncSnapshot {
    return this.snap;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private publish(): void {
    this.snap = this.build();
    for (const fn of this.listeners) fn();
  }

  dispose(): void {
    for (const t of this.timers) this.d.cancel(t);
    this.timers.clear();
    this.listeners.clear();
  }

  // ---- the network ----

  private async call(method: 'GET' | 'PUT' | 'DELETE' | 'POST', url: string, body?: unknown): Promise<Out> {
    let res: Response;
    try {
      res = await this.d.fetch(url, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
      });
    } catch {
      this.netDown = true;
      return { kind: 'down' };
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* an empty or non-JSON body */
    }
    if (res.status === 401) return { kind: 'auth' };
    if (res.ok) {
      this.netDown = false;
      return { kind: 'ok', status: res.status, json };
    }
    this.netDown = false;
    if (res.status === 409) {
      const code = (json as { code?: unknown } | null)?.code;
      return typeof code === 'string' ? { kind: 'refused' } : { kind: 'conflict', json };
    }
    if (res.status === 400 || res.status === 413 || res.status === 415 || res.status === 422) return { kind: 'refused' };
    this.netDown = true;
    return { kind: 'down' };
  }

  // ---- the round: list, merge, send ----

  /** One pass: the list, the merge of device copies, then every waiting send. Overlapping calls fold into one more pass. */
  sync(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    const run = (async () => {
      try {
        do {
          this.rerun = false;
          if (!this.d.online()) {
            this.netDown = true;
            this.publish();
            break;
          }
          const listed = await this.fetchList();
          if (listed !== 'ok') break;
          if (await this.mergeDevice()) await this.fetchList();
          await this.flushAll();
        } while (this.rerun);
      } finally {
        this.running = null;
        this.publish();
      }
    })();
    this.running = run;
    return run;
  }

  private async fetchList(): Promise<'ok' | 'auth' | 'down'> {
    const out = await this.call('GET', PLANS);
    if (out.kind === 'auth') {
      this.expired = true;
      this.publish();
      return 'auth';
    }
    const list = out.kind === 'ok' ? parseAccountPlanList(out.json) : null;
    if (!list || !list.success) {
      this.reachable = false;
      this.publish();
      return 'down';
    }
    this.expired = false;
    this.reachable = true;
    const server = list.data.items;
    const cached = [...this.rows.values()].map((r) => ({ id: r.id, revision: r.doc === null || r.provisional ? -1 : r.revision }));
    const diff = diffPlanList(cached, server);
    const byId = new Map(server.map((r) => [r.id, r]));

    // gone or tombstoned elsewhere: drop it; a trip with unsent changes says so, with an Undo (4.5)
    for (const id of diff.drop) {
      const row = this.rows.get(id);
      if (!row) continue;
      const tomb = byId.get(id);
      if (row.removing) {
        // our own Remove, seen back in the list: the stash can restore it
        const s = this.stashes.get(id);
        if (s && tomb) s.tomb = tomb.revision;
      } else {
        const pending = pendingFor(this.outbox, id).length;
        if (pending > 0 && row.doc) {
          const cut = discardDraft(this.outbox, id);
          this.stashes.set(id, { row: { ...row }, doc: this.view(id) ?? row.doc, changes: cut.discarded, tomb: tomb?.revision });
          this.outbox = cut.outbox;
          this.saveOutbox();
          this.notices = [...this.notices, { kind: 'removed', id, title: row.title, count: pending }];
        }
      }
      this.rows.delete(id);
      this.failed.delete(id);
    }

    for (const s of server) {
      if (s.deleted_at !== null) continue;
      const have = this.rows.get(s.id);
      if (have) {
        have.title = s.title;
        have.kind = s.kind;
        have.source_trip = s.source_trip;
        have.start = s.start;
        have.days = s.days;
        have.updated_at = s.updated_at;
      } else if (s.kind === 'template') {
        this.rows.set(s.id, { ...s, doc: null });
      }
    }
    // our own removals that the server no longer lists as live are done
    for (const row of [...this.rows.values()]) if (row.removing && !byId.has(row.id)) this.rows.delete(row.id);

    const want = [...new Set([...diff.fetch, ...[...this.rows.values()].filter((r) => r.provisional && byId.get(r.id)?.deleted_at === null).map((r) => r.id)])].filter(
      (id) => byId.get(id)?.kind === 'template' && !this.rows.get(id)?.removing,
    );
    await this.fetchDocs(want);
    this.saveCache();
    this.publish();
    return this.expired ? 'auth' : 'ok';
  }

  private async fetchDocs(ids: readonly string[]): Promise<void> {
    const queue = [...ids];
    const worker = async (): Promise<void> => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        if (this.expired) return;
        const out = await this.call('GET', `${PLANS}/${id}`);
        if (out.kind === 'auth') {
          this.expired = true;
          return;
        }
        if (out.kind !== 'ok') continue;
        const got = accountPlanGet.safeParse(out.json);
        const doc = got.success ? parsePlanDraft(got.data.doc) : null;
        const row = this.rows.get(id);
        if (!got.success || !doc || !doc.success || !row) continue;
        row.doc = doc.data;
        row.revision = got.data.revision;
        delete row.provisional;
      }
    };
    await Promise.all(Array.from({ length: Math.min(FETCH_AT_ONCE, queue.length) }, worker));
  }

  // ---- the merge of device copies (4.2) ----

  /** Posts the device's copies; the ones the server confirmed leave the device. Returns true when anything moved. */
  private async mergeDevice(): Promise<boolean> {
    const env = readCopies(this.d.storage.getItem(COPIES_KEY));
    if (!env.ok || !needsMerge(env.envelope)) return false;
    const items = env.envelope.items;
    const out = await this.call('POST', `${PLANS}/merge`, items);
    if (out.kind === 'auth') {
      this.expired = true;
      return false;
    }
    if (out.kind !== 'ok') return false;
    const parsed = accountPlanMergeAnswer.safeParse(out.json);
    if (!parsed.success) return false;
    const a: AccountPlanMergeAnswer = parsed.data;
    const taken = new Set([...a.inserted, ...a.already, ...a.sameTrip]);
    // the document of each copy that now lives in the account is cached first (as the server will hold it, up to a title the next list
    // corrects), so the trip never disappears while the read-back is offline
    for (const c of items) {
      if (!a.inserted.includes(c.id) && !a.already.includes(c.id)) continue;
      if (this.rows.has(c.id)) continue;
      const doc = copyToPlanDraft(c);
      if (!doc.success) continue;
      const days = doc.data.nights === null ? null : doc.data.nights + 1;
      this.rows.set(c.id, {
        id: c.id,
        title: c.title,
        kind: 'template',
        source_trip: doc.data.template.trip,
        start: c.start,
        days,
        revision: 0,
        updated_at: this.d.now().toISOString(),
        deleted_at: null,
        doc: doc.data,
        provisional: true,
      });
    }
    this.saveCache();
    const at = this.d.now();
    updateCopies(this.d.storage, (e) => ({ envelope: markMerged(e, { inserted: a.inserted, already: a.already, sameTrip: a.sameTrip }, this.d.hash, at), value: null }));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED_EVENT));
    this.merge = { added: a.inserted.length, overCap: a.overCap.length, refused: a.refused.length };
    this.publish();
    return taken.size > 0;
  }

  // ---- editing ----

  /**
   * Applies operations to a trip at once (the screen updates) and queues them (the outbox first, 4.3), then sends. Returns the
   * inverse operations, in the order to apply them, for the toast's Undo.
   */
  edit(id: string, ops: readonly PlanOp[]): EditResult {
    const row = this.rows.get(id);
    let doc = this.view(id);
    if (!row || !doc || row.removing) return { ok: false, reason: 'unknown' };
    if (!this.outboxOk) return { ok: false, reason: 'storage' };
    const inverses: PlanOp[][] = [];
    for (const op of ops) {
      const r = applyOp(doc, op);
      if (!r.ok) return { ok: false, reason: 'invalid' };
      doc = r.doc;
      inverses.unshift(r.inverse);
    }
    let next = this.outbox;
    const at = this.d.now().toISOString();
    for (const op of ops) {
      const q = enqueue(next, { draft: id, op, base: row.revision, at });
      if (!q.ok) return { ok: false, reason: q.reason === 'full' ? 'full' : 'invalid' };
      next = q.outbox;
    }
    const before = this.outbox;
    this.outbox = next;
    if (!this.saveOutbox()) {
      this.outbox = before;
      return { ok: false, reason: 'storage' };
    }
    this.failed.delete(id);
    this.publish();
    void this.flushAll();
    return { ok: true, inverse: inverses.flat() };
  }

  /** Change dates (Mine's menu): the start, and the party with the profile that plans for it, together (bug B1). */
  changeDates(id: string, c: { start: string; adults: number; children: number[] }): EditResult {
    const doc = this.view(id);
    if (!doc?.template) return { ok: false, reason: 'unknown' };
    const youngest = c.children.length ? Math.min(...c.children) : null;
    const p = doc.template.profile;
    const profile = p ? { ...p, adults: c.adults, party: youngest === null ? ('adults' as const) : ('family' as const), youngest } : undefined;
    return this.edit(id, [
      { kind: 'setDates', id: this.d.newId(), start: c.start },
      { kind: 'setParty', id: this.d.newId(), travellers: { adults: c.adults, children: [...c.children] }, ...(profile ? { profile } : {}) },
    ]);
  }

  /** Undo of an edit: applies the inverse operations the edit returned, as new queued changes. */
  undo(id: string, inverse: readonly PlanOp[]): EditResult {
    return this.edit(id, inverse);
  }

  // ---- sending ----

  private async flushAll(): Promise<void> {
    const ids = new Set(this.outbox.items.map((c) => c.draft));
    for (const id of ids) await this.flushOne(id);
    for (const row of [...this.rows.values()]) if (row.removing) await this.flushDelete(row.id);
  }

  /** Retry (the chip): the rounds start again for this trip. */
  async retry(id: string): Promise<void> {
    this.failed.delete(id);
    this.publish();
    await this.sync();
  }

  /** One send per trip at a time; a second caller shares it (the loop below picks up changes made while it runs). */
  private flushOne(id: string): Promise<void> {
    const have = this.flights.get(id);
    if (have) return have;
    const p = this.send(id).finally(() => this.flights.delete(id));
    this.flights.set(id, p);
    return p;
  }

  /** Sends one trip's pending changes with its revision as `base`; rebases on a conflict up to PLAN_SYNC.rebaseRounds. */
  private async send(id: string): Promise<void> {
    const row = this.rows.get(id);
    if (!row?.doc || row.removing || this.failed.has(id)) return;
    if (!this.d.online()) return;
    if (!this.sending.has(id)) {
      this.sending.set(id, this.d.now().getTime());
      const t = this.d.schedule(() => {
        this.timers.delete(t);
        this.publish();
      }, SYNCING_AFTER_S * 1000 + 1);
      this.timers.add(t);
    }
    try {
      let round = 0;
      for (;;) {
        const pending = pendingFor(this.outbox, id);
        if (pending.length === 0) return;
        const next = applyOps(row.doc, pending);
        this.dropSkipped(id, row, next.skipped);
        const sent = touchDraft(next.doc, this.d.now());
        const out = await this.call('PUT', `${PLANS}/${id}`, { base: row.revision, title: row.title, doc: sent });
        if (out.kind === 'ok') {
          const w = accountPlanWritten.safeParse(out.json);
          if (!w.success) return;
          row.doc = sent;
          row.revision = w.data.revision;
          delete row.provisional;
          this.outbox = confirm(this.outbox, id, pending.map((p) => p.id));
          this.saveOutbox();
          this.saveCache();
          this.publish();
          continue; // changes made while this one was in the air go next, from the new revision
        }
        if (out.kind === 'conflict') {
          const c = accountPlanConflict.safeParse(out.json);
          if (!c.success) return void this.fail(id);
          if (c.data.deleted_at !== null || c.data.doc === null) return this.removedElsewhere(id, row, c.data.revision);
          const server = parsePlanDraft(c.data.doc);
          if (!server.success) return void this.fail(id);
          round += 1;
          const step = onConflict({ revision: c.data.revision, doc: server.data }, pending, round);
          row.doc = server.data;
          row.revision = c.data.revision;
          delete row.provisional;
          this.dropSkipped(id, row, step.skipped);
          this.saveCache();
          if (step.giveUp) return void this.fail(id);
          this.publish();
          continue;
        }
        if (out.kind === 'refused') return void this.fail(id);
        if (out.kind === 'auth') this.expired = true;
        return; // down or auth: the changes stay queued and the row reads "Not synced yet"
      }
    } finally {
      this.sending.delete(id);
      this.publish();
    }
  }

  private fail(id: string): void {
    this.failed.add(id);
    this.publish();
  }

  /** Operations the document will never take (their target is gone): out of the outbox, and said once (4.4 step 6). */
  private dropSkipped(id: string, row: CachedRow, skipped: readonly { op: PlanOp; reason: PlanSkipReason }[]): void {
    if (skipped.length === 0) return;
    this.outbox = confirm(this.outbox, id, skipped.map((s) => s.op.id));
    this.saveOutbox();
    this.notices = [...this.notices, { kind: 'skipped', id, title: row.title, count: skipped.length, reasons: [...new Set(skipped.map((s) => s.reason))] }];
  }

  /** A write found the trip removed on another device: its unsent changes are set aside with a way back (4.5). */
  private removedElsewhere(id: string, row: CachedRow, tomb: number): void {
    const pending = pendingFor(this.outbox, id).length;
    const cut = discardDraft(this.outbox, id);
    this.stashes.set(id, { row: { ...row }, doc: this.view(id) ?? (row.doc as PlanDraft), changes: cut.discarded, tomb });
    this.outbox = cut.outbox;
    this.saveOutbox();
    this.rows.delete(id);
    this.failed.delete(id);
    this.notices = [...this.notices, { kind: 'removed', id, title: row.title, count: pending }];
    this.saveCache();
    this.publish();
  }

  // ---- Remove (a tombstone) and its Undo (4.5) ----

  /** Remove: the trip leaves the list at once; the tombstone is sent. Returns the title for the toast. */
  remove(id: string): { title: string } | null {
    const row = this.rows.get(id);
    if (!row || row.removing) return null;
    const doc = this.view(id) ?? row.doc;
    const cut = discardDraft(this.outbox, id);
    if (doc) this.stashes.set(id, { row: { ...row }, doc, changes: cut.discarded });
    this.outbox = cut.outbox;
    this.saveOutbox();
    row.removing = true;
    this.failed.delete(id);
    this.saveCache();
    this.publish();
    void this.flushAll();
    return { title: row.title };
  }

  private flushDelete(id: string): Promise<void> {
    const have = this.deleting.get(id);
    if (have) return have;
    const p = (async () => {
      const row = this.rows.get(id);
      if (!row?.removing || !this.d.online()) return;
      let base = row.revision;
      for (let round = 0; round < PLAN_SYNC.rebaseRounds; round++) {
        const out = await this.call('DELETE', `${PLANS}/${id}`, { base });
        if (out.kind === 'ok') {
          const w = accountPlanWritten.safeParse(out.json);
          const s = this.stashes.get(id);
          if (s && w.success) s.tomb = w.data.revision;
          this.rows.delete(id);
          this.saveCache();
          return;
        }
        if (out.kind === 'conflict') {
          // the trip moved on another device, and the person asked to remove it: the newest revision is the one removed
          const c = accountPlanConflict.safeParse(out.json);
          if (!c.success) return;
          if (c.data.deleted_at !== null) {
            const s = this.stashes.get(id);
            if (s) s.tomb = c.data.revision;
            this.rows.delete(id);
            this.saveCache();
            return;
          }
          base = c.data.revision;
          continue;
        }
        if (out.kind === 'auth') this.expired = true;
        return; // retried at the next pass; the trip stays hidden
      }
    })().finally(() => {
      this.deleting.delete(id);
      this.publish();
    });
    this.deleting.set(id, p);
    return p;
  }

  /** Undo of Remove (or of "removed on another device"): the trip comes back with its changes. */
  async undoRemove(id: string): Promise<RestoreResult> {
    await this.deleting.get(id);
    const s = this.stashes.get(id);
    if (!s) return { ok: false, reason: 'gone' };
    const row = this.rows.get(id);
    if (row?.removing) {
      // the tombstone was not sent yet: nothing to restore, the trip and its unsent changes come back
      delete row.removing;
      let next = this.outbox;
      for (const c of s.changes) {
        const q = enqueue(next, c);
        if (q.ok) next = q.outbox;
      }
      this.outbox = next;
      this.saveOutbox();
      this.stashes.delete(id);
      this.saveCache();
      this.publish();
      void this.flushAll();
      return { ok: true };
    }
    if (s.tomb === undefined) return { ok: false, reason: 'gone' };
    if (!this.d.online()) return { ok: false, reason: 'offline' };
    const sent = touchDraft(s.doc, this.d.now());
    const out = await this.call('PUT', `${PLANS}/${id}`, { base: s.tomb, title: s.row.title, doc: sent, restore: true });
    if (out.kind === 'ok') {
      const w = accountPlanWritten.safeParse(out.json);
      if (!w.success) return { ok: false, reason: 'gone' };
      const back: CachedRow = { ...s.row, deleted_at: null, doc: sent, revision: w.data.revision };
      delete back.removing;
      delete back.provisional;
      this.rows.set(id, back);
      this.stashes.delete(id);
      this.saveCache();
      this.publish();
      return { ok: true };
    }
    this.publish();
    if (out.kind === 'down') return { ok: false, reason: 'offline' };
    // a refusal is the account's cap (50 live trips) or an answer the person cannot fix; a conflict means the tombstone moved on
    return { ok: false, reason: out.kind === 'refused' ? 'full' : 'gone' };
  }

  // ---- notices ----

  dismissNotice(index: number): void {
    this.notices = this.notices.filter((_, i) => i !== index);
    this.publish();
  }

  /** Changes waiting, per trip, for the sign-out question (4.6). */
  pendingByTrip(): { id: string; title: string; count: number }[] {
    return pendingCounts(this.outbox).map((p) => ({ id: p.draft, title: this.rows.get(p.draft)?.title ?? 'a trip', count: p.count }));
  }
}

// ---- the device, across accounts -------------------------------------------------------------------------------------------------

/** Keys of a Web Storage object that start with `prefix` (a store without enumeration, like the per-tab memory store, has none). */
function keysWith(storage: StorageLike, prefix: string): string[] {
  const s = storage as StorageLike & { length?: number; key?: (i: number) => string | null };
  if (typeof s.length !== 'number' || typeof s.key !== 'function') return [];
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && k.startsWith(prefix)) out.push(k);
  }
  return out;
}

/**
 * A user switch (4.3): every other account's cache is deleted, and so is its outbox when it is empty. A non-empty one stays until the
 * person decides at the sign-out question (4.6); it is never sent as this account.
 */
export function purgeOtherAccounts(storage: StorageLike, current: string): void {
  for (const k of keysWith(storage, ACCT_KEY_PREFIX)) if (k !== `${ACCT_KEY_PREFIX}${current}`) storage.removeItem(k);
  for (const k of keysWith(storage, OUTBOX_KEY_PREFIX)) {
    if (k === `${OUTBOX_KEY_PREFIX}${current}`) continue;
    const ob = readPlanOutbox(storage.getItem(k));
    if (ob.ok && ob.outbox.items.length === 0) storage.removeItem(k);
  }
}

/** Account hashes that hold anything on this device. */
function hashesOnDevice(storage: StorageLike): string[] {
  return [...new Set([...keysWith(storage, ACCT_KEY_PREFIX).map((k) => k.slice(ACCT_KEY_PREFIX.length)), ...keysWith(storage, OUTBOX_KEY_PREFIX).map((k) => k.slice(OUTBOX_KEY_PREFIX.length))])];
}

export interface UnsentSummary {
  count: number;
  trips: { id: string; title: string; count: number }[];
}

/** The changes this device holds that the account does not, across accounts: what the sign-out question names (4.6). */
export function unsentSummary(storage: StorageLike): UnsentSummary {
  const trips: UnsentSummary['trips'] = [];
  let count = 0;
  for (const h of hashesOnDevice(storage)) {
    const ob = readPlanOutbox(storage.getItem(`${OUTBOX_KEY_PREFIX}${h}`));
    if (!ob.ok || ob.outbox.items.length === 0) continue;
    const cache = readJson(storage.getItem(`${ACCT_KEY_PREFIX}${h}`)) as { rows?: { id?: unknown; title?: unknown }[] } | null;
    const titles = new Map((cache?.rows ?? []).flatMap((r) => (typeof r.id === 'string' && typeof r.title === 'string' ? [[r.id, r.title] as const] : [])));
    for (const p of pendingCounts(ob.outbox)) {
      trips.push({ id: p.draft, title: titles.get(p.draft) ?? 'a trip', count: p.count });
      count += p.count;
    }
  }
  return { count, trips };
}

/** Nothing of the account stays on the device after sign-out (4.6, visitor spec V12); copies made while signed out are not account data. */
export function clearAccountData(storage: StorageLike): void {
  for (const k of [...keysWith(storage, ACCT_KEY_PREFIX), ...keysWith(storage, OUTBOX_KEY_PREFIX)]) storage.removeItem(k);
}

/**
 * "Try again" at sign-out: sends this account's waiting changes once more. Another account's outbox is never sent as this one (4.3).
 * Returns what is still unsent, across accounts.
 */
export async function sendWaiting(storage: StorageLike, hash: string, deps: Omit<SyncDeps, 'storage' | 'hash'> = {}): Promise<UnsentSummary> {
  const ob = readPlanOutbox(storage.getItem(`${OUTBOX_KEY_PREFIX}${hash}`));
  if (ob.ok && ob.outbox.items.length > 0) {
    const engine = new AccountSync({ ...deps, storage, hash }).init();
    await engine.sync();
    engine.dispose();
  }
  return unsentSummary(storage);
}

/** The hash of an account (16 hex characters), the same one the copies envelope's `merged` map uses. */
export const hashOf = (userId: string): Promise<string> => accountHash(userId);
