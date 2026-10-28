// /account/ as the server renders it (ACCT-P1; spec 2.1, 2.5): the order of the sections, no create box and no live status, and the
// fail-closed reads. The name editor and the list in a browser are profile.browser.test.ts.
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ profile: 'ok' as 'ok' | 'saved' | 'missing' | 'throws', setup: true, name: 'Nitin' as string | null }));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('next/navigation', () => ({ usePathname: () => '/account/', useRouter: () => ({ refresh: () => undefined }), redirect: () => undefined }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/auth/server', () => ({ getUser: async () => ({ id: 'u1', email: 'nitin.test@gmail.com', name: state.name }) }));
vi.mock('@/lib/auth/landing-server', () => ({ accountLanding: async () => 'returning' }));
vi.mock('@/lib/auth/ways-server', () => ({ accountWays: async () => [{ providerId: 'credential', createdAt: 0 }], googleAddedNow: () => false }));
// the page reads no title-only drafts any more (review ACCT-PR MF1): a read here would fail the test
vi.mock('@/lib/server/drafts', () => ({
  readDrafts: async () => {
    throw new Error('the Account page must not read the title-only drafts');
  },
}));
vi.mock('@travel/core/db/profile.ts', () => ({
  loadProfile: async () => {
    if (state.profile === 'throws') throw new Error('db down');
    if (state.profile === 'missing') throw Object.assign(new Error('relation "account_profile" does not exist'), { code: '42P01' });
    const travellers = state.profile === 'saved' ? { schema: 'travellers/1', adults: 2, children: [{ age: 7, age_as_of: new Date().toISOString().slice(0, 10) }] } : null;
    return { exists: travellers !== null, travellers, travellersInvalid: false, travellersSavedAt: null, travellersConsentedAt: null, setupDoneAt: state.setup ? '2026-10-20T00:00:00.000Z' : null, revision: travellers ? 1 : 0 };
  },
}));
vi.mock('@/app/account/actions', () => ({ createDraft: vi.fn(), renameDraft: vi.fn(), deleteDraft: vi.fn(), saveName: vi.fn() }));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '1');
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  Object.assign(state, { setup: true, profile: 'ok', name: 'Nitin' });
});

async function html(): Promise<string> {
  const { default: AccountPage } = await import('@/app/account/page');
  const suspense = (await AccountPage({ searchParams: Promise.resolve({}) })) as ReactElement<{ children: ReactNode }>;
  const child = suspense.props.children as ReactElement<unknown, (p: unknown) => Promise<ReactNode>>;
  return renderToStaticMarkup(createElement('main', null, await child.type(child.props)));
}
const h2s = (h: string) => [...h.matchAll(/<h2[^>]*>(.*?)<\/h2>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&middot;|·/g, '·').trim());

describe('first run (ACCT-P2, spec 2.3)', () => {
  it('shows the setup card instead of Profile and Travellers when the row was read and setup is not done', async () => {
    state.setup = false;
    const h = await html();
    expect(h).toContain('Set up your account');
    expect(h).toContain('Step 1 of 2');
    expect(h2s(h)).toEqual(expect.arrayContaining(['What should we call you?', 'Ways to sign in', 'Your data']));
    expect(h2s(h)).not.toContain('Profile');
    expect(h2s(h)).not.toContain('Travellers');
  });
  it('never shows the card after a failed read or without the table (fail closed)', async () => {
    state.setup = false;
    for (const profile of ['throws', 'missing'] as const) {
      state.profile = profile;
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(await html()).not.toContain('Set up your account');
    }
  });
  it('a finished setup shows the settled Travellers section', async () => {
    state.profile = 'saved';
    const h = await html();
    expect(h).not.toContain('Set up your account');
    expect(h).toContain('2 adults · 1 child (7)');
  });
});

