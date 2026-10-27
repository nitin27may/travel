// The stop on Account after Continue with Google (GSI-2; copy page W3, Q-GC3, strings 23 to 28): the notice, Continue to the checked
// `next`, and nothing for a returning sign-in. The landing is mocked at its boundary (`accountLanding`); its rules are landing.test.ts.
import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInNotice } from '@/app/account/SignInNotice';
import { LANDING_COPY, landingHint, landingText } from '@/lib/auth/landing';

const state = vi.hoisted(() => ({ landing: 'returning' as string }));
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
// GSI-WAYS: the rows of "Ways to sign in" (an email-code account with Google added); its own tests are ways*.test.ts.
vi.mock('@/lib/auth/ways-server', async () => {
  const { googleJustAdded } = await import('@/lib/auth/ways');
  return { accountWays: async () => [{ providerId: 'google', createdAt: Date.parse('2026-10-26T09:00:00Z') }], googleAddedNow: (added: boolean, rows: { providerId: string; createdAt: number }[] | null) => added && rows !== null && googleJustAdded(rows, Date.now()) };
});
vi.mock('@/lib/server/drafts', () => ({ readDrafts: async () => [] }));
vi.mock('@travel/core/db/profile.ts', () => ({ loadProfile: async () => ({ exists: false, travellers: null, travellersInvalid: false, travellersSavedAt: null, travellersConsentedAt: null, setupDoneAt: '2026-10-20T00:00:00.000Z', revision: 0 }) }));
vi.mock('@/app/account/actions', () => ({ createDraft: vi.fn(), renameDraft: vi.fn(), deleteDraft: vi.fn(), saveName: vi.fn() }));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SIGN_IN', '1');
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
  state.landing = 'returning';
});

/** The account page for `?next=` (or none), with its request-time body resolved and rendered, as the layout test does. */
async function body(next?: unknown): Promise<string> {
  const { default: AccountPage } = await import('@/app/account/page');
  const params = next === undefined ? {} : { next };
  const suspense = (await AccountPage({ searchParams: Promise.resolve(params as Record<string, string>) })) as ReactElement<{ children: ReactNode }>;
  const child = suspense.props.children as ReactElement<unknown, (p: unknown) => Promise<ReactNode>>;
  return renderToStaticMarkup(createElement('main', null, await child.type(child.props)));
}
/** The text of the markup, tags removed (the masked address sits in its own span so it never breaks). */
const text = (h: string) => h.replace(/<[^>]+>/g, '');

const MASKED = 'n…@gmail.com';

describe('the account page with a landing', () => {
  it('new, from a page: notice 23 under the heading with Continue to that page (27)', async () => {
    state.landing = 'new';
    const h = await body('/places/lake-louise/');
    expect(text(h)).toContain(LANDING_COPY.new(MASKED));
    expect(h.indexOf('</header>')).toBeLessThan(h.indexOf('account-landing'));
    // next/link writes the trailing slash in the build (trailingSlash: true), not in a unit render
    expect(h).toMatch(/<a class="btn btn-primary" href="\/places\/lake-louise\/?">Continue<span class="sr-only"> to the page you were on<\/span><\/a>/);
    expect(text(h)).not.toContain(LANDING_COPY.newHint);
    expect(h).toContain('<span class="account-landing-address">n…@gmail.com</span>'); // 24 joins after mount, from this tab's round trip only
  });
  it('linked: notice 25 with Continue, and 26 linking to "Ways to sign in" on the same page (GSI-WAYS)', async () => {
    state.landing = 'linked';
    const h = await body('/mine/');
    expect(text(h)).toContain(LANDING_COPY.linked(MASKED));
    expect(h).toMatch(/href="\/mine\/?">Continue</);
    expect(h).toContain(`<a class="account-landing-undo" href="#ways-to-sign-in">${LANDING_COPY.linkedUndo}</a>`);
    expect(h).toContain('<h2 id="ways-to-sign-in"');
  });
  it('new: no undo link (26 follows 25 only)', async () => {
    state.landing = 'new';
    const h = await body('/mine/');
    expect(h).not.toContain(LANDING_COPY.linkedUndo);
  });
  it('without next: the notice and no button', async () => {
    state.landing = 'new';
    const h = await body();
    expect(text(h)).toContain(LANDING_COPY.new(MASKED));
    expect(h).not.toContain('>Continue<');
  });
  it.each(['//evil.example/', 'https://evil.example/', '/\\evil.example', '/api/auth/sign-out', 'javascript:alert(1)', '/%2F%2Fevil.example', '/account/'])(
    'a refused next (%j) gives no button and is never echoed',
    async (next) => {
      state.landing = 'linked';
      const h = await body(next);
      expect(text(h)).toContain(LANDING_COPY.linked(MASKED));
      expect(h).not.toContain('>Continue<');
      expect(h).not.toContain('evil');
      expect(h).not.toContain('javascript');
    },
  );
  it.each(['returning', 'unknown'])('%s: no notice (unknown stays on Account without one)', async (landing) => {
    state.landing = landing;
    const h = await body();
    expect(h).not.toContain('account-landing');
  });
  it('the notice shows the masked address only; the full one stays in "Signed in as"', async () => {
    state.landing = 'new';
    const h = await body('/mine/');
    const notice = h.slice(h.indexOf('account-landing'));
    expect(notice).not.toContain('nitin.test@gmail.com');
    expect(h).toContain('Signed in as nitin.test@gmail.com');
  });
});

describe('SignInNotice', () => {
  it('the 5.4 notice anatomy without role="status" (the live region reads it once), with an empty polite region', () => {
    const h = renderToStaticMarkup(<SignInNotice kind="new" masked={MASKED} next={null} />);
    expect(h).toContain('class="ban ban-notice account-landing"');
    expect(h).not.toContain('role=');
    expect(h).toContain('<p class="sr-only" aria-live="polite" aria-atomic="true"></p>');
    expect(h).toContain('aria-hidden="true"'); // the icon
  });
});

describe('string 24 (landingHint)', () => {
  const now = 1_800_000_000_000;
  const fresh = String(now - 30_000);
  it('only for a new account, after a recent press, when this browser had a way in before', () => {
    expect(landingHint('new', { mark: fresh, hadMethod: true }, now)).toBe(true);
    expect(landingHint('new', { mark: fresh, hadMethod: false }, now)).toBe(false);
    expect(landingHint('linked', { mark: fresh, hadMethod: true }, now)).toBe(false);
    expect(landingHint('new', { mark: null, hadMethod: true }, now)).toBe(false);
    expect(landingHint('new', { mark: String(now - 11 * 60_000), hadMethod: true }, now)).toBe(false);
    expect(landingHint('new', { mark: 'garbage', hadMethod: true }, now)).toBe(false);
    expect(landingHint('new', { mark: String(now + 60_000), hadMethod: true }, now)).toBe(false);
  });
  it('the words: 23 then 24 as one notice; 25 alone', () => {
    expect(landingText('new', MASKED, true)).toBe(`${LANDING_COPY.new(MASKED)} ${LANDING_COPY.newHint}`);
    expect(landingText('new', MASKED, false)).toBe(LANDING_COPY.new(MASKED));
    expect(landingText('linked', MASKED, true)).toBe(LANDING_COPY.linked(MASKED));
  });
});
