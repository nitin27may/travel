import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, expect as pwExpect, type Browser, type Page } from '@playwright/test';
import { createViteServer } from 'vitest/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Conditions are waited for, not slept on; a cold dev server compiles each lazy chunk on first use, so under parallel load the first wait
// outlasts Playwright's 5 s default. 20 s is the ceiling, not a delay: a met condition returns at once.
const be = pwExpect.configure({ timeout: 20_000 });

// The sign-out question (edit-my-trip 4.6) in a real browser: the real SignOutButton and SignOutConfirm mounted in the account header
// with the flag on, the auth client answered by a fake /api/auth/*. Shots of the question at 320, 390 and 1440, light and dark, 2x go to
// ../shots-EM2 beside the worktree; not committed.
const web = new URL('../../', import.meta.url);
const OUT = fileURLToPath(new URL('../../shots-EM2/', web));
const styles = ['app/globals.css', 'app/themes.css', 'components/ui/ui.css', 'app/app.css', 'app/account.css']
  .map((f) => readFileSync(new URL(f, web), 'utf8').replace("@import 'tailwindcss';", ''))
  .join('\n');
const H = 'a1b2c3d4e5f60718';
const OUTBOX = JSON.stringify({ schema: 'plan-outbox/1', items: [{ draft: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', op: { kind: 'setDates', id: 'o-1', start: '2027-08-10' }, base: 1, at: '2026-10-27T10:00:00.000Z' }] });
const CACHE = JSON.stringify({ schema: 'mine-acct/1', savedAt: '2026-10-27T10:00:00.000Z', rows: [{ id: '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b', title: 'Canadian Rockies' }] });

let browser: Browser;
let server: Awaited<ReturnType<typeof createViteServer>>;
let url: string;

beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  server = await createViteServer({
    configFile: false,
    root: fileURLToPath(web),
    cacheDir: fileURLToPath(new URL('node_modules/.vite-signout/', web)),
    define: { 'process.env': '{"NEXT_PUBLIC_SIGN_IN":"1","NEXT_PUBLIC_ACCOUNT_TRIPS":"1","NODE_ENV":"development"}' },
    resolve: { alias: [{ find: '@/lib/auth/session-lost', replacement: '/leave-shim.js' }, { find: '@/lib/auth/client', replacement: '/client-shim.js' }, { find: /^@\//, replacement: fileURLToPath(web) }, { find: 'next/dynamic', replacement: '/dynamic-shim.js' }, { find: 'next/link', replacement: '/link-shim.js' }] },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{
      name: 'signout',
      resolveId: (id) => ['/client-shim.js', '/link-shim.js', '/dynamic-shim.js', '/auth-shim.js', '/leave-shim.js', '/mount.js'].includes(id) ? id : undefined,
      load(id) {
        if (id === '/link-shim.js') return `import {createElement} from 'react'; export default function Link(p){return createElement('a',p);}`;
        if (id === '/dynamic-shim.js') return `import {createElement, lazy, Suspense} from 'react'; export default function dynamic(l){ const L = lazy(async()=>({default: await l()})); return (p)=>createElement(Suspense,{fallback:null},createElement(L,p)); }`;
        if (id === '/client-shim.js') return `export const getAuthClient = () => ({ signOut: async()=>{ window.__signedOut = true; }, getSession: async()=>({ data: { user: { id: 'u1' } } }) });`;
        if (id === '/auth-shim.js') return `export const createAuthClient = () => ({ signOut: async()=>{ window.__signedOut = true; }, getSession: async()=>({ data: { user: { id: 'u1' } } }) });`;
        if (id === '/leave-shim.js') return `export const leaveSession = () => { window.__left = true; };`;
        if (id === '/mount.js') return `import {createElement} from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom'; import {SignOutButton} from '/app/account/SignOutButton.tsx'; flushSync(()=>createRoot(document.querySelector('.account-head')).render(createElement(SignOutButton))); document.documentElement.dataset.mounted='1';`;
      },
    }],
  });
  await server.listen();
  url = server.resolvedUrls!.local[0]!.replace(/\/$/, '');
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function open(size: { width: number; height: number }, theme: 'light' | 'dark', offline = false): Promise<Page> {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, hasTouch: size.width < 640 });
  await ctx.addInitScript(() => { (window as unknown as { process: unknown }).process = { env: { NEXT_PUBLIC_SIGN_IN: '1', NEXT_PUBLIC_ACCOUNT_TRIPS: '1', NODE_ENV: 'development' } }; });
  await ctx.addInitScript(([k1, v1, k2, v2]) => { localStorage.setItem(k1!, v1!); localStorage.setItem(k2!, v2!); }, [`travel.mine.outbox.${H}`, OUTBOX, `travel.mine.acct.${H}`, CACHE]);
  await ctx.route('**/page', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en" data-theme="${theme}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><main class="page"><header class="account-head"></header></main></body></html>` }));
  await ctx.route('**/api/account/plans**', (r) => (offline ? r.abort('failed') : r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"SERVICE_UNAVAILABLE"}' })));
  const page = await ctx.newPage();
  await page.goto(`${url}/page`);
  await page.addScriptTag({ type: 'module', url: `${url}/mount.js` });
  await be(page.locator('html')).toHaveAttribute('data-mounted', '1');
  return page;
}

describe('the sign-out question', () => {
  it('asks, focuses Cancel first, Try again stays open when it fails, Discard clears and leaves', async () => {
    const page = await open({ width: 390, height: 844 }, 'light');
    await page.getByRole('button', { name: 'Sign out' }).click();
    const dlg = page.getByRole('alertdialog');
    await be(dlg).toContainText('1 change to Canadian Rockies is not in your account yet.');
    await be(dlg.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dlg.getByRole('button', { name: 'Try again' }).click();
    await be(dlg).toContainText('It did not go through.');
    expect(await page.evaluate(() => (window as unknown as { __signedOut?: boolean }).__signedOut)).toBeFalsy();
    await dlg.getByRole('button', { name: 'Cancel' }).click();
    await be(dlg).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), `travel.mine.outbox.${H}`)).not.toBeNull();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('button', { name: 'Sign out and discard it' }).click();
    await be.poll(() => page.evaluate(() => (window as unknown as { __left?: boolean }).__left)).toBe(true);
    expect(await page.evaluate((k) => localStorage.getItem(k), `travel.mine.outbox.${H}`)).toBeNull();
    expect(await page.evaluate((k) => localStorage.getItem(k), `travel.mine.acct.${H}`)).toBeNull();
    await page.context().close();
  });

  it('Escape cancels; with nothing unsent it signs out at once', async () => {
    const page = await open({ width: 390, height: 844 }, 'light');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await be(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await be(page.getByRole('alertdialog')).toBeHidden();
    await page.evaluate((k) => localStorage.removeItem(k), `travel.mine.outbox.${H}`);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await be.poll(() => page.evaluate(() => (window as unknown as { __left?: boolean }).__left)).toBe(true);
    await page.context().close();
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const size of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      it(`shots ${theme} ${size.width}`, async () => {
        const page = await open(size, theme, size.width === 390);
        if (size.width === 390) await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => false }));
        await page.getByRole('button', { name: 'Sign out' }).click();
        await be(page.getByRole('alertdialog')).toBeVisible();
        if (size.width === 390) await be(page.getByRole('alertdialog')).toContainText('You are offline');
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/signout-${size.width}-${theme}.png` });
        await page.context().close();
      });
    }
  }
});
