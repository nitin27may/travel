import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, expect as browserExpect, type Browser, type Page } from '@playwright/test';
import { createViteServer } from 'vitest/node';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The stop on Account after Continue with Google (GSI-2; copy page 2.4, strings 23 to 27) in a real browser: the account page is
// rendered on the server with the landing mocked at its boundary, then the real SignInNotice is mounted in the page (served by Vite)
// so its after-mount read of the round trip (string 24), the live region and the theme toggle run for real. No Neon, no Google.
const state = vi.hoisted(() => ({ landing: 'new' as 'new' | 'linked' }));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('next/navigation', () => ({ usePathname: () => '/account/', redirect: () => undefined }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/capabilities', () => ({ capabilities: { signIn: true } }));
vi.mock('@/lib/auth/server', () => ({ getUser: async () => ({ id: 'landing-user', email: 'nitin.landing-regression@gmail.com' }) }));
vi.mock('@/lib/auth/landing-server', () => ({ accountLanding: async () => state.landing }));
vi.mock('@/lib/server/drafts', () => ({ loadDrafts: async () => ({ rows: [], sealedQuery: {} }) }));
vi.mock('@/lib/server/neon-env', () => ({ dataEnv: () => ({ realtimeUrl: 'https://realtime.invalid' }) }));
vi.mock('@/app/account/actions', () => ({ createDraft: vi.fn(), renameDraft: vi.fn(), deleteDraft: vi.fn() }));
vi.mock('@/app/account/RealtimeRoot', () => ({ RealtimeRoot: ({ children }: { children: ReactNode }) => children }));
vi.mock('@neon/realtime-react', () => ({ useLiveQuery: () => ({ data: [], status: 'live', utils: {} }) }));

import AccountPage from '@/app/account/page';
import { LANDING_COPY } from '@/lib/auth/landing';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { SiteFooter } from '@/components/shell/SiteFooter';
import { BottomBar } from '@/components/shell/BottomBar';

const web = new URL('../../', import.meta.url);
const styles = ['app/globals.css', 'app/themes.css', 'components/ui/ui.css', 'app/app.css', 'app/account.css']
  .map((file) => readFileSync(new URL(file, web), 'utf8').replace("@import 'tailwindcss';", ''))
  .join('\n');
const MASKED = 'n…@gmail.com';
let browser: Browser;
let server: Awaited<ReturnType<typeof createViteServer>>;
let serverUrl: string;

beforeAll(async () => {
  server = await createViteServer({
    configFile: false,
    root: fileURLToPath(web),
    // Its own dependency cache: layout.browser.test.ts runs a Vite server on the same root at the same time, and a shared cache
    // re-optimised by one reloads the other's page mid-test.
    cacheDir: fileURLToPath(new URL('node_modules/.vite-account-landing/', web)),
    resolve: { alias: { '@': fileURLToPath(web), 'next/link': '/landing-link.js' } },
    server: { host: '127.0.0.1', port: 0, cors: true },
    plugins: [{
      name: 'account-landing',
      resolveId: (id) => ['/landing-mount.js', '/landing-link.js'].includes(id) ? id : undefined,
      load(id) {
        if (id === '/landing-link.js') return `import {createElement} from 'react'; export default function Link(p){return createElement('a',p);}`;
        // Swap the server-rendered theme button and notice for live React roots (the real components).
        if (id === '/landing-mount.js') return `
          import {createElement} from 'react';
          import {createRoot} from 'react-dom/client';
          import {flushSync} from 'react-dom';
          import {ThemeToggle} from '/components/shell/ThemeToggle.tsx';
          import {SignInNotice} from '/app/account/SignInNotice.tsx';
          const mount = (node, el) => { const host = document.createElement('div'); host.style.display = 'contents'; node.replaceWith(host); flushSync(() => createRoot(host).render(el)); };
          mount(document.querySelector('[aria-label="Switch to dark theme"]'), createElement(ThemeToggle));
          const props = JSON.parse(document.documentElement.dataset.landing);
          mount(document.querySelector('.account-landing'), createElement(SignInNotice, props));
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

/** The page's request-time body, rendered on the "server". */
async function markup(next: string): Promise<string> {
  const suspense = (await AccountPage({ searchParams: Promise.resolve({ next }) })) as ReactElement<{ children: ReactNode }>;
  const child = suspense.props.children as ReactElement<unknown, (p: unknown) => Promise<ReactNode>>;
  const content = await child.type(child.props);
  return renderToStaticMarkup(createElement('body', null,
    createElement(SiteHeader),
    createElement('main', { id: 'main', className: 'page' }, content),
    createElement(SiteFooter),
    createElement(BottomBar),
  ));
}

async function open(viewport: { width: number; height: number }, html: string, props: object, session: Record<string, string>): Promise<Page> {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'light', hasTouch: viewport.width < 640 });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (/^\/fonts\/[\w.-]+\.woff2$/.test(url.pathname)) {
      await route.fulfill({ body: readFileSync(new URL(`public${url.pathname}`, web)), contentType: 'font/woff2' });
    } else if (url.pathname === '/account/') {
      const page = `<!doctype html><html lang="en" data-theme="light" data-landing='${JSON.stringify(props)}'><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head>${html}</html>`;
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: page });
    } else {
      const response = await route.fetch({ url: new URL(`${url.pathname}${url.search}`, serverUrl).href });
      await route.fulfill({ response });
    }
  });
  await context.addInitScript((s: Record<string, string>) => {
    for (const [k, v] of Object.entries(s)) sessionStorage.setItem(k, v);
  }, session);
  const page = await context.newPage();
  // Vite may still be optimising React on the first load (its reload drops the module): try again on a fresh load.
  for (let attempt = 1; ; attempt += 1) {
    await page.goto('http://account.test/account/');
    try {
      await page.addScriptTag({ type: 'module', url: 'http://account.test/landing-mount.js' });
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      await page.waitForTimeout(500 * attempt);
    }
  }
  await browserExpect(page.locator('html')).toHaveAttribute('data-mounted', 'true');
  return page;
}

const cases = [
  { name: 'new-hint', landing: 'new' as const, hint: true, text: `${LANDING_COPY.new(MASKED)} ${LANDING_COPY.newHint}` },
  { name: 'linked', landing: 'linked' as const, hint: false, text: LANDING_COPY.linked(MASKED) },
];

for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  for (const theme of ['light', 'dark']) {
    describe(`account landing ${viewport.width} ${theme}`, () => {
      for (const c of cases) {
        it(`${c.name}: the notice under the heading, Continue reachable, nothing clipped`, async () => {
          state.landing = c.landing;
          const html = await markup('/places/lake-louise/');
          // A press from this tab half a minute ago, after a code sign-in on this browser (string 24's case).
          const session = { 'auth.googlePending': String(Date.now() - 30_000), 'auth.googleBefore': 'code' };
          const page = await open(viewport, html, { kind: c.landing, masked: MASKED, next: '/places/lake-louise/' }, session);
          try {
            if (theme === 'dark') {
              await page.getByRole('button', { name: 'Switch to dark theme' }).click();
              await browserExpect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
              await browserExpect(page.locator('html')).not.toHaveClass(/theme-fade/);
            }
            await page.evaluate(() => document.fonts.ready);
            const notice = page.locator('.account-landing');
            await browserExpect(notice.locator('.ban-text')).toHaveText(c.text);
            // read once by the polite region; the round trip is gone from the tab
            await browserExpect(notice.locator('[aria-live="polite"]')).toHaveText(c.text);
            expect(await page.evaluate(() => [sessionStorage.getItem('auth.googlePending'), sessionStorage.getItem('auth.googleBefore')])).toEqual([null, null]);
            expect(await page.evaluate(() => ({
              document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              body: document.body.scrollWidth - document.body.clientWidth,
            }))).toEqual({ document: 0, body: 0 });

            const go = page.getByRole('link', { name: 'Continue to the page you were on' });
            await browserExpect(go).toBeVisible();
            await browserExpect(go).toHaveAttribute('href', '/places/lake-louise/');
            const box = (await go.boundingBox())!;
            const text = (await notice.locator('.ban-text').boundingBox())!;
            const head = (await page.locator('.account-head').boundingBox())!;
            const ban = (await notice.boundingBox())!;
            expect(ban.y).toBeGreaterThanOrEqual(head.y + head.height);
            expect(box.x + box.width).toBeLessThanOrEqual(ban.x + ban.width);
            expect(box.y + box.height).toBeLessThanOrEqual(ban.y + ban.height);
            expect(box.height).toBe(38);
            if (viewport.width >= 640) {
              // beside the text on a wide column
              expect(box.x).toBeGreaterThanOrEqual(text.x + text.width);
            } else {
              // under the text on a phone, with a 44 px target
              expect(box.y).toBeGreaterThanOrEqual(text.y + text.height);
              const target = await go.evaluate((el) => {
                const hit = getComputedStyle(el, '::after');
                return { height: parseFloat(hit.height), width: parseFloat(hit.width) };
              });
              expect(target.height).toBeGreaterThanOrEqual(44);
              expect(target.width).toBeGreaterThanOrEqual(44);
            }
            await go.focus();
            await browserExpect(go).toBeFocused();
            await page.locator('h1').evaluate((el) => (el as HTMLElement).scrollIntoView());
            const shots = new URL('test-results/shots/account-landing/', web);
            mkdirSync(shots, { recursive: true });
            await page.screenshot({ path: fileURLToPath(new URL(`${c.name}-${viewport.width}x${viewport.height}-${theme}.png`, shots)), fullPage: true });
          } finally {
            await page.context().close();
          }
        });
      }
    });
  }
}

describe('account landing: string 24 needs this tab\'s recent press after an earlier way in', () => {
  it.each([
    ['no earlier way in', { 'auth.googlePending': 'NOW' }],
    ['a stale press', { 'auth.googlePending': 'OLD', 'auth.googleBefore': 'code' }],
    ['no press in this tab', { 'auth.googleBefore': 'code' }],
  ])('%s: 23 alone', async (_name, raw) => {
    state.landing = 'new';
    const html = await markup('/mine/');
    const session = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === 'NOW' ? String(Date.now() - 5_000) : v === 'OLD' ? String(Date.now() - 11 * 60_000) : v]));
    const page = await open({ width: 390, height: 844 }, html, { kind: 'new', masked: MASKED, next: '/mine/' }, session);
    try {
      await browserExpect(page.locator('.account-landing [aria-live="polite"]')).toHaveText(LANDING_COPY.new(MASKED));
      await browserExpect(page.locator('.account-landing .ban-text')).toHaveText(LANDING_COPY.new(MASKED));
    } finally {
      await page.context().close();
    }
  });
});
