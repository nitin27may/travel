import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy, ID_A } from './helpers';

// STEP2-T1: the flag, the page behind it, and the Open link. Off (the default) the site is today's: /t/ answers 404 and Mine's Open keeps
// the /trips/ link; on, /t/<id>/ is a private page and Open goes to it.

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/components/trips/edit/shell/TripShell', () => ({ TripShell: () => null }));

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe('the tripEdit flag', () => {
  it('is on only with NEXT_PUBLIC_TRIP_EDIT=1', async () => {
    const { tripEditFlag } = await import('@/lib/trip-edit/flag');
    expect(tripEditFlag({})).toBe(false);
    expect(tripEditFlag({ tripEdit: '' })).toBe(false);
    expect(tripEditFlag({ tripEdit: '0' })).toBe(false);
    expect(tripEditFlag({ tripEdit: 'true' })).toBe(false);
    expect(tripEditFlag({ tripEdit: '1' })).toBe(true);
  });

  it('reads the environment once, at load', async () => {
    expect((await import('@/lib/trip-edit/flag')).TRIP_EDIT_ON).toBe(false);
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_TRIP_EDIT', '1');
    expect((await import('@/lib/trip-edit/flag')).TRIP_EDIT_ON).toBe(true);
  });
});

describe('/t/[id]/', () => {
  const params = Promise.resolve({ id: ID_A });

  it('answers notFound() when the flag is off, whatever the id', async () => {
    const page = await import('@/app/t/[id]/page');
    await expect(page.default({ params })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(page.default({ params: Promise.resolve({ id: 'anything' }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders the shell when the flag is on, and knows nothing of the trip on the server', async () => {
    vi.stubEnv('NEXT_PUBLIC_TRIP_EDIT', '1');
    const page = await import('@/app/t/[id]/page');
    const el = (await page.default({ params })) as { props: Record<string, unknown> };
    expect(el.props.id).toBe(ID_A);
    expect(Object.keys(el.props).sort()).toEqual(['id', 'signIn']);
  });

  it('is private: noindex, no canonical, no share image', async () => {
    const page = await import('@/app/t/[id]/page');
    const meta = page.generateMetadata();
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates).toBeUndefined();
    expect(meta.openGraph).toBeUndefined();
    expect(meta.twitter).toBeUndefined();
    expect(JSON.stringify(meta)).not.toMatch(/og\/|\.png|\.jpg|\.webp/);
    expect(page.dynamic).toBe('force-dynamic');
  });
});

describe("Mine's Open link", () => {
  it("keeps the trip's own page off the table while the flag is off", async () => {
    const { openHref } = await import('@/lib/mine/rows');
    expect(openHref(copy())).toMatch(/^\/trips\/dolomites-2027\/\?p=family-6/);
  });

  it('goes to /t/<id>/?view=day when the flag is on', async () => {
    vi.stubEnv('NEXT_PUBLIC_TRIP_EDIT', '1');
    const { openHref, rowModel } = await import('@/lib/mine/rows');
    expect(openHref(copy())).toBe(`/t/${ID_A}/?view=day`);
    expect(rowModel(copy(), '2026-10-28').href).toBe(`/t/${ID_A}/?view=day`);
  });
});

describe('a mine=<id> link on /trips/', () => {
  it('names a copy id, and not the older mine=1 marker', async () => {
    const { isTripId, tripHref } = await import('@/lib/trip-edit/keys');
    expect(isTripId(ID_A)).toBe(true);
    expect(isTripId('1')).toBe(false);
    expect(isTripId(null)).toBe(false);
    expect(tripHref(ID_A)).toBe(`/t/${ID_A}/`);
    expect(tripHref(ID_A, 'view=day')).toBe(`/t/${ID_A}/?view=day`);
  });
});
