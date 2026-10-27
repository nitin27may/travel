// Account: Ways to sign in (GSI-WAYS; copy page 2.5, strings 29 to 51), as the server renders it. The rows are mocked at their boundary
// (`accountWays`; its reader is ways.test.ts, the routes ways-routes.test.ts); the section's behaviour in a browser is
// ways.browser.test.ts.
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WayRow } from '@/lib/auth/ways';

const NOW = Date.parse('2026-10-27T10:00:00Z');
const state = vi.hoisted(() => ({ landing: 'returning' as string, rows: null as WayRow[] | null }));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/account/',
  useRouter: () => ({ refresh: () => undefined }),
  redirect: (to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { to });
  },
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/auth/server', () => ({ getUser: async () => ({ id: 'u1', email: 'nitin.test@gmail.com' }) }));
vi.mock('@/lib/auth/landing-server', () => ({ accountLanding: async () => state.landing }));
vi.mock('@/lib/auth/ways-server', async () => {
  const { googleJustAdded } = await import('@/lib/auth/ways');
  return { accountWays: async () => state.rows, googleAddedNow: (added: boolean, rows: { providerId: string; createdAt: number }[] | null) => added && rows !== null && googleJustAdded(rows, Date.now()) };
});
vi.mock('@/lib/server/drafts', () => ({ readDrafts: async () => [] }));
vi.mock('@travel/core/db/profile.ts', () => ({ loadProfile: async () => ({ exists: false, travellers: null, travellersInvalid: false, travellersSavedAt: null, travellersConsentedAt: null, setupDoneAt: '2026-10-20T00:00:00.000Z', revision: 0 }) }));
vi.mock('@/app/account/actions', () => ({ createDraft: vi.fn(), renameDraft: vi.fn(), deleteDraft: vi.fn(), saveName: vi.fn() }));

import { WAYS_COPY } from '@/lib/auth/ways';
import { LANDING_COPY } from '@/lib/auth/landing';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '1');
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN_GOOGLE', '1');
  vi.resetModules();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  state.landing = 'returning';
  state.rows = null;
});

async function body(params: Record<string, string> = {}): Promise<string> {
  const { default: AccountPage } = await import('@/app/account/page');
  const suspense = (await AccountPage({ searchParams: Promise.resolve(params) })) as ReactElement<{ children: ReactNode }>;
  const child = suspense.props.children as ReactElement<unknown, (p: unknown) => Promise<ReactNode>>;
  return renderToStaticMarkup(createElement('main', null, await child.type(child.props)));
}
const text = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");
const section = (h: string) => {
  const from = h.slice(h.indexOf('<section class="account-ways"'));
  return from.slice(0, from.indexOf('</section>') + '</section>'.length);
};

const PASSWORD: WayRow = { providerId: 'credential', createdAt: Date.parse('2026-10-01T08:00:00Z') };
const GOOGLE: WayRow = { providerId: 'google', createdAt: Date.parse('2026-10-26T09:00:00Z') };
const MASKED = 'n…@gmail.com';

