/* eslint-disable @typescript-eslint/no-explicit-any -- the stubbed action boundary carries untyped payloads */
// ACCT-P2 in a real browser: the Travellers editor, the settled section with its notices, and the first-run setup card. The real
// components run under Vite in Chromium with the server actions stubbed at their boundary, so no credentials, session or database are
// needed. The clock is fixed at 27 Oct 2026 (the spec's acceptance date). Screenshots go to test-results/shots/ACCT-P2/.
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
const shots = new URL('test-results/shots/ACCT-P2/', web);
mkdirSync(shots, { recursive: true });

const TODAY = '2026-10-27';
const PARTY_KEY = 'travel.party';

type Doc = { schema: 'travellers/1'; adults: number; children: { age: number; age_as_of: string; dob?: string }[]; adult_ages?: { age: number; age_as_of: string; dob?: string }[] };
const family = (extra: Partial<Doc> = {}): Doc => ({ schema: 'travellers/1', adults: 2, children: [{ age: 7, age_as_of: TODAY }, { age: 9, age_as_of: TODAY }], ...extra });

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
        name: 'acct-p2-harness',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === '/harness.js' || id === '\0actions-stub') return id;
          if (id === './actions' && importer?.includes('/app/account/')) return '\0actions-stub';
          if (id === 'next/link') return '\0link';
          if (id === 'next/navigation') return '\0nav';
        },
        load(id) {
          if (id === '\0link') return `import {createElement} from 'react'; export default function Link(p){return createElement('a',p);}`;
          if (id === '\0nav') return `export const usePathname = () => '/account/'; export const useRouter = () => ({ push(){}, replace(){}, refresh(){ window.__refreshed = (window.__refreshed || 0) + 1; } });`;
          if (id === '\0actions-stub') {
            return ['saveName', 'saveTravellers', 'removeTravellers', 'finishSetup'].map((n) => `export const ${n} = (...a) => window.stubCall('${n}', a);`).join('\n');
          }
          if (id === '/harness.js') {
            return `import {createElement as h} from 'react';
              import {createRoot} from 'react-dom/client';
              import {flushSync} from 'react-dom';
              import {ToastProvider} from '/components/ui/Toast.tsx';
              import {AccountSection} from '/app/account/AccountSections.tsx';
              import {TravellersSection} from '/app/account/TravellersSection.tsx';
              import {SetupCard} from '/app/account/SetupCard.tsx';
              const p = window.__props;
              const body = p.mode === 'setup'
                ? h(SetupCard, {userId: 'u1', initialName: p.name, revision: p.revision, initialStep: p.step})
                : h(AccountSection, {id: 'travellers', title: 'Travellers'}, h(TravellersSection, {userId: 'u1', travellers: p.travellers, invalid: !!p.invalid, revision: p.revision, today: p.today}));
              flushSync(() => createRoot(document.getElementById('root')).render(h(ToastProvider, null, body)));
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

type Reply = unknown;
interface Setup {
  mode?: 'section' | 'setup';
  travellers?: Doc | null;
  invalid?: boolean;
  revision?: number;
  name?: string;
  step?: 'name' | 'travellers';
  device?: { v: 1; adults: number; children: (number | null)[]; src?: 'account' } | null;
  width?: number;
  theme?: 'light' | 'dark';
  /** answers by action name; default: saved at revision + 1 */
  reply?: Partial<Record<'saveName' | 'saveTravellers' | 'removeTravellers' | 'finishSetup', (arg: any) => Reply>>;
}
interface Calls { saveName: any[]; saveTravellers: any[]; removeTravellers: any[]; finishSetup: any[] }

async function open(s: Setup = {}): Promise<{ page: Page; context: BrowserContext; calls: Calls }> {
  const width = s.width ?? 1440;
  const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 900 }, deviceScaleFactor: 2, hasTouch: width < 640 });
  const calls: Calls = { saveName: [], saveTravellers: [], removeTravellers: [], finishSetup: [] };
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (/^\/fonts\/[\w.-]+\.woff2$/.test(url.pathname)) return route.fulfill({ body: readFileSync(new URL(`public${url.pathname}`, web)), contentType: 'font/woff2' });
    if (url.hostname === 'account.test' && url.pathname === '/account/') {
      const props = JSON.stringify({ mode: s.mode ?? 'section', travellers: s.travellers ?? null, invalid: s.invalid, revision: s.revision ?? 0, name: s.name ?? '', step: s.step ?? 'name', today: TODAY });
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html lang="en" data-theme="${s.theme ?? 'light'}"><head><title>Account</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style></head><body><main id="main" class="page"><div class="account-page" id="root"></div></main><script>window.__props=${props}</script></body></html>`,
      });
    }
    return route.fulfill({ response: await route.fetch({ url: new URL(`${url.pathname}${url.search}`, base).href }) });
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date('2026-10-27T12:00:00'));
  await page.exposeFunction('stubCall', async (name: keyof Calls, args: any[]) => {
    const arg = args[1];
    calls[name].push(arg);
    const custom = s.reply?.[name];
    if (custom) return custom(arg);
    if (name === 'saveName') return { kind: 'saved', name: String(arg.name).trim() };
    if (name === 'finishSetup') return { kind: 'done' };
    return { kind: 'saved', revision: (arg.revision ?? 0) + 1 };
  });
  if (s.device !== undefined && s.device !== null) {
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [PARTY_KEY, JSON.stringify(s.device)]);
  }
  await page.goto('http://account.test/account/');
  await page.addScriptTag({ type: 'module', url: 'http://account.test/harness.js' });
  await be(page.locator('html')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(() => document.fonts.ready);
  return { page, context, calls };
}

