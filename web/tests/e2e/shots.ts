import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

/** The screenshot harness (build plan 4.2): every page a lane owns at 1440 x 900 and 390 x 844, light and dark, 2x. */
export const SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const SHOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'test-results', 'shots');
const THEME_KEY = 'travel:v1:theme';

/** Sets the theme in localStorage before the page loads, so the init script applies it before first paint. */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage unavailable */
      }
    },
    [THEME_KEY, theme],
  );
}

export interface ShootOptions {
  /** Capture the whole page rather than the first viewport. */
  fullPage?: boolean;
  /** Run after navigation and before the capture (open a sheet, hover a card). */
  prepare?: (page: Page) => Promise<void>;
  /** Cut tall pages into 1600 px tiles as well as the one image. */
  tile?: boolean;
}

/** Path of a shot: `test-results/shots/<lane>/<name>-<width>-<theme>.png`. */
export function shotPath(lane: string, name: string, width: number, theme: Theme, tileIndex?: number): string {
  const suffix = tileIndex === undefined ? '' : `-t${String(tileIndex).padStart(2, '0')}`;
  return path.join(SHOT_DIR, lane, `${name}-${width}-${theme}${suffix}.png`);
}

/**
 * Cuts a page into strips of `height` CSS pixels and writes each as `<name>-tNN.png`.
 * Edges through boxes and arrowheads on labels only show at this size, so read tall pages in tiles.
 */
export async function tiles(page: Page, file: string, height = 1600): Promise<string[]> {
  const width = page.viewportSize()?.width ?? 1440;
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const out: string[] = [];
  for (let i = 0, y = 0; y < total; i++, y += height) {
    const f = file.replace(/\.png$/, `-t${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f, fullPage: true, clip: { x: 0, y, width, height: Math.min(height, total - y) } });
    out.push(f);
  }
  return out;
}

/**
 * Opens `url` at both sizes in both themes (a fresh context each, 2x) and writes the four PNGs.
 * Returns the paths. `browser` comes from the Playwright fixture.
 */
export async function shoot(
  browser: import('@playwright/test').Browser,
  baseURL: string,
  lane: string,
  name: string,
  url: string,
  { fullPage = false, prepare, tile = false }: ShootOptions = {},
): Promise<string[]> {
  const written: string[] = [];
  for (const theme of THEMES) {
    for (const size of SIZES) {
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2, locale: 'en-CA' });
      const page = await context.newPage();
      await setTheme(page, theme);
      if (!process.env.SHOTS_NETWORK) await page.route((u) => !/^(127\.0\.0\.1|localhost)$/.test(u.hostname), (route) => route.abort());
      await page.goto(`${baseURL}${url}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      if (prepare) await prepare(page);
      const file = shotPath(lane, name, size.width, theme);
      mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file, fullPage });
      written.push(file);
      if (tile) written.push(...(await tiles(page, file)));
      await context.close();
    }
  }
  return written;
}
