import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, expect as browserExpect, type Browser, type Page, type Route } from '@playwright/test';
import { createViteServer } from 'vitest/node';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Account: Ways to sign in (GSI-WAYS; copy page 2.5, strings 29 to 51) in a real browser: the account page is rendered on the
// "server" with its boundaries mocked, then the real SignInMethods is mounted in the page (served by Vite), so focus, the inline confirm,
// the live region, the calls to the guard (answered here by a fake `/api/auth/*`) and the theme toggle run for real. No Neon, no Google.
// Screenshots of every state at 320, 390 and 1440, light and dark, 2x, go to web/test-results/shots/account-ways/ (gitignored).
const DAY = 86_400_000;
const state = vi.hoisted(() => ({ rows: [] as { providerId: string; createdAt: number }[] | null, google: '1' }));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('next/navigation', () => ({ usePathname: () => '/account/', useRouter: () => ({ refresh: () => undefined }), redirect: () => undefined }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/capabilities', () => ({ capabilities: { signIn: true } }));
vi.mock('@/lib/auth/flags', () => ({ authFlags: { signIn: true, signInCode: true, signInLink: false, get signInGoogle() { return state.google === '1'; } } }));
vi.mock('@/lib/auth/server', () => ({ getUser: async () => ({ id: 'ways-user', email: 'nitin.ways-check@gmail.com' }) }));
vi.mock('@/lib/auth/landing-server', () => ({ accountLanding: async () => 'returning' }));
vi.mock('@/lib/auth/ways-server', async () => {
  const { googleJustAdded } = await import('@/lib/auth/ways');
  return { accountWays: async () => state.rows, googleAddedNow: (added: boolean, rows: { providerId: string; createdAt: number }[] | null) => added && rows !== null && googleJustAdded(rows, Date.now()) };
});
vi.mock('@/lib/server/drafts', () => ({ readDrafts: async () => [] }));
vi.mock('@travel/core/db/profile.ts', () => ({ loadProfile: async () => ({ exists: false, travellers: null, travellersInvalid: false, travellersSavedAt: null, travellersConsentedAt: null, setupDoneAt: null, revision: 0 }) }));
vi.mock('@/app/account/actions', () => ({ createDraft: vi.fn(), renameDraft: vi.fn(), deleteDraft: vi.fn(), saveName: vi.fn() }));

import AccountPage from '@/app/account/page';
import { WAYS_COPY } from '@/lib/auth/ways';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { SiteFooter } from '@/components/shell/SiteFooter';
import { BottomBar } from '@/components/shell/BottomBar';

const web = new URL('../../', import.meta.url);
const styles = ['app/globals.css', 'app/themes.css', 'components/ui/ui.css', 'app/app.css', 'app/account.css']
  .map((file) => readFileSync(new URL(file, web), 'utf8').replace("@import 'tailwindcss';", ''))
  .join('\n');
const shots = new URL('test-results/shots/account-ways/', web);
const MASKED = 'n…@gmail.com';
const GOOGLE_URL = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&state=s1&code_challenge=c1&code_challenge_method=S256';
let browser: Browser;
let server: Awaited<ReturnType<typeof createViteServer>>;
let serverUrl: string;

beforeAll(async () => {
  mkdirSync(shots, { recursive: true });
  server = await createViteServer({
    configFile: false,
    root: fileURLToPath(web),
    // Its own dependency cache, as landing.browser.test.ts: two Vite servers on one root must not re-optimise each other's modules.
    cacheDir: fileURLToPath(new URL('node_modules/.vite-account-ways/', web)),
    resolve: { alias: { '@': fileURLToPath(web), 'next/link': '/ways-link.js' } },
    server: { host: '127.0.0.1', port: 0, cors: true },
    plugins: [{
      name: 'account-ways',
      resolveId: (id) => ['/ways-mount.js', '/ways-link.js'].includes(id) ? id : undefined,
      load(id) {
        if (id === '/ways-link.js') return `import {createElement} from 'react'; export default function Link(p){return createElement('a',p);}`;
        if (id === '/ways-mount.js') return `
          import {createElement} from 'react';
          import {createRoot} from 'react-dom/client';
          import {flushSync} from 'react-dom';
          import {ThemeToggle} from '/components/shell/ThemeToggle.tsx';
          import {SignInMethods} from '/app/account/SignInMethods.tsx';
          const mount = (node, el) => { const host = document.createElement('div'); host.style.display = 'contents'; node.replaceWith(host); flushSync(() => createRoot(host).render(el)); };
          mount(document.querySelector('[aria-label="Switch to dark theme"]'), createElement(ThemeToggle));
          const props = JSON.parse(document.documentElement.dataset.ways);
          mount(document.querySelector('.account-ways'), createElement(SignInMethods, props));
          document.documentElement.dataset.mounted = 'true';
        `;
      },
    }],
  });
  await server.listen();
  serverUrl = server.resolvedUrls!.local[0];
  browser = await chromium.launch({
    args: ['--use-gl=angle', process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  });
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function markup(params: Record<string, string> = {}): Promise<string> {
  const suspense = (await AccountPage({ searchParams: Promise.resolve(params) })) as ReactElement<{ children: ReactNode }>;
  const child = suspense.props.children as ReactElement<unknown, (p: unknown) => Promise<ReactNode>>;
  const content = await child.type(child.props);
  return renderToStaticMarkup(createElement('body', null, createElement(SiteHeader), createElement('main', { id: 'main', className: 'page' }, content), createElement(SiteFooter), createElement(BottomBar)));
}

type Api = (path: string, body: Record<string, unknown> | null) => { status: number; body: unknown; headers?: Record<string, string> } | undefined;
interface Opened {
  page: Page;
  calls: { path: string; body: Record<string, unknown> | null }[];
}

async function open(viewport: { width: number; height: number }, props: Record<string, unknown>, opts: { search?: string; session?: Record<string, string>; api?: Api } = {}): Promise<Opened> {
  const html = await markup();
  const calls: Opened['calls'] = [];
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'light', hasTouch: viewport.width < 640 });
  await context.route('**/*', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.host === 'accounts.google.com') {
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Google</title><h1>Choose an account</h1>' });
    } else if (url.pathname.startsWith('/api/auth/')) {
      const path = url.pathname.replace(/^\/api\/auth\//, '').replace(/\/$/, '');
      const raw = route.request().postData();
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
      calls.push({ path, body });
      const a = opts.api?.(path, body) ?? { status: 404, body: { code: 'NOT_FOUND' } };
      await route.fulfill({ status: a.status, contentType: 'application/json', headers: a.headers, body: JSON.stringify(a.body) });
    } else if (/^\/fonts\/[\w.-]+\.woff2$/.test(url.pathname)) {
      await route.fulfill({ body: readFileSync(new URL(`public${url.pathname}`, web)), contentType: 'font/woff2' });
    } else if (url.pathname === '/account/') {
      const page = `<!doctype html><html lang="en" data-theme="light" data-ways='${JSON.stringify(props).replace(/'/g, '&#39;')}'><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head>${html}</html>`;
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: page });
    } else {
      const response = await route.fetch({ url: new URL(`${url.pathname}${url.search}`, serverUrl).href });
      await route.fulfill({ response });
    }
  });
  if (opts.session) {
    await context.addInitScript((s: Record<string, string>) => {
      if (location.pathname !== '/account/') return;
      for (const [k, v] of Object.entries(s)) if (sessionStorage.getItem(`seeded:${k}`) === null) {
        sessionStorage.setItem(k, v);
        sessionStorage.setItem(`seeded:${k}`, '1');
      }
    }, opts.session);
  }
  const page = await context.newPage();
  for (let attempt = 1; ; attempt += 1) {
    await page.goto(`http://account.test/account/${opts.search ?? ''}`);
    try {
      await page.addScriptTag({ type: 'module', url: 'http://account.test/ways-mount.js' });
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      await page.waitForTimeout(500 * attempt);
    }
  }
  await browserExpect(page.locator('html')).toHaveAttribute('data-mounted', 'true');
  await page.evaluate(() => document.fonts.ready);
  return { page, calls };
}

