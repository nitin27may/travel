import type { Page, Route } from '@playwright/test';

// A fake account for the signed-in Mine specs (EM-2): the session and /api/account/plans/** answered inside the page's context, so the
// real client sync runs against known answers. It applies the routes' rules that the specs need (revision, the 409 body, the tombstone
// and its restore, the merge); it is not the real server (EM-E runs that on the preview).

export const USER = { id: 'u-em2', email: 'nitin@example.com' };
export const IDS = {
  a: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b',
  b: '7a2d1b63-9e1f-4c8f-8b62-3d4e5f6a7b8c',
  c: '8b3e2c74-0f20-4d90-9c73-4e5f6a7b8c9d',
} as const;

type Doc = Record<string, unknown> & { start?: string; template: Record<string, unknown> };
export interface FakeRow {
  id: string;
  title: string;
  doc: Doc | null;
  revision: number;
  deleted_at: string | null;
}

/** A `plan-draft/1` template document the way the merge makes it from a copy. */
export function planDoc(id: string, o: { trip?: string; start?: string; adults?: number; children?: number[]; days?: number } = {}): Doc {
  const days = o.days ?? 14;
  const children = o.children ?? [6];
  return {
    schema: 'plan-draft/1',
    id,
    title: null,
    where: { mode: 'trip', cc: 'IT', regions: [] },
    nights: days - 1,
    pace: 'standard',
    moves: 'balanced',
    month: Number((o.start ?? '2027-07-03').slice(5, 7)),
    party: 'trip',
    picks: [],
    bases: [],
    edits: [],
    origin: null,
    seed: null,
    lastBuild: null,
    createdAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    template: {
      trip: o.trip ?? 'dolomites-2027',
      rev: null,
      profile: { party: children.length ? 'family' : 'adults', youngest: children.length ? Math.min(...children) : null, pace: 'standard', adults: o.adults ?? 2, walk: null, split: false },
      window: null,
      overrides: { '5': 'C' },
      added: [],
      removed: [],
      moved: [],
      days: [],
      notes: {},
      maybe: [],
    },
    start: o.start ?? '2027-07-03',
    travellers: { adults: o.adults ?? 2, children },
  } as Doc;
}

export class FakeAccount {
  rows = new Map<string, FakeRow>();
  /** `ok`; `net` drops the connection; a number answers that status with a plain body */
  mode: 'ok' | 'net' | number = 'ok';
  /** every write answers 409 with the row as it is (the rebase never settles) */
  bump = false;
  calls: string[] = [];
  /** answer the merge with these ids as `overCap` (the copies stay on the device) */
  overCap = false;
  /** hold every write this many ms before answering (the "Syncing" chip needs a send in the air for over a second) */
  delayMs = 0;

  add(id: string, title: string, o: Parameters<typeof planDoc>[1] = {}): void {
    this.rows.set(id, { id, title, doc: planDoc(id, o), revision: 0, deleted_at: null });
  }

  private fields(r: FakeRow) {
    return {
      id: r.id,
      title: r.title,
      kind: r.doc ? 'template' : null,
      source_trip: r.doc ? (r.doc.template.trip as string) : null,
      start: r.doc?.start ?? null,
      days: r.doc ? ((r.doc.nights as number) + 1) : null,
      revision: r.revision,
      updated_at: '2026-10-27T10:00:00.000Z',
      deleted_at: r.deleted_at,
    };
  }

  async install(page: Page, signedIn = true): Promise<void> {
    await page.route('**/api/auth/get-session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: signedIn
          ? JSON.stringify({ session: { id: 's1', userId: USER.id, expiresAt: '2099-01-01T00:00:00.000Z', token: 't' }, user: { id: USER.id, email: USER.email, name: 'N', emailVerified: true } })
          : 'null',
      }),
    );
    await page.route('**/api/account/plans**', (route) => this.handle(route));
  }

  private json(route: Route, status: number, body: unknown): Promise<void> {
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  }

  private async handle(route: Route): Promise<void> {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname.replace('/api/account/plans', '').replace(/\/$/, '');
    this.calls.push(`${method} ${path || '/'}`);
    if (this.mode === 'net') return route.abort('failed');
    if (this.mode !== 'ok') return this.json(route, this.mode, { code: this.mode === 404 ? 'NOT_FOUND' : 'SERVICE_UNAVAILABLE' });
    if (this.delayMs && (method === 'PUT' || method === 'DELETE')) await new Promise((r) => setTimeout(r, this.delayMs));
    const body = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : null;
    if (method === 'GET' && path === '') return this.json(route, 200, { items: [...this.rows.values()].map((r) => this.fields(r)) });
    if (method === 'POST' && path === '/merge') {
      const copies = body as unknown as { id: string; slug: string; title: string; start: string; adults: number; children: number[]; days: number | null }[];
      const answer = { inserted: [] as string[], already: [] as string[], sameTrip: [] as string[], both: [] as string[], overCap: [] as string[], refused: [] as string[] };
      for (const c of copies) {
        if (this.overCap) answer.overCap.push(c.id);
        else if (this.rows.has(c.id)) answer.already.push(c.id);
        else {
          this.rows.set(c.id, { id: c.id, title: c.title, doc: planDoc(c.id, { trip: c.slug, start: c.start, adults: c.adults, children: c.children, days: c.days ?? 14 }), revision: 0, deleted_at: null });
          answer.inserted.push(c.id);
        }
      }
      return this.json(route, 200, answer);
    }
    const row = this.rows.get(path.slice(1)) ?? null;
    if (method === 'GET') return row && !row.deleted_at ? this.json(route, 200, { revision: row.revision, doc: row.doc }) : this.json(route, 404, { code: 'NOT_FOUND' });
    if (method === 'PUT') {
      const b = body as { base: number | null; doc: Doc; title: string; restore?: boolean };
      if (!row) return this.json(route, 404, { code: 'NOT_FOUND' });
      if (this.bump) {
        row.revision += 1;
        return this.json(route, 409, { revision: row.revision, doc: row.doc, deleted_at: row.deleted_at });
      }
      const stale = b.base !== row.revision || (row.deleted_at !== null && !b.restore);
      if (stale) return this.json(route, 409, { revision: row.revision, doc: row.doc, deleted_at: row.deleted_at });
      row.doc = b.doc;
      row.deleted_at = null;
      row.revision += 1;
      return this.json(route, 200, { revision: row.revision });
    }
    if (method === 'DELETE') {
      if (!row) return this.json(route, 404, { code: 'NOT_FOUND' });
      row.doc = null;
      row.deleted_at = '2026-10-27T10:00:00.000Z';
      row.revision += 1;
      return this.json(route, 200, { revision: row.revision });
    }
    return this.json(route, 404, { code: 'NOT_FOUND' });
  }
}