const shot = (page: Page, name: string) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, shots)), fullPage: true });
const party = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), PARTY_KEY);
const save = (page: Page) => page.getByRole('button', { name: 'Save travellers' });

describe('Travellers editor: 2 adults, 2 children and each child\'s age', () => {
  it('Add travellers saves exactly {schema, adults, children: [{age, age_as_of}]}, seeds the device party with src account, and shows the line', async () => {
    const { page, context, calls } = await open({ travellers: null });
    try {
      await be(page.getByText('No travellers saved.')).toBeVisible();
      await page.getByRole('button', { name: 'Add travellers' }).click();
      await be(page.getByRole('group', { name: 'Who usually travels with you?' })).toBeVisible();
      await page.getByRole('button', { name: 'More children' }).click();
      await be(page.getByLabel('Age').first()).toBeFocused();
      await page.getByLabel('Age').first().selectOption('7');
      await page.getByRole('button', { name: 'More children' }).click();
      await be(page.getByLabel('Age').nth(1)).toBeFocused();
      await page.getByLabel('Age').nth(1).selectOption('9');
      await be(page.getByText('We save the number of adults and each child')).toBeVisible();
      await save(page).click();
      await be(page.getByText('2 adults · 2 children (7, 9)')).toBeVisible();
      expect(calls.saveTravellers).toEqual([{ doc: family(), revision: 0 }]);
      expect(await party(page)).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
      await be(page.getByRole('button', { name: 'Edit travellers' })).toBeFocused();
    } finally { await context.close(); }
  });

  it('no red before Save; a missing age then shows "Choose an age." and focus goes to it; nothing is sent', async () => {
    const { page, context, calls } = await open({ travellers: null });
    try {
      await page.getByRole('button', { name: 'Add travellers' }).click();
      await page.getByRole('button', { name: 'More children' }).click();
      await be(page.getByText('Choose an age.')).toHaveCount(0);
      await save(page).click();
      await be(page.getByText('Choose an age.')).toBeVisible();
      await be(page.getByLabel('Age')).toBeFocused();
      await be(page.getByLabel('Age')).toHaveAttribute('aria-invalid', 'true');
      expect(calls.saveTravellers).toEqual([]);
      await shot(page, 'editor-error-1440-light');
    } finally { await context.close(); }
  });

  it('a date of birth derives the age (read-only), is saved with it, and Remove date of birth returns focus to Age', async () => {
    const { page, context, calls } = await open({ travellers: null });
    try {
      await page.getByRole('button', { name: 'Add travellers' }).click();
      await page.getByRole('button', { name: 'More children' }).click();
      await page.getByRole('button', { name: 'Add date of birth' }).click();
      await be(page.getByLabel('Date of birth (optional)')).toBeFocused();
      await be(page.getByLabel('Date of birth (optional)')).toHaveAttribute('max', TODAY);
      await page.getByLabel('Date of birth (optional)').fill('2019-03-15');
      await be(page.getByText('7, from the date of birth')).toBeVisible();
      await save(page).click();
      await be(page.getByText('2 adults · 1 child (7)')).toBeVisible();
      expect(calls.saveTravellers[0].doc.children).toEqual([{ age: 7, age_as_of: TODAY, dob: '2019-03-15' }]);
      // and the other way: Remove date of birth
      await page.getByRole('button', { name: 'Edit travellers' }).click();
      await page.getByRole('button', { name: 'Remove date of birth' }).click();
      await be(page.getByLabel('Age')).toBeFocused();
      await be(page.getByLabel('Age')).toHaveValue('7');
    } finally { await context.close(); }
  });

  it('a future date and a date that makes a child 18 are refused with the spec copy, after Save', async () => {
    const { page, context, calls } = await open({ travellers: null });
    try {
      await page.getByRole('button', { name: 'Add travellers' }).click();
      await page.getByRole('button', { name: 'More children' }).click();
      await page.getByRole('button', { name: 'Add date of birth' }).click();
      await page.getByLabel('Date of birth (optional)').fill('2027-01-01');
      await save(page).click();
      await be(page.getByText("The date of birth can't be in the future.")).toBeVisible();
      await page.getByLabel('Date of birth (optional)').fill('2000-01-01');
      await be(page.getByText('A child is 17 or younger. Count older travellers as adults.')).toBeVisible();
      expect(calls.saveTravellers).toEqual([]);
    } finally { await context.close(); }
  });

  it('optional adults\' ages: only given ones are saved; an adult under 18 is refused', async () => {
    const { page, context, calls } = await open({ travellers: null });
    try {
      await page.getByRole('button', { name: 'Add travellers' }).click();
      await page.getByRole('button', { name: "Add adults' ages (optional)" }).click();
      await page.getByLabel('Age (optional)').first().fill('12');
      await save(page).click();
      await be(page.getByText('An adult is 18 or older.')).toBeVisible();
      await page.getByLabel('Age (optional)').first().fill('41');
      await save(page).click();
      await be(page.getByText('2 adults')).toBeVisible();
      expect(calls.saveTravellers[0].doc).toEqual({ schema: 'travellers/1', adults: 2, adult_ages: [{ age: 41, age_as_of: TODAY }], children: [] });
    } finally { await context.close(); }
  });

  it('a revision conflict keeps the form and offers "Show the latest"; a service failure keeps the values', async () => {
    let mode: 'conflict' | 'down' = 'conflict';
    const { page, context } = await open({
      travellers: family(),
      revision: 3,
      reply: { saveTravellers: () => (mode === 'conflict' ? { kind: 'conflict' } : { kind: 'rejected', reason: 'SERVICE_UNAVAILABLE' }) },
    });
    try {
      await page.getByRole('button', { name: 'Edit travellers' }).click();
      await page.getByLabel('Age').first().selectOption('8');
      await save(page).click();
      await be(page.getByText('Your travellers were changed on another device.')).toBeVisible();
      await be(page.getByLabel('Age').first()).toHaveValue('8');
      await shot(page, 'conflict-1440-light');
      await page.getByRole('button', { name: 'Show the latest' }).click();
      expect(await page.evaluate(() => (window as any).__refreshed)).toBe(1);
      mode = 'down';
      await save(page).click();
      await be(page.getByText("We couldn't save. Your changes are still here; try again.")).toBeVisible();
      await be(page.getByLabel('Age').first()).toHaveValue('8');
    } finally { await context.close(); }
  });

  it('Escape cancels the editor and returns focus to Edit', async () => {
    const { page, context } = await open({ travellers: family() });
    try {
      await page.getByRole('button', { name: 'Edit travellers' }).click();
      await page.keyboard.press('Escape');
      await be(page.getByRole('group', { name: 'Who usually travels with you?' })).toHaveCount(0);
      await be(page.getByRole('button', { name: 'Edit travellers' })).toBeFocused();
    } finally { await context.close(); }
  });
});