const PASSWORD = { providerId: 'credential', createdAt: Date.parse('2026-10-01T08:00:00Z') };
const GOOGLE = { providerId: 'google', createdAt: Date.parse('2026-10-26T09:00:00Z') };
const base = { masked: MASKED, googleOn: true, justAdded: false };

async function dark(page: Page) {
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await browserExpect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await browserExpect(page.locator('html')).not.toHaveClass(/theme-fade/);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }))).toEqual({ document: 0, body: 0 });
}

/** The visible part of every button in the section ends inside the section, and on a phone each has a 44 px target. */
async function targets(page: Page, phone: boolean) {
  const section = (await page.locator('.account-ways').boundingBox())!;
  for (const b of await page.locator('.account-ways .btn').all()) {
    const box = (await b.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(section.x);
    expect(box.x + box.width).toBeLessThanOrEqual(section.x + section.width + 0.5);
    if (phone) {
      const hit = await b.evaluate((el) => {
        const s = getComputedStyle(el, '::after');
        return { w: parseFloat(s.width), h: parseFloat(s.height) };
      });
      expect(hit.w).toBeGreaterThanOrEqual(44);
      expect(hit.h).toBeGreaterThanOrEqual(44);
    }
  }
}

async function shot(page: Page, name: string) {
  await page.locator('.account-ways').scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, shots)) });
  // The section alone, without the fixed phone bottom bar laid over it (the page pads its foot for the bar; a capture does not).
  await page.addStyleTag({ content: '.bottom-bar { visibility: hidden; }' });
  // A clip of a full-page capture: an element capture of a section taller than the viewport cuts its foot.
  const clip = await page.locator('.account-ways').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
  });
  await page.screenshot({ path: fileURLToPath(new URL(`${name}-section.png`, shots)), fullPage: true, clip });
}

