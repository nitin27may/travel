// ACCT-P1 in a real browser: the name editor and My trips (review ACCT-PR MF1), the Profile and trips sections of /account/. The real
// components run under Vite in Chromium with the server actions stubbed at their boundary (page.exposeFunction) and the account trips
// hook (`useAccountTrips`, the same one Mine uses) and its flag stubbed with a snapshot, so no credentials, session or database are
// needed. The page's own markup and order are page.test.tsx and layout.browser.test.ts; the engine behind the hook is tests/mine/sync.test.ts.
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect as be, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createViteServer } from 'vitest/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const web = new URL('../../', import.meta.url);
const styles = ['app/globals.css', 'app/themes.css', 'components/ui/ui.css', 'app/app.css', 'app/account.css']
  .map((f) => readFileSync(new URL(f, web), 'utf8').replace("@import 'tailwindcss';", ''))
  .join('\n');
const shots = new URL('test-results/shots/ACCT-P1/', web);
mkdirSync(shots, { recursive: true });

/** One account trip as the hook hands it over (a `CopyItem`) and its row view (`changedAt` orders the list). */
const trip = (i: number, title = `Dolomites hut to hut ${i}`) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  slug: i % 2 ? 'dolomites-hut-to-hut' : 'canadian-rockies',
  title,
  days: 9,
  cc: 'IT',
  photo: null,
  start: '2027-07-03',
  adults: 2,
  children: [7, 9],
  profile: null,
  overrides: {},
  added: [],
  copiedAt: '2026-10-01T12:00:00.000Z',
});
const view = (i: number) => ({ state: 'quiet', spin: false, pending: 0, changedAt: new Date(Date.parse('2026-10-24T12:00:00Z') - i * 86_400_000).toISOString() });
const snapOf = (n: number, extra: Record<string, unknown> = {}) => {
  const ids = Array.from({ length: n }, (_, k) => k + 1);
  return { ready: true, reachable: true, expired: false, items: ids.map((i) => trip(i)), rows: Object.fromEntries(ids.map((i) => [trip(i).id, view(i)])), ...extra };
};

let browser: Browser;
let server: Awaited<ReturnType<typeof createViteServer>>;
let base: string;

