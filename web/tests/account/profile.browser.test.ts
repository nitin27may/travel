// ACCT-P1 in a real browser: the name editor and Saved trips, the two interactive sections of /account/. The real components run under
// Vite in Chromium with the server actions stubbed at their boundary (page.exposeFunction) and `/api/account/drafts/` answered by a route,
// so no credentials, session or database are needed. The page's own markup and order are page.test.tsx and layout.browser.test.ts.
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

interface Row { id: string; title: string; created_at: string; updated_at: string }
const row = (i: number, title = `Patagonia, El Chaltén lodging ${i}`): Row => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  title,
  created_at: '2026-10-24T12:00:00.000Z',
  updated_at: new Date(Date.parse('2026-10-24T12:00:00Z') - i * 3_600_000).toISOString(),
});

let browser: Browser;
let server: Awaited<ReturnType<typeof createViteServer>>;
let base: string;

beforeAll(async () => {
  server = await createViteServer({
    configFile: false,
    root: fileURLToPath(web),
    resolve: { alias: { '@': fileURLToPath(web) } },
    server: { host: '127.0.0.1', port: 0, cors: true },
    plugins: [
      {
        name: 'acct-p1-harness',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === '/harness.js' || id === '\0actions-stub') return id;
          if (id === './actions' && importer?.includes('/app/account/')) return '\0actions-stub';
          if (id === 'next/link') return '\0link';
          if (id === 'next/navigation') return '\0nav';
        },
        load(id) {
          if (id === '\0link') return `import {createElement} from 'react'; export default function Link(p){return createElement('a',p);}`;
          if (id === '\0nav') return `export const usePathname = () => '/account/'; export const useRouter = () => ({ push(){}, replace(){}, refresh(){} });`;
          if (id === '\0actions-stub') {
            return `export const saveName = (...a) => window.stub.saveName(...a);
              export const createDraft = (...a) => window.stub.createDraft(...a);
              export const renameDraft = (...a) => window.stub.renameDraft(...a);
              export const deleteDraft = (...a) => window.stub.deleteDraft(...a);`;
          }
          if (id === '/harness.js') {
            return `import {createElement as h} from 'react';
              import {createRoot} from 'react-dom/client';
              import {flushSync} from 'react-dom';
              import {ToastProvider} from '/components/ui/Toast.tsx';
              import {AccountSection} from '/app/account/AccountSections.tsx';
              import {ProfileSection} from '/app/account/ProfileSection.tsx';
              import {SavedTrips} from '/app/account/SavedTrips.tsx';
              const p = window.__props;
              flushSync(() => createRoot(document.getElementById('root')).render(
                h(ToastProvider, null,
                  h(AccountSection, {id: 'profile', title: 'Profile'}, h(ProfileSection, {userId: 'u1', initialName: p.name})),
                  h(SavedTrips, {userId: 'u1', initialRows: p.rows.map((r) => ({...r, created_at: new Date(r.created_at), updated_at: new Date(r.updated_at)}))}))));
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

interface Calls { saveName: unknown[][]; rename: unknown[][]; del: unknown[][]; create: unknown[][]; drafts: number }
interface Setup { name?: string; rows?: Row[]; width?: number; theme?: 'light' | 'dark'; server?: { rows: Row[] }; saveName?: (name: string) => unknown }

async function open(s: Setup = {}): Promise<{ page: Page; context: BrowserContext; calls: Calls; srv: { rows: Row[] } }> {
  const width = s.width ?? 1440;
  const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 900 }, deviceScaleFactor: 2, hasTouch: width < 640 });
  const calls: Calls = { saveName: [], rename: [], del: [], create: [], drafts: 0 };
  const srv = s.server ?? { rows: s.rows ?? [] };
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (/^\/fonts\/[\w.-]+\.woff2$/.test(url.pathname)) return route.fulfill({ body: readFileSync(new URL(`public${url.pathname}`, web)), contentType: 'font/woff2' });
    if (url.hostname === 'account.test' && url.pathname === '/account/') {
      const props = JSON.stringify({ name: s.name ?? '', rows: s.rows ?? [] });
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html lang="en" data-theme="${s.theme ?? 'light'}"><head><title>Account</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><main id="main" class="page"><div class="account-page" id="root"></div></main><script>window.__props=${props}</script></body></html>`,
      });
    }
    if (url.hostname === 'account.test' && url.pathname === '/api/account/drafts/') {
      calls.drafts++;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ rows: srv.rows }) });
    }
    return route.fulfill({ response: await route.fetch({ url: new URL(`${url.pathname}${url.search}`, base).href }) });
  });
  const page = await context.newPage();
  await page.exposeFunction('stubSaveName', async (_u: string, raw: { name: string }) => {
    calls.saveName.push([raw.name]);
    return s.saveName ? s.saveName(raw.name) : { kind: 'saved', name: raw.name.normalize('NFC').replace(/\s+/g, ' ').trim() };
  });
  await page.exposeFunction('stubRename', async (_u: string, raw: { id: string; title: string }) => {
    calls.rename.push([raw.id, raw.title]);
    srv.rows = srv.rows.map((r) => (r.id === raw.id ? { ...r, title: raw.title, updated_at: new Date().toISOString() } : r));
    return { kind: 'committed', txid: '1' };
  });
  await page.exposeFunction('stubDelete', async (_u: string, raw: { id: string }) => {
    calls.del.push([raw.id]);
    srv.rows = srv.rows.filter((r) => r.id !== raw.id);
    return { kind: 'committed', txid: '2' };
  });
  await page.exposeFunction('stubCreate', async (_u: string, raw: { id: string; title: string }) => {
    calls.create.push([raw.id, raw.title]);
    const old = (s.rows ?? []).find((r) => r.id === raw.id);
    if (old) srv.rows = [...srv.rows, old];
    return { kind: 'committed', txid: '3' };
  });
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.stub = {
      saveName: (...a: unknown[]) => (w.stubSaveName as (...x: unknown[]) => unknown)(...a),
      renameDraft: undefined,
      renameDraftImpl: undefined,
      createDraft: (...a: unknown[]) => (w.stubCreate as (...x: unknown[]) => unknown)(...a),
    };
    (w.stub as Record<string, unknown>).renameDraft = (...a: unknown[]) => (w.stubRename as (...x: unknown[]) => unknown)(...a);
    (w.stub as Record<string, unknown>).deleteDraft = (...a: unknown[]) => (w.stubDelete as (...x: unknown[]) => unknown)(...a);
  });
  await page.goto('http://account.test/account/');
  await page.addScriptTag({ type: 'module', url: 'http://account.test/harness.js' });
  await be(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
  return { page, context, calls, srv };
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

describe('Saved trips', () => {
  it('no create box and no live status; the empty state has the spec copy', async () => {
    const { page, context } = await open({ rows: [] });
    try {
      await be(page.getByText('No saved trips yet.')).toBeVisible();
      await be(page.getByText('Trips you copy or build while signed in are saved here.')).toBeVisible();
      await be(page.getByRole('link', { name: 'Browse trips' })).toBeVisible();
      const body = (await page.locator('body').innerText());
      for (const t of ['Draft title', 'Create draft', 'Reconnecting', 'Live']) expect(body).not.toContain(t);
    } finally { await context.close(); }
  });

  it('shows 5, then "{n} more" expands in place', async () => {
    const rows = [1, 2, 3, 4, 5, 6, 7].map((i) => row(i));
    const { page, context } = await open({ rows });
    try {
      await be(page.locator('.draft-row')).toHaveCount(5);
      await be(page.getByRole('heading', { name: /Saved trips/ })).toContainText('7');
      await page.getByRole('button', { name: '2 more' }).click();
      await be(page.locator('.draft-row')).toHaveCount(7);
      await be(page.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
    } finally { await context.close(); }
  });

  it('Rename, Delete and Undo go through the actions, re-read the list, and survive (the server is the truth)', async () => {
    const rows = [row(1, 'Old test draft'), row(2, 'Nitin')];
    const { page, context, calls, srv } = await open({ rows });
    try {
      const before = calls.drafts;
      await page.locator('.draft-row', { hasText: 'Nitin' }).getByRole('button', { name: 'Draft actions' }).click();
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      await page.getByLabel('Rename draft').fill('Rockies');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await be(page.locator('.draft-row', { hasText: 'Rockies' })).toBeVisible();
      expect(calls.rename).toEqual([[rows[1].id, 'Rockies']]);
      await be.poll(() => calls.drafts).toBeGreaterThan(before);

      await page.locator('.draft-row', { hasText: 'Old test draft' }).getByRole('button', { name: 'Draft actions' }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await be(page.locator('.draft-row', { hasText: 'Old test draft' })).toHaveCount(0);
      expect(srv.rows.map((r) => r.title)).toEqual(['Rockies']);
      await page.getByRole('button', { name: 'Undo' }).click();
      await be(page.locator('.draft-row', { hasText: 'Old test draft' })).toBeVisible();
      expect(calls.create).toEqual([[rows[0].id, 'Old test draft']]);
    } finally { await context.close(); }
  });

  it('a change made elsewhere shows when the window gets focus (a second tab)', async () => {
    const rows = [row(1, 'Old test draft')];
    const { page, context, srv } = await open({ rows });
    try {
      await be(page.locator('.draft-row')).toHaveCount(1);
      srv.rows = [row(1, 'Renamed on the phone'), row(2, 'Added on the phone')];
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await be(page.locator('.draft-row')).toHaveCount(2);
      await be(page.getByText('Renamed on the phone')).toBeVisible();
    } finally { await context.close(); }
  });
});

for (const width of [320, 390, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`states ${width} ${theme}`, () => {
      it('settled, editor open, and many rows: axe clean, 44 px targets on a phone, shots', async () => {
        const rows = [1, 2, 3, 4, 5, 6, 7].map((i) => row(i, i === 1 ? 'Nitin' : undefined));
        const { page, context } = await open({ name: 'Nitin', rows, width, theme });
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
