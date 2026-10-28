import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, expect as browserExpect, type Browser } from '@playwright/test';
import { createViteServer } from 'vitest/node';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Render the actual account components, replacing only request/service boundaries. No credentials,
// synthetic database writes or live services are needed for a browser layout regression.
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('next/navigation', () => ({ usePathname: () => '/account/', useRouter: () => ({ refresh: () => undefined }) }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/lib/capabilities', () => ({ capabilities: { signIn: true } }));
vi.mock('@/lib/auth/server', () => ({
  getUser: async () => ({ id: 'layout-user', email: 'account-layout-regression@travel-e2e.invalid' }),
}));
// The page's states come from the profile row (the title-only drafts are no longer read: review ACCT-PR MF1)
const profile = vi.hoisted(() => ({ state: 'setup' as 'setup' | 'settled' | 'failed' }));
vi.mock('@travel/core/db/profile.ts', () => ({
  loadProfile: async () => {
    if (profile.state === 'failed') throw new Error('Layout fixture: service unavailable');
    const today = new Date().toISOString().slice(0, 10);
    const travellers = profile.state === 'settled' ? { schema: 'travellers/1', adults: 2, children: [{ age: 7, age_as_of: today }, { age: 9, age_as_of: today }] } : null;
    return { exists: true, travellers, travellersInvalid: false, travellersSavedAt: null, travellersConsentedAt: null, setupDoneAt: profile.state === 'setup' ? null : '2026-10-20T00:00:00.000Z', revision: travellers ? 1 : 0 };
  },
}));
// GSI-2: a returning sign-in (no notice); the stop has its own layout test, landing.browser.test.ts.
vi.mock('@/lib/auth/landing-server', () => ({ accountLanding: async () => 'returning' }));
// GSI-WAYS: the rows of "Ways to sign in" (an email-code account with Google added); its own tests are ways*.test.ts.
vi.mock('@/lib/auth/ways-server', async () => {
  const { googleJustAdded } = await import('@/lib/auth/ways');
  return { accountWays: async () => [{ providerId: 'google', createdAt: Date.parse('2026-10-26T09:00:00Z') }], googleAddedNow: (added: boolean, rows: { providerId: string; createdAt: number }[] | null) => added && rows !== null && googleJustAdded(rows, Date.now()) };
});
vi.mock('@/app/account/actions', () => ({ createDraft: vi.fn(), renameDraft: vi.fn(), deleteDraft: vi.fn(), saveName: vi.fn() }));

import AccountPage from '@/app/account/page';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { SiteFooter } from '@/components/shell/SiteFooter';
import { BottomBar } from '@/components/shell/BottomBar';

const web = new URL('../../', import.meta.url);
const styles = ['app/globals.css', 'app/themes.css', 'components/ui/ui.css', 'app/app.css', 'app/account.css']
  .map((file) => readFileSync(new URL(file, web), 'utf8').replace("@import 'tailwindcss';", ''))
  .join('\n');
let browser: Browser;
let themeServer: Awaited<ReturnType<typeof createViteServer>>;
let themeUrl: string;

beforeAll(async () => {
  // Serve the real interactive theme component, not a copied click handler. Only next/link is
  // stubbed: this isolated component has no Next router and its links are not exercised here.
  themeServer = await createViteServer({
    configFile: false,
    root: fileURLToPath(web),
    resolve: { alias: { '@': fileURLToPath(web), 'next/link': '/layout-link.js' } },
    server: { host: '127.0.0.1', port: 0, cors: true },
    plugins: [{
      name: 'account-layout-theme',
      resolveId: (id) => ['/layout-theme.js', '/layout-link.js'].includes(id) ? id : undefined,
      load(id) {
        if (id === '/layout-link.js') return `import {createElement} from 'react'; export default function Link(p){return createElement('a',p);}`;
        if (id === '/layout-theme.js') return `
          import {createElement} from 'react';
          import {createRoot} from 'react-dom/client';
          import {flushSync} from 'react-dom';
          import {ThemeToggle} from '/components/shell/ThemeToggle.tsx';
          const host = document.createElement('span');
          host.style.display = 'contents';
          document.querySelector('[aria-label="Switch to dark theme"]').replaceWith(host);
          flushSync(() => createRoot(host).render(createElement(ThemeToggle)));
          document.documentElement.dataset.themeReady = 'true';
        `;
      },
    }],
  });
  await themeServer.listen();
  themeUrl = themeServer.resolvedUrls!.local[0];
  browser = await chromium.launch({
    args: ['--use-gl=angle', process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
  });
});
afterAll(async () => {
  await browser?.close();
  await themeServer?.close();
});

for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  for (const theme of ['light', 'dark']) {
    describe(`account layout ${viewport.width} ${theme}`, () => {
      for (const state of ['setup', 'settled', 'failed'] as const) {
        it(`${state}: no horizontal overflow and sign-out remains reachable`, async () => {
          profile.state = state;

          // Resolve the request-time server child of Suspense, then SSR its real client components.
          // This tests AccountBody's markup too, rather than maintaining a duplicate header fixture.
          const suspense = (await AccountPage({ searchParams: Promise.resolve({}) })) as ReactElement<{ children: ReactNode }>;
          const body = suspense.props.children as ReactElement<unknown, (p: unknown) => Promise<ReactNode>>;
          const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
          let content: ReactNode;
          try { content = await body.type(body.props); } finally { log.mockRestore(); }
          const markup = renderToStaticMarkup(createElement('body', null,
            createElement(SiteHeader),
            createElement('main', { id: 'main', className: 'page' }, content),
            createElement(SiteFooter),
            createElement(BottomBar),
          ));
          const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'light', hasTouch: viewport.width < 640 });
          try {
            await context.route('**/*', async (route) => {
              const pathname = new URL(route.request().url()).pathname;
              if (/^\/fonts\/[\w.-]+\.woff2$/.test(pathname)) {
                await route.fulfill({ body: readFileSync(new URL(`public${pathname}`, web)), contentType: 'font/woff2' });
              } else if (pathname === '/account/') {
                await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="en" data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head>${markup}</html>` });
              } else {
                // Keep modules same-origin in Chromium, while Vite supplies real React/TSX code.
                const url = new URL(route.request().url());
                const response = await route.fetch({ url: new URL(`${url.pathname}${url.search}`, themeUrl).href });
                await route.fulfill({ response });
              }
            });
            const page = await context.newPage();
            await page.goto('http://account.test/account/');
            await page.addScriptTag({ type: 'module', url: 'http://account.test/layout-theme.js' });
            await browserExpect(page.locator('html')).toHaveAttribute('data-theme-ready', 'true');
            await browserExpect(page.locator('html')).toHaveAttribute('data-theme', 'light');
            if (theme === 'dark') {
              const background = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
              await page.getByRole('button', { name: 'Switch to dark theme' }).click();
              await browserExpect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
              await browserExpect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
              await browserExpect(page.locator('html')).not.toHaveClass(/theme-fade/);
              expect(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(background);
              expect(await page.evaluate(() => localStorage.getItem('travel:v1:theme'))).toBe('dark');
            }
            await page.evaluate(() => document.fonts.ready);
            const marker = state === 'setup' ? 'What should we call you?' : state === 'settled' ? '2 adults · 2 children (7, 9)' : "We couldn't load your travellers.";
            await browserExpect(page.getByText(marker, { exact: true })).toBeVisible();
            await browserExpect(page.getByText('No trips in your account yet.', { exact: true })).toBeVisible();
            expect(await page.evaluate(() => ({
              document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              body: document.body.scrollWidth - document.body.clientWidth,
            }))).toEqual({ document: 0, body: 0 });

            const signOut = page.getByRole('button', { name: 'Sign out', exact: true });
            await browserExpect(signOut).toBeVisible();
            await browserExpect(signOut).toBeEnabled();
            const button = await signOut.boundingBox();
            const identity = await page.locator('.account-identity').boundingBox();
            expect(button).not.toBeNull();
            expect(identity).not.toBeNull();
            expect(button!.x + button!.width).toBeLessThanOrEqual(viewport.width);
            expect(identity!.x + identity!.width).toBeLessThanOrEqual(button!.x);
            expect(button!.height).toBe(38); // Preserve the existing secondary-button size.
            if (viewport.width < 640) {
              // Pseudo-elements do not change boundingBox(): measure the target and hit-test both
              // extended edges outside the visible face so a cosmetic 44px box cannot pass.
              const target = await signOut.evaluate((el) => {
                const hit = getComputedStyle(el, '::after');
                const rect = el.getBoundingClientRect();
                const height = parseFloat(hit.height);
                const width = parseFloat(hit.width);
                const x = rect.x + rect.width / 2;
                return {
                  height, width,
                  topHits: el.contains(document.elementFromPoint(x, rect.y + rect.height / 2 - height / 2 + 0.5)),
                  bottomHits: el.contains(document.elementFromPoint(x, rect.y + rect.height / 2 + height / 2 - 0.5)),
                };
              });
              expect(target.height).toBeGreaterThanOrEqual(44);
              expect(target.width).toBeGreaterThanOrEqual(44);
              expect(target.topHits).toBe(true);
              expect(target.bottomHits).toBe(true);
            }
            await signOut.click({ trial: true }); // Hit testing without signing out: service behavior stays in neon-e2e.
            await signOut.focus();
            await browserExpect(signOut).toBeFocused();
            // SF4: the whole address shows, wrapped where it must, never cut with an ellipsis
            const email = await page.locator('.account-identity').evaluate((el) => ({
              clipped: el.scrollWidth > el.clientWidth,
              ellipsis: getComputedStyle(el).textOverflow,
              wraps: getComputedStyle(el).whiteSpace,
              lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
            }));
            expect(email).toMatchObject({ clipped: false, wraps: 'normal' });
            expect(email.ellipsis).not.toBe('ellipsis');
            if (viewport.width === 1440) expect(email.lines).toBe(1);
            const shots = new URL('test-results/shots/account-overflow/', web);
            mkdirSync(shots, { recursive: true });
            await page.screenshot({
              path: fileURLToPath(new URL(`${state}-${viewport.width}x${viewport.height}-${theme}.png`, shots)),
              fullPage: true,
            });
          } finally { await context.close(); }
        });
      }
    });
  }
}