describe('Travellers section: the device seed and the notices', () => {
  it('with no party on the device the account seeds it silently, src account; the same party is marked', async () => {
    const { page, context } = await open({ travellers: family() });
    try {
      await be(page.getByText('2 adults · 2 children (7, 9)')).toBeVisible();
      await be.poll(() => party(page)).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
      await be(page.getByText('This browser plans for')).toHaveCount(0);
    } finally { await context.close(); }
    const same = await open({ travellers: family(), device: { v: 1, adults: 2, children: [7, 9] } });
    try {
      await be.poll(() => party(same.page)).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
    } finally { await same.context.close(); }
  });

  it('a different party this browser chose is left alone and the "differs" notice offers both ways; nothing is written until pressed', async () => {
    const { page, context, calls } = await open({ travellers: family(), device: { v: 1, adults: 1, children: [4] } });
    try {
      await be(page.getByText('This browser plans for 1 adult and 1 child (4). Your saved travellers: 2 adults and 2 children (7, 9).')).toBeVisible();
      expect(await party(page)).toEqual({ v: 1, adults: 1, children: [4] });
      await shot(page, 'notice-differs-1440-light');
      await page.getByRole('button', { name: "Save this browser's party" }).click();
      await be(page.getByLabel('Age').first()).toHaveValue('4');
      expect(calls.saveTravellers).toEqual([]);
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'Use saved travellers here' }).click();
      await be(page.getByText('This browser plans for')).toHaveCount(0);
      expect(await party(page)).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
    } finally { await context.close(); }
  });

  it('a party an earlier seed wrote is brought up to date (a change on another device)', async () => {
    const { page, context } = await open({ travellers: family(), device: { v: 1, adults: 1, children: [], src: 'account' } });
    try {
      await be.poll(() => party(page)).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
      await be(page.getByText('This browser plans for')).toHaveCount(0);
    } finally { await context.close(); }
  });

  it('"Are these ages still right?" shows after a year; Looks right re-saves today\'s ages; the rolled ages are shown', async () => {
    const old = family({ children: [{ age: 6, age_as_of: '2025-09-01' }, { age: 8, age_as_of: '2025-09-01' }] });
    const { page, context, calls } = await open({ travellers: old, revision: 2 });
    try {
      await be(page.getByText('2 adults · 2 children (7, 9)')).toBeVisible();
      await be(page.getByText('Are these ages still right? 7, 9.')).toBeVisible();
      await shot(page, 'notice-ages-1440-light');
      await page.getByRole('button', { name: 'Looks right' }).click();
      await be(page.getByText('Are these ages still right?')).toHaveCount(0);
      expect(calls.saveTravellers).toEqual([{ doc: family(), revision: 2 }]);
    } finally { await context.close(); }
  });

  it('a child who is now 18 offers Move to adults (adults + 1, child removed) and Keep as a child', async () => {
    const grown = family({ children: [{ age: 17, age_as_of: '2025-01-10' }, { age: 9, age_as_of: TODAY }] });
    const { page, context, calls } = await open({ travellers: grown, revision: 1 });
    try {
      await be(page.getByText('Child 1 is now 18. Count them as an adult?')).toBeVisible();
      await shot(page, 'notice-grown-1440-light');
      await page.getByRole('button', { name: 'Keep as a child' }).click();
      await be(page.getByText('Child 1 is now 18.')).toHaveCount(0);
    } finally { await context.close(); }
    const again = await open({ travellers: grown, revision: 1 });
    try {
      await again.page.getByRole('button', { name: 'Move to adults' }).click();
      await be(again.page.getByText('3 adults · 1 child (9)')).toBeVisible();
      expect(again.calls.saveTravellers).toEqual([{ doc: { schema: 'travellers/1', adults: 3, children: [{ age: 9, age_as_of: TODAY }] }, revision: 1 }]);
    } finally { await again.context.close(); }
    void calls;
  });

  it('Remove asks first, keeps the browser\'s party as its own, toasts, and Undo saves the same document back', async () => {
    const { page, context, calls } = await open({ travellers: family(), revision: 4 });
    try {
      await be.poll(() => party(page)).toEqual({ v: 1, adults: 2, children: [7, 9], src: 'account' });
      await page.getByRole('button', { name: 'More' }).click();
      await page.getByRole('menuitem', { name: 'Remove saved travellers' }).click();
      await be(page.getByText('Remove your saved travellers? This browser keeps its party until you change it.')).toBeVisible();
      await shot(page, 'remove-confirm-1440-light');
      await page.getByRole('button', { name: 'Remove', exact: true }).click();
      await be(page.getByText('Travellers removed.')).toBeVisible();
      await be(page.getByText('No travellers saved.')).toBeVisible();
      expect(calls.removeTravellers).toEqual([{ revision: 4 }]);
      expect(await party(page)).toEqual({ v: 1, adults: 2, children: [7, 9] });
      await page.getByRole('button', { name: 'Undo' }).click();
      await be(page.getByText('2 adults · 2 children (7, 9)')).toBeVisible();
      expect(calls.saveTravellers).toEqual([{ doc: family(), revision: 5 }]);
    } finally { await context.close(); }
  });

  it('an unreadable stored document offers to add travellers again', async () => {
    const { page, context } = await open({ travellers: null, invalid: true });
    try {
      await be(page.getByText('Your saved travellers could not be read. Add them again.')).toBeVisible();
    } finally { await context.close(); }
  });
});