describe('the rows', () => {
  it('password and Google: 29 to 32, Remove with its screen-reader tail (40), the sign-out note (49); no delete line (it lives in Your data)', async () => {
    state.rows = [PASSWORD, GOOGLE];
    const h = await body();
    const s = section(h);
    expect(h.indexOf('id="profile"')).toBeLessThan(h.indexOf('account-ways')); // Profile leads, then Travellers, then the ways (spec 2.1)
    expect(h.indexOf('account-ways')).toBeLessThan(h.indexOf('id="saved-trips"'));
    expect(s).toContain('<h2 id="ways-to-sign-in" class="ways-title">Ways to sign in</h2>');
    expect(s).toContain('aria-labelledby="ways-to-sign-in"');
    const t = text(s);
    expect(t).toContain('Email · , A 6-digit code sent to this address');
    expect(t).toContain('Password · , Set');
    expect(t).toContain('Google · , Added 26 Oct 2026');
    expect(s).toMatch(/<button type="button" class="btn btn-ghost btn-sm" data-ways-focus="remove" aria-expanded="false"><span class="btn-label">Remove<span class="sr-only"> Google<\/span><\/span><\/button>/);
    expect(t).toContain(WAYS_COPY.signOutNote);
    expect(s).not.toContain('mailto:');
    expect(t).not.toContain('To delete your account');
    expect(t).not.toContain(WAYS_COPY.add);
    expect(t).not.toContain(WAYS_COPY.removeLast);
    // the dialog opens on demand only
    expect(s).not.toContain('role="dialog"');
  });

  it('an emailed-code account: Email, then Add Google (33) described by its help (34); no Password row, no Remove', async () => {
    state.rows = [];
    const s = section(await body());
    const t = text(s);
    expect(t).not.toContain('Password');
    expect(t).not.toContain('Added');
    const help = /<p class="ways-note" id="([^"]+)">(.+?)<\/p>/.exec(s);
    expect(text(help?.[2] ?? '')).toBe(WAYS_COPY.addHelp(MASKED));
    expect(help?.[2]).toContain(`<span class="ways-address">${MASKED}</span>`);
    expect(s).toContain(`aria-describedby="${help?.[1]}"`);
    expect(s).toMatch(/data-ways-focus="add"[^>]*><span class="btn-label">Add Google<\/span>/);
    expect(t).not.toContain(WAYS_COPY.remove + ' ');
    expect(t).not.toContain(WAYS_COPY.signOutNote);
  });

  it('Google is the only row: no Remove, string 47 says why, and 49', async () => {
    state.rows = [GOOGLE];
    const s = section(await body());
    const t = text(s);
    expect(t).toContain('Google · , Added 26 Oct 2026');
    expect(t).toContain(WAYS_COPY.removeLast);
    expect(t).toContain(WAYS_COPY.signOutNote);
    expect(s).not.toContain('data-ways-focus="remove"');
    expect(s).not.toContain('data-ways-focus="add"');
  });

  it('the Google flag off: rows read-only, 50 in place of Add or Remove', async () => {
    vi.stubEnv('NEXT_PUBLIC_SIGN_IN_GOOGLE', '0');
    state.rows = [PASSWORD, GOOGLE];
    let s = section(await body());
    expect(text(s)).toContain('Google · , Added 26 Oct 2026');
    expect(text(s)).toContain(WAYS_COPY.off);
    expect(s).not.toContain('data-ways-focus');
    state.rows = [];
    s = section(await body());
    expect(text(s)).toContain(WAYS_COPY.off);
    expect(s).not.toContain('data-ways-focus');
  });

  it('rows that cannot be read: Email, the proposed "couldn\'t check" line, nothing to add or remove', async () => {
    state.rows = null;
    const s = section(await body());
    const t = text(s);
    expect(t).toContain('Email · , A 6-digit code sent to this address');
    expect(t).toContain(WAYS_COPY.unreadable);
    expect(t).not.toContain('Google');
    expect(s).not.toContain('data-ways-focus');
  });

  it('the full address never appears in the section (W6): only the masked one', async () => {
    state.rows = [];
    const s = section(await body());
    expect(s).not.toContain('nitin.test@gmail.com');
    expect(s).toContain(MASKED);
  });
});

describe('the return of Add Google (`?added=google`)', () => {
  it('with a Google row from the last minutes: the landing notice 25 gives way to the section (35 after mount)', async () => {
    state.landing = 'linked';
    state.rows = [PASSWORD, { providerId: 'google', createdAt: NOW - 30_000 }];
    const h = await body({ added: 'google' });
    expect(h).not.toContain('account-landing');
    expect(text(h)).not.toContain(LANDING_COPY.linked(MASKED));
    expect(h).toContain('account-ways');
  });

  it('a crafted `?added=google` without a recent Google row changes nothing: the landing notice stays when the rows say linked', async () => {
    state.landing = 'linked';
    state.rows = [PASSWORD, GOOGLE]; // added yesterday
    const h = await body({ added: 'google' });
    expect(h).toContain('account-landing');
  });

  it('another value of `added` is ignored', async () => {
    state.landing = 'linked';
    state.rows = [PASSWORD, { providerId: 'google', createdAt: NOW - 30_000 }];
    expect(await body({ added: 'Google' })).toContain('account-landing');
  });

  it('a returning sign-in with `next` still goes straight there', async () => {
    state.landing = 'returning';
    state.rows = [PASSWORD, GOOGLE];
    const { default: AccountPage } = await import('@/app/account/page');
    await expect(AccountPage({ searchParams: Promise.resolve({ next: '/trips/', added: 'google' }) })).rejects.toMatchObject({ to: '/trips/' });
  });
});