const VIEWPORTS = [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 1440, height: 900 }];

for (const viewport of VIEWPORTS) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`ways to sign in ${viewport.width} ${theme}`, () => {
      const phone = viewport.width < 640;
      const tag = `${viewport.width}x${viewport.height}-${theme}`;

      it('Google added: rows 30 to 32, Remove, the notes; nothing clipped', async () => {
        state.rows = [PASSWORD, GOOGLE];
        const { page } = await open(viewport, { ...base, rows: [PASSWORD, GOOGLE] });
        try {
          if (theme === 'dark') await dark(page);
          await browserExpect(page.locator('.ways-row[data-way="google"] .ways-name')).toHaveText('Google · , Added 26 Oct 2026');
          await browserExpect(page.getByRole('button', { name: 'Remove Google' })).toBeVisible();
          await noOverflow(page);
          await targets(page, phone);
          await shot(page, `google-added-${tag}`);
        } finally {
          await page.context().close();
        }
      });

      it('Google is the only way in: no Remove, string 47', async () => {
        state.rows = [GOOGLE];
        const { page } = await open(viewport, { ...base, rows: [GOOGLE] });
        try {
          if (theme === 'dark') await dark(page);
          await browserExpect(page.locator('.account-ways')).toContainText(WAYS_COPY.removeLast);
          await browserExpect(page.getByRole('button', { name: /Remove/ })).toHaveCount(0);
          await noOverflow(page);
          await shot(page, `google-only-${tag}`);
        } finally {
          await page.context().close();
        }
      });

      it('the confirm (41 to 45): focus on Keep Google, Keep first, the link opens a new tab; Esc returns to Remove', async () => {
        state.rows = [PASSWORD, GOOGLE];
        const { page } = await open(viewport, { ...base, rows: [PASSWORD, GOOGLE] });
        try {
          if (theme === 'dark') await dark(page);
          const remove = page.getByRole('button', { name: 'Remove Google' }).first();
          await remove.click();
          const dialog = page.getByRole('dialog', { name: 'Remove Google?' });
          await browserExpect(dialog).toBeVisible();
          // 42 then 43; the accessible name of the link carries its "(opens in a new tab)" tail
          const described = await dialog.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent ?? '');
          expect(described).toBe(`${WAYS_COPY.removeBody}${WAYS_COPY.removeGoogleSideBefore}${WAYS_COPY.removeGoogleSideLink}${WAYS_COPY.newTab}${WAYS_COPY.removeGoogleSideAfter}`);
          const keep = dialog.getByRole('button', { name: 'Keep Google' });
          await browserExpect(keep).toBeFocused();
          const link = dialog.getByRole('link', { name: `${WAYS_COPY.removeGoogleSideLink}${WAYS_COPY.newTab}` });
          await browserExpect(link).toHaveAttribute('href', 'https://myaccount.google.com/permissions');
          await browserExpect(link).toHaveAttribute('target', '_blank');
          await page.waitForTimeout(260); // the 200 ms open
          await noOverflow(page);
          await targets(page, phone);
          await shot(page, `confirm-${tag}`);
          await page.keyboard.press('Shift+Tab');
          await browserExpect(link).toBeFocused();
          await keep.focus();
          await page.keyboard.press('Tab');
          await browserExpect(dialog.getByRole('button', { name: 'Remove Google' })).toBeFocused();
          await page.keyboard.press('Escape');
          await browserExpect(dialog).toHaveCount(0);
          await browserExpect(page.getByRole('button', { name: 'Remove Google' })).toBeFocused();
        } finally {
          await page.context().close();
        }
      });

      it('no Google: Add Google (33) with its help (34)', async () => {
        state.rows = [];
        const { page } = await open(viewport, { ...base, rows: [] });
        try {
          if (theme === 'dark') await dark(page);
          const add = page.getByRole('button', { name: 'Add Google' });
          await browserExpect(add).toHaveAccessibleDescription(WAYS_COPY.addHelp(MASKED));
          await noOverflow(page);
          await targets(page, phone);
          await shot(page, `no-google-${tag}`);
        } finally {
          await page.context().close();
        }
      });

      it('removed (46): the guard is asked, the rows re-read, the notice read once, focus on Add Google', async () => {
        state.rows = [PASSWORD, GOOGLE];
        const { page, calls } = await open(viewport, { ...base, rows: [PASSWORD, GOOGLE] }, {
          api: (path) =>
            path === 'unlink-account' ? { status: 200, body: { ok: true } } : path === 'list-accounts' ? { status: 200, body: { accounts: [PASSWORD] } } : undefined,
        });
        try {
          if (theme === 'dark') await dark(page);
          await page.getByRole('button', { name: 'Remove Google' }).first().click();
          await page.getByRole('dialog').getByRole('button', { name: 'Remove Google' }).click();
          await browserExpect(page.locator('.ways-notice .ban-text')).toHaveText(WAYS_COPY.removed);
          await browserExpect(page.locator('.account-ways [aria-live="polite"]')).toHaveText(WAYS_COPY.removed);
          await browserExpect(page.getByRole('button', { name: 'Add Google' })).toBeFocused();
          expect(calls).toEqual([{ path: 'unlink-account', body: { providerId: 'google' } }, { path: 'list-accounts', body: null }]);
          await noOverflow(page);
          await shot(page, `removed-${tag}`);
        } finally {
          await page.context().close();
        }
      });

      it('the return of Add Google (35)', async () => {
        const rows = [PASSWORD, { providerId: 'google', createdAt: Date.now() - 30_000 }];
        state.rows = rows;
        const { page } = await open(viewport, { ...base, rows, justAdded: true }, { search: '?added=google' });
        try {
          if (theme === 'dark') await dark(page);
          await browserExpect(page.locator('.ways-notice .ban-text')).toHaveText(WAYS_COPY.added);
          expect(new URL(page.url()).search).toBe('');
          await noOverflow(page);
          await shot(page, `added-${tag}`);
        } finally {
          await page.context().close();
        }
      });
    });
  }
}