describe('Setup card', () => {
  it('step 1 prefills the name; Continue saves a changed name and moves to step 2 (URL, focus on the heading, announcement)', async () => {
    const { page, context, calls } = await open({ mode: 'setup', name: 'Nitin' });
    try {
      await be(page.getByText('Step 1 of 2')).toBeVisible();
      await be(page.getByText('Two short steps. You can change both later.')).toBeVisible();
      await be(page.getByLabel('Your name')).toHaveValue('Nitin');
      await shot(page, 'setup-step1-1440-light');
      await page.getByLabel('Your name').fill('Nitin Singh');
      await page.getByRole('button', { name: 'Continue' }).click();
      await be(page.getByRole('heading', { name: 'Who usually travels with you?' })).toBeFocused();
      expect(calls.saveName).toEqual([{ name: 'Nitin Singh' }]);
      expect(page.url()).toContain('setup=travellers');
      await be(page.getByRole('status').filter({ hasText: 'Step 2 of 2: Who usually travels with you?' })).toHaveCount(1);
    } finally { await context.close(); }
  });

  it('Continue with the prefilled name saves nothing; Skip moves on; Continue is off for an invalid name', async () => {
    const { page, context, calls } = await open({ mode: 'setup', name: 'Nitin' });
    try {
      await page.getByLabel('Your name').fill('<b>');
      await be(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
      await be(page.getByText('Use letters, numbers, spaces and simple punctuation.')).toBeVisible();
      await page.getByLabel('Your name').fill('Nitin');
      await page.getByRole('button', { name: 'Continue' }).click();
      await be(page.getByText('Step 2 of 2')).toBeVisible();
      expect(calls.saveName).toEqual([]);
      await page.getByRole('button', { name: 'Back' }).click();
      await be(page.getByLabel('Your name')).toHaveValue('Nitin');
      await page.getByRole('button', { name: 'Skip', exact: true }).click();
      await be(page.getByText('Step 2 of 2')).toBeVisible();
    } finally { await context.close(); }
  });

  it('step 2 prefills from this browser (with the line), saves with finishSetup, writes the device party and ends in "All set"', async () => {
    const { page, context, calls } = await open({ mode: 'setup', step: 'travellers', device: { v: 1, adults: 2, children: [6, null] } });
    try {
      await be(page.getByText('Filled in from this browser: 2 adults, 2 children (6, age not set). Check the ages and save.')).toBeVisible();
      await be(page.getByLabel('Age').first()).toHaveValue('6');
      await save(page).click();
      await be(page.getByText('Choose an age.')).toBeVisible();
      await be(page.getByLabel('Age').nth(1)).toBeFocused();
      await shot(page, 'setup-step2-error-1440-light');
      await page.getByLabel('Age').nth(1).selectOption('9');
      await save(page).click();
      await be(page.getByRole('heading', { name: 'All set' })).toBeFocused();
      await be(page.getByText('Trips now plan for 2 adults and 2 children (6, 9) wherever you sign in.')).toBeVisible();
      expect(calls.saveTravellers).toEqual([{ doc: family({ children: [{ age: 6, age_as_of: TODAY }, { age: 9, age_as_of: TODAY }] }), revision: 0, finishSetup: true }]);
      expect(await party(page)).toEqual({ v: 1, adults: 2, children: [6, 9], src: 'account' });
      await shot(page, 'setup-done-1440-light');
      await be(page.getByRole('link', { name: 'Browse trips' })).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
      expect(await page.evaluate(() => (window as any).__refreshed)).toBe(1);
      expect(page.url()).not.toContain('setup=');
    } finally { await context.close(); }
  });

  it('Skip for now ends the setup without travellers and says so', async () => {
    const { page, context, calls } = await open({ mode: 'setup', step: 'travellers' });
    try {
      await be(page.getByText('Filled in from this browser')).toHaveCount(0);
      await page.getByRole('button', { name: 'Skip for now' }).click();
      await be(page.getByText('You can add travellers here at any time.')).toBeVisible();
      expect(calls.finishSetup.length).toBe(1);
      expect(calls.saveTravellers).toEqual([]);
      expect(await party(page)).toBeNull();
    } finally { await context.close(); }
  });
});

for (const width of [320, 390, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    describe(`states ${width} ${theme}`, () => {
      const axe = async (page: Page, label: string) => {
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(res.violations.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      };
      const small = (page: Page) =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('button, a[href], input, select')].filter((el) => {
            const r = el.getBoundingClientRect();
            if (!r.width || getComputedStyle(el).visibility === 'hidden') return false;
            const a = getComputedStyle(el, '::after');
            const h = Math.max(r.height, parseFloat(a.height) || 0);
            const w = Math.max(r.width, parseFloat(a.width) || 0);
            return h < 43.5 || w < 43.5;
          }).map((el) => `${el.tagName} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}`),
        );
      const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

      it('setup card (steps 1, 2 prefilled, 2 with errors, done) and the settled section with every notice: axe clean, 44 px targets, no overflow', async () => {
        const tag = `${width}-${theme}`;
        const one = await open({ mode: 'setup', name: 'Nitin', width, theme });
        try {
          await shot(one.page, `setup-step1-${tag}`);
          await axe(one.page, 'setup 1');
          if (width < 640) expect(await small(one.page)).toEqual([]);
        } finally { await one.context.close(); }

        const two = await open({ mode: 'setup', step: 'travellers', device: { v: 1, adults: 2, children: [6, null] }, width, theme });
        try {
          await shot(two.page, `setup-step2-${tag}`);
          await axe(two.page, 'setup 2');
          await two.page.getByRole('button', { name: 'Add date of birth' }).nth(1).click();
          await two.page.getByRole('button', { name: "Add adults' ages (optional)" }).click();
          await save(two.page).click();
          await shot(two.page, `setup-step2-errors-${tag}`);
          await axe(two.page, 'setup 2 errors');
          if (width < 640) expect(await small(two.page)).toEqual([]);
          expect(await overflow(two.page)).toBe(0);
          await two.page.getByLabel('Date of birth (optional)').fill('2019-03-15');
          await two.page.locator('select').first().selectOption('6');
          await save(two.page).click();
          await shot(two.page, `setup-done-${tag}`);
          await axe(two.page, 'setup done');
        } finally { await two.context.close(); }

        const old = family({ children: [{ age: 17, age_as_of: '2025-01-10' }, { age: 8, age_as_of: '2025-09-01' }] });
        const all = await open({ travellers: old, revision: 2, device: { v: 1, adults: 1, children: [4] }, width, theme });
        try {
          await be(all.page.getByText('This browser plans for')).toBeVisible();
          await shot(all.page, `settled-notices-${tag}`);
          await axe(all.page, 'settled notices');
          if (width < 640) expect(await small(all.page)).toEqual([]);
          expect(await overflow(all.page)).toBe(0);
          await all.page.getByRole('button', { name: 'Edit travellers' }).click();
          await shot(all.page, `editor-${tag}`);
          await axe(all.page, 'editor');
          if (width < 640) expect(await small(all.page)).toEqual([]);
          expect(await overflow(all.page)).toBe(0);
        } finally { await all.context.close(); }

        const clean = await open({ travellers: family(), width, theme });
        try {
          await be(clean.page.getByText('2 adults · 2 children (7, 9)')).toBeVisible();
          await shot(clean.page, `settled-${tag}`);
          await axe(clean.page, 'settled');
          await clean.page.getByRole('button', { name: 'More' }).click();
          await clean.page.getByRole('menuitem', { name: 'Remove saved travellers' }).click();
          await be(clean.page.getByRole('menu')).toHaveCount(0);
          await shot(clean.page, `remove-confirm-${tag}`);
          await axe(clean.page, 'remove confirm');
          if (width < 640) expect(await small(clean.page)).toEqual([]);
        } finally { await clean.context.close(); }
      });
    });
  }
}