beforeAll(async () => {
  server = await createViteServer({
    configFile: false,
    root: fileURLToPath(web),
    resolve: { alias: { '@': fileURLToPath(web) } },
    // Next inlines this name; Vite does not, and lib/mine/rows.ts (through the trips list) reads it (STEP2-T1F)
    define: { 'process.env.NEXT_PUBLIC_TRIP_EDIT': '"0"' },
    server: { host: '127.0.0.1', port: 0, cors: true },
    plugins: [
      {
        name: 'acct-p1-harness',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === '/harness.js' || id === '\0actions-stub' || id === '\0sync-stub' || id === '\0flag-stub') return id;
          if (id === './actions' && importer?.includes('/app/account/')) return '\0actions-stub';
          // the '@' alias runs first, so the hook and the flag arrive as paths
          if (/(^@|\/web\/?)\/lib\/mine\/useSync(\.ts)?$/.test(id)) return '\0sync-stub';
          if (/(^@|\/web\/?)\/lib\/mine\/flag(\.ts)?$/.test(id)) return '\0flag-stub';
          if (id === 'next/link') return '\0link';
          if (id === 'next/dynamic') return '\0dynamic';
          if (id === 'next/navigation') return '\0nav';
        },
        load(id) {
          if (id === '\0sync-stub') return `export function useAccountTrips(){ const s = window.__props.snap; return s ? { engine: {}, snap: s } : { engine: null, snap: null }; }`;
          if (id === '\0flag-stub') return `export const ACCOUNT_TRIPS_ON = !!window.__props.flag;`;
          if (id === '\0dynamic') return `import {createElement, lazy, Suspense} from 'react'; export default function dynamic(load){ const L = lazy(() => load().then((c) => ({ default: c }))); return (p) => createElement(Suspense, { fallback: null }, createElement(L, p)); }`;
          if (id === '\0link') return `import {createElement} from 'react'; export default function Link(p){return createElement('a',p);}`;
          if (id === '\0nav') return `export const usePathname = () => '/account/'; export const useRouter = () => ({ push(){}, replace(){}, refresh(){} });`;
          if (id === '\0actions-stub') return `export const saveName = (...a) => window.stub.saveName(...a);`;
          if (id === '/harness.js') {
            return `import {createElement as h} from 'react';
              import {createRoot} from 'react-dom/client';
              import {flushSync} from 'react-dom';
              import {ToastProvider} from '/components/ui/Toast.tsx';
              import {AccountSection} from '/app/account/AccountSections.tsx';
              import {ProfileSection} from '/app/account/ProfileSection.tsx';
              import {AccountTrips} from '/app/account/AccountTrips.tsx';
              const p = window.__props;
              flushSync(() => createRoot(document.getElementById('root')).render(
                h(ToastProvider, null,
                  h(AccountSection, {id: 'profile', title: 'Profile'}, h(ProfileSection, {userId: 'u1', initialName: p.name})),
                  h(AccountTrips, {userId: 'u1'}))));
              document.documentElement.dataset.ready = 'true';`;
          }
        },
      },
    ],
  });
  await server.listen();
  base = server.resolvedUrls!.local[0];
  browser = await chromium.launch({ args: ['--use-gl=angle', process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

interface Calls { saveName: unknown[][]; drafts: number; plans: number }
interface Setup { name?: string; flag?: boolean; snap?: unknown; width?: number; theme?: 'light' | 'dark'; saveName?: (name: string) => unknown }

async function open(s: Setup = {}): Promise<{ page: Page; context: BrowserContext; calls: Calls }> {
  const width = s.width ?? 1440;
  const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 900 }, deviceScaleFactor: 2, hasTouch: width < 640, reducedMotion: 'reduce' });
  const calls: Calls = { saveName: [], drafts: 0, plans: 0 };
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (/^\/fonts\/[\w.-]+\.woff2$/.test(url.pathname)) return route.fulfill({ body: readFileSync(new URL(`public${url.pathname}`, web)), contentType: 'font/woff2' });
    if (url.hostname === 'account.test' && url.pathname === '/account/') {
      const props = JSON.stringify({ name: s.name ?? '', flag: s.flag ?? true, snap: s.snap ?? null });
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html lang="en" data-theme="${s.theme ?? 'light'}"><head><title>Account</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><main id="main" class="page"><div class="account-page" id="root"></div></main><script>window.__props=${props}</script></body></html>`,
      });
    }
    // the page asks neither the title-only drafts nor the plans itself: the hook (stubbed here) is the only reader
    if (url.hostname === 'account.test' && url.pathname === '/api/account/drafts/') {
      calls.drafts++;
      return route.fulfill({ status: 404, body: '' });
    }
    if (url.hostname === 'account.test' && url.pathname.startsWith('/api/account/plans')) {
      calls.plans++;
      return route.fulfill({ status: 404, body: '' });
    }
    // a module still loading when the test closes its context is dropped, not reported
    try {
      return await route.fulfill({ response: await route.fetch({ url: new URL(`${url.pathname}${url.search}`, base).href }) });
    } catch {
      return undefined;
    }
  });
  const page = await context.newPage();
  await page.exposeFunction('stubSaveName', async (_u: string, raw: { name: string }) => {
    calls.saveName.push([raw.name]);
    return s.saveName ? s.saveName(raw.name) : { kind: 'saved', name: raw.name.normalize('NFC').replace(/\s+/g, ' ').trim() };
  });
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.stub = { saveName: (...a: unknown[]) => (w.stubSaveName as (...x: unknown[]) => unknown)(...a) };
  });
  await page.goto('http://account.test/account/');
  await page.addScriptTag({ type: 'module', url: 'http://account.test/harness.js' });
  await be(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
  return { page, context, calls };
}

const shot = (page: Page, name: string) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, shots)), fullPage: true });

describe('Profile: the name', () => {
  it('Edit opens the editor in place with focus in the field; Escape cancels and returns focus to Edit', async () => {
    const { page, context } = await open({ name: 'Nitin' });
    try {
      await be(page.getByText('Nitin', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Edit name' }).click();
      const field = page.getByLabel('Your name');
      await be(field).toBeFocused();
      await be(page.getByText('Shown only to you, here and in the menu.')).toBeVisible();
      await field.fill('Changed');
      await page.keyboard.press('Escape');
      await be(page.getByLabel('Your name')).toHaveCount(0);
      await be(page.getByRole('button', { name: 'Edit name' })).toBeFocused();
      await be(page.getByText('Nitin', { exact: true })).toBeVisible();
    } finally { await context.close(); }
  });

  it('saves the validated name, shows it from the action answer, toasts, and focuses Edit', async () => {
    const { page, context, calls } = await open({ name: '' });
    try {
      await be(page.getByText('Not set')).toBeVisible();
      await page.getByRole('button', { name: 'Add a name' }).click();
      await page.getByLabel('Your name').fill('  Nitin   Singh ');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await be(page.getByText('Nitin Singh', { exact: true })).toBeVisible();
      await be(page.getByText('Name saved.')).toBeVisible();
      expect(calls.saveName).toEqual([['Nitin Singh']]);
      await be(page.getByRole('button', { name: 'Edit name' })).toBeFocused();
      expect(await page.getByText('Not set').count()).toBe(0);
    } finally { await context.close(); }
  });

  it('an invalid name shows AP-21 and calls nothing; a rate-limited save shows the rate message; a failed save keeps the value', async () => {
    let mode: 'rate' | 'down' = 'rate';
    const { page, context, calls } = await open({
      name: 'Nitin',
      saveName: () => (mode === 'rate' ? { kind: 'rejected', reason: 'RATE_LIMITED' } : { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' }),
    });
    try {
      await page.getByRole('button', { name: 'Edit name' }).click();
      const field = page.getByLabel('Your name');
      await field.fill('<b>Nitin</b>');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await be(page.getByText('Use letters, numbers, spaces and simple punctuation.')).toBeVisible();
      await be(field).toHaveAttribute('aria-invalid', 'true');
      expect(calls.saveName).toEqual([]);
      await shot(page, 'name-error-1440-light');

      await field.fill('x'.repeat(61));
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await be(page.getByText('Keep it under 60 characters.')).toBeVisible();

      await field.fill('Nitin S');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await be(page.getByText('Too many changes. Try again in a few minutes.')).toBeVisible();

      mode = 'down';
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await be(page.getByText("We couldn't save. Your changes are still here; try again.")).toBeVisible();
      await be(field).toHaveValue('Nitin S');
    } finally { await context.close(); }
  });
});

describe('My trips (review ACCT-PR MF1)', () => {
  it('the account\'s trips, newest change first, five, each a link that opens the trip; no menu, no Rename or Delete; See all in Mine', async () => {
    const { page, context, calls } = await open({ snap: snapOf(7) });
    try {
      await be(page.getByRole('heading', { name: /My trips/ })).toContainText('7');
      const rows = page.locator('.acct-trips .crow');
      await be(rows).toHaveCount(5);
      await be(rows.first()).toContainText('Dolomites hut to hut 1');
      await be(rows.first()).toContainText('Changed 23 Oct');
      await be(rows.nth(4)).toContainText('Dolomites hut to hut 5');
      const link = rows.first().locator('a.crow-link');
      expect(await link.getAttribute('href')).toMatch(/^\/trips\/dolomites-hut-to-hut\/\?p=family-7&a=2&view=day&mine=1$/);
      await be(link).toHaveAccessibleName(/^Dolomites hut to hut 1 .*Changed 23 Oct/); // PR-023: the name starts with what is on screen
      await be(page.getByRole('button', { name: /Actions for/ })).toHaveCount(0);
      for (const t of ['Rename', 'Delete', 'Remove', 'Saved']) await be(page.getByText(t, { exact: false })).toHaveCount(0);
      const all = page.getByRole('link', { name: 'See all in Mine' });
      await be(all).toBeVisible();
      expect(await all.getAttribute('href')).toBe('/mine/?show=trips');
      expect(calls.drafts).toBe(0);
    } finally { await context.close(); }
  });

  it('none in the account: the empty state says where copies go', async () => {
    const { page, context } = await open({ snap: snapOf(0) });
    try {
      await be(page.getByText('No trips in your account yet.')).toBeVisible();
      await be(page.getByText('Copy a trip while signed in and it is kept here and in Mine.')).toBeVisible();
      await be(page.getByRole('link', { name: 'Browse trips' })).toBeVisible();
      await be(page.getByRole('link', { name: 'See all in Mine' })).toHaveCount(0);
      const body = await page.locator('body').innerText();
      for (const t of ['Draft title', 'Create draft', 'Reconnecting', 'Live', 'saved']) expect(body).not.toContain(t);
    } finally { await context.close(); }
  });

  it('the account out of reach with nothing cached says so; still loading shows a row skeleton', async () => {
    const down = await open({ snap: snapOf(0, { reachable: false }) });
    try {
      await be(down.page.getByText("We can't reach your account right now. Your trips show here when we can.")).toBeVisible();
    } finally { await down.context.close(); }
    const busy = await open({ snap: snapOf(0, { reachable: null }) });
    try {
      await be(busy.page.getByRole('list', { name: 'Loading your trips' })).toBeVisible();
    } finally { await busy.context.close(); }
  });

  it('the accountTrips flag off: nothing is kept in the account yet, and Mine has the copies', async () => {
    const { page, context } = await open({ flag: false });
    try {
      await be(page.getByText('Trips you copy stay on this device for now. See them in Mine.')).toBeVisible();
      expect(await page.getByRole('link', { name: 'Open Mine' }).getAttribute('href')).toBe('/mine/?show=trips');
    } finally { await context.close(); }
  });
});

for (const width of [320, 390, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`states ${width} ${theme}`, () => {
      it('settled, editor open, and many trips: axe clean, 44 px targets on a phone, shots', async () => {
        const { page, context } = await open({ name: 'Nitin', snap: snapOf(7), width, theme });
        try {
          const axe = async (label: string) => {
            const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
            expect(res.violations.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
          };
          await shot(page, `settled-${width}-${theme}`);
          await axe('settled');
          await page.getByRole('button', { name: 'Edit name' }).click();
          await be(page.getByLabel('Your name')).toBeFocused();
          await page.getByLabel('Your name').fill('Nitin Singh');
          await shot(page, `name-editor-${width}-${theme}`);
          await axe('editor');
          if (width < 640) {
            const small = await page.evaluate(() =>
              [...document.querySelectorAll<HTMLElement>('button, a[href], input')].filter((el) => {
                const r = el.getBoundingClientRect();
                if (!r.width) return false;
                const a = getComputedStyle(el, '::after');
                const h = Math.max(r.height, parseFloat(a.height) || 0);
                const w = Math.max(r.width, parseFloat(a.width) || 0);
                return h < 43.5 || w < 43.5;
              }).map((el) => `${el.tagName} ${el.textContent?.trim().slice(0, 20)} ${el.getAttribute('aria-label') ?? ''}`),
            );
            expect(small).toEqual([]);
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
        } finally { await context.close(); }
      });
    });
  }
}