describe('ways to sign in: behaviour', () => {
  const phone = { width: 390, height: 844 };

  it('Add Google: asks the guard with the provider only, marks the press, and leaves for Google', async () => {
    const { page, calls } = await open(phone, { ...base, rows: [] }, { api: (path) => (path === 'link-social' ? { status: 200, body: { url: GOOGLE_URL } } : undefined) });
    try {
      await page.getByRole('button', { name: 'Add Google' }).click();
      await page.waitForURL(/accounts\.google\.com/);
      expect(calls).toEqual([{ path: 'link-social', body: { provider: 'google' } }]);
      await page.goBack();
      expect(await page.evaluate(() => sessionStorage.getItem('auth.googleAdd'))).toMatch(/^\d+$/);
    } finally {
      await page.context().close();
    }
  });

  it('Add Google: an address that is not Google\'s is never followed (39)', async () => {
    const { page } = await open(phone, { ...base, rows: [] }, { api: (path) => (path === 'link-social' ? { status: 200, body: { url: 'https://evil.example/' } } : undefined) });
    try {
      await page.getByRole('button', { name: 'Add Google' }).click();
      await browserExpect(page.locator('.ways-notice .ban-text')).toHaveText(WAYS_COPY.addFailed);
      expect(new URL(page.url()).host).toBe('account.test');
    } finally {
      await page.context().close();
    }
  });

  it('Add Google refused for too many attempts: the wait, no "use your email below"', async () => {
    const { page } = await open(phone, { ...base, rows: [] }, { api: (path) => (path === 'link-social' ? { status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '60' } } : undefined) });
    try {
      await page.getByRole('button', { name: 'Add Google' }).click();
      await browserExpect(page.locator('.ways-notice .ban-text')).toHaveText('Too many attempts. Please wait a minute, then try again.');
    } finally {
      await page.context().close();
    }
  });

  it.each([
    ['email_does_not_match', WAYS_COPY.emailMismatch(MASKED)],
    ["email_doesn't_match", WAYS_COPY.emailMismatch(MASKED)],
    ['access_denied', WAYS_COPY.addCancelled],
    ['account_already_linked_to_different_user', WAYS_COPY.usedElsewhere],
    ['<img src=x onerror=alert(1)>', WAYS_COPY.addFailed],
  ])('the Add Google return with ?error=%s after this tab\'s press: its notice, and the address cleaned', async (code, text) => {
    const { page } = await open(phone, { ...base, rows: [] }, { search: `?added=google&error=${encodeURIComponent(code)}&error_description=raw+text`, session: { 'auth.googleAdd': String(Date.now() - 20_000) } });
    try {
      await browserExpect(page.locator('.ways-notice .ban-text')).toHaveText(text);
      expect(new URL(page.url()).search).toBe('');
      expect(await page.content()).not.toContain('raw text');
      expect(await page.evaluate(() => sessionStorage.getItem('auth.googleAdd'))).toBeNull();
      if (code === 'email_does_not_match') await page.locator('.account-ways').screenshot({ path: fileURLToPath(new URL('add-email-mismatch-390x844-light-section.png', shots)) });
    } finally {
      await page.context().close();
    }
  });

  it('a crafted ?error= without a recent press from this tab shows nothing, and is cleaned', async () => {
    for (const session of [undefined, { 'auth.googleAdd': String(Date.now() - DAY) }]) {
      const { page } = await open(phone, { ...base, rows: [] }, { search: '?added=google&error=account_already_linked_to_different_user', session });
      try {
        await browserExpect(page.locator('.ways-notice')).toHaveCount(0);
        expect(new URL(page.url()).search).toBe('');
      } finally {
        await page.context().close();
      }
    }
  });

  it.each([
    ['LAST_METHOD', 409, WAYS_COPY.removeLast],
    ['REAUTH_REQUIRED', 403, WAYS_COPY.removeSignInAgain],
    ['SERVICE_UNAVAILABLE', 503, WAYS_COPY.removeFailed],
  ])('the guard refuses a removal with %s: its notice, and focus back on Remove', async (code, status, text) => {
    const { page } = await open(phone, { ...base, rows: [PASSWORD, GOOGLE] }, {
      api: (path) => (path === 'unlink-account' ? { status, body: { code } } : path === 'list-accounts' ? { status: 200, body: { accounts: [PASSWORD, GOOGLE] } } : undefined),
    });
    try {
      await page.getByRole('button', { name: 'Remove Google' }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Remove Google' }).click();
      await browserExpect(page.locator('.ways-notice .ban-text')).toHaveText(text);
      await browserExpect(page.getByRole('dialog')).toHaveCount(0);
      await browserExpect(page.getByRole('button', { name: 'Remove Google' })).toBeFocused();
      if (code === 'REAUTH_REQUIRED') await page.locator('.account-ways').screenshot({ path: fileURLToPath(new URL('reauth-390x844-light-section.png', shots)) });
    } finally {
      await page.context().close();
    }
  });

  it('the Google flag off: 50, and nothing to press', async () => {
    for (const rows of [[PASSWORD, GOOGLE], []]) {
      const { page } = await open(phone, { ...base, googleOn: false, rows });
      try {
        await browserExpect(page.locator('.account-ways')).toContainText(WAYS_COPY.off);
        await browserExpect(page.locator('.account-ways button')).toHaveCount(0);
        await page.locator('.account-ways').screenshot({ path: fileURLToPath(new URL(`flag-off-${rows.length ? 'added' : 'none'}-390x844-light-section.png`, shots)) });
      } finally {
        await page.context().close();
      }
    }
  });

  it('reduced motion: the confirm shows at once', async () => {
    const { page } = await open({ width: 1440, height: 900 }, { ...base, rows: [PASSWORD, GOOGLE] });
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Remove Google' }).click();
      expect(await page.locator('.ways-confirm').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    } finally {
      await page.context().close();
    }
  });
});