describe('the page', () => {
  it('sections in the order of spec 2.1, one h1, one h2 each', async () => {
    const h = await html();
    expect(h.match(/<h1/g)).toHaveLength(1);
    expect(h2s(h).filter((t) => !t.startsWith('No '))).toEqual(['Profile', 'Travellers', 'Ways to sign in', 'My trips', 'Your data']);
    expect(h).not.toContain('Saved trips');
    expect(h).toContain('Nitin');
  });
  it('has no create box and no live status text (AC 1)', async () => {
    const h = await html();
    for (const t of ['Draft title', 'Create draft', 'Reconnecting', 'live updates', 'Live<']) expect(h).not.toContain(t);
    expect(h).not.toContain('live-dot');
  });
  it('My trips (MF1): the flag off says where copies are, with Open Mine; no Rename or Delete, no "saved" wording', async () => {
    const h = await html();
    expect(h).toContain('No trips in your account yet.');
    expect(h).toContain('Trips you copy stay on this device for now. See them in Mine.');
    expect(h).toMatch(/href="\/mine\/?\?show=trips"/);
    for (const t of ['Rename', 'Delete', 'Draft actions', 'Saved ', 'saved here']) expect(h).not.toContain(t);
  });
  it('My trips with the accountTrips flag on: a loading row until the account answers (the rows are the client hook\'s)', async () => {
    vi.stubEnv('NEXT_PUBLIC_ACCOUNT_TRIPS', '1');
    const h = await html();
    expect(h).toContain('aria-label="Loading your trips"');
    expect(h).not.toContain('No trips in your account yet.');
  });
  it('Travellers: the empty state with the spec copy and its Add button; a saved party reads in words', async () => {
    let h = await html();
    expect(h).toContain('No travellers saved.');
    expect(h).toContain('Add who usually travels with you, and every trip starts from it.');
    expect(h).toContain('Add travellers');
    expect(h).not.toContain('Save travellers'); // the editor opens on a click
    state.profile = 'saved';
    h = await html();
    expect(h).toContain('2 adults · 1 child (7)');
  });
  it('Your data: the download link, and the one delete line (Ways to sign in no longer repeats it)', async () => {
    const h = await html();
    expect(h).toContain('href="/api/account/profile/export/" download=""');
    expect(h).toContain('Download my data');
    expect(h.match(/To delete your account/g)).toHaveLength(1);
    expect(h).not.toContain('everything in it');
    expect(h).not.toContain('/api/account/export/');
  });
  it('a name that is not set says so', async () => {
    state.name = null;
    expect(await html()).toContain('Not set');
  });
});

describe('fail closed', () => {
  it('loadProfile throws (SF5): the Name row still shows (it is Neon Auth\'s), Travellers keeps its heading with the error, no setup card', async () => {
    state.profile = 'throws';
    state.setup = false;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const h = await html();
    expect(h2s(h).slice(0, 2)).toEqual(['Profile', 'Travellers']);
    expect(h).toContain('Nitin');
    expect(h).toContain('Edit name');
    expect(h).toContain("We couldn&#x27;t load your travellers.");
    expect(h).not.toContain("We couldn&#x27;t load your profile.");
    expect(h).not.toContain('No travellers saved.');
    expect(h).not.toContain('Set up your account');
    expect(h).toContain('Ways to sign in');
    expect(h).toContain('My trips');
    expect(JSON.stringify(log.mock.calls)).not.toContain('db down');
  });
  it('the table is missing (migration 0012 not applied): the name section only, one fixed log code', async () => {
    state.profile = 'missing';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const h = await html();
    expect(h2s(h)[0]).toBe('Profile');
    expect(h).not.toContain('Travellers');
    expect(h).toContain('Nitin');
    expect(warn).toHaveBeenCalledWith('[account] profile_table_missing');
  });
  it('the signed-out page never says "saved" for trips', async () => {
    vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '0');
    vi.resetModules();
    const { default: AccountPage } = await import('@/app/account/page');
    const h = renderToStaticMarkup((await AccountPage({ searchParams: Promise.resolve({}) })) as ReactElement);
    expect(h).toContain('Sign in to keep your trips and travellers in your account.');
    expect(h).not.toContain('drafts');
  });
});
