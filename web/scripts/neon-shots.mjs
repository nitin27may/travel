// Screenshot the Neon account surfaces. Launches Chromium on the real GPU (ANGLE/Metal on macOS).
// Usage: node web/scripts/neon-shots.mjs   (server must be running on http://localhost:3000)
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const GPU_ARGS = ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const OUT = path.resolve('web/test-results/shots');
mkdirSync(OUT, { recursive: true });

// Read the signed-in session cookie from the curl jar so we can shoot the authenticated /account page.
function sessionCookies() {
  const jar = readFileSync('/tmp/e2e-cookies.txt', 'utf8');
  const cookies = [];
  for (const raw of jar.split('\n')) {
    if (!raw.trim()) continue;
    // Netscape jar: tab-separated domain,flag,path,secure,expiry,name,value. HttpOnly lines start with #HttpOnly_.
    if (raw.startsWith('#') && !raw.startsWith('#HttpOnly_')) continue;
    const parts = raw.replace(/^#HttpOnly_/, '').split('\t');
    if (parts.length < 7) continue;
    const name = parts[5];
    const value = parts[6];
    if (name && name.startsWith('__Secure-neon-auth')) {
      cookies.push({ name, value, domain: 'localhost', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' });
    }
  }
  return cookies;
}

const viewports = [
  { tag: '1440x900', width: 1440, height: 900 },
  { tag: '390x844', width: 390, height: 844 },
];
const themes = ['light', 'dark'];

const browser = await chromium.launch({ args: GPU_ARGS });
const cookies = sessionCookies();

async function shoot(name, urlPath, { authed = false } = {}) {
  for (const vp of viewports) {
    for (const theme of themes) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        colorScheme: theme,
      });
      // The site themes via document.documentElement.dataset.theme, seeded from localStorage
      // (key travel:v1:theme) by an inline init script — not prefers-color-scheme. Seed it.
      await ctx.addInitScript((t) => {
        try { localStorage.setItem('travel:v1:theme', t); } catch { /* ignore */ }
      }, theme);
      if (authed) await ctx.addCookies(cookies);
      const page = await ctx.newPage();
      await page.goto(`http://localhost:3000${urlPath}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const file = path.join(OUT, `${name}-${vp.tag}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log('shot', file);
      await ctx.close();
    }
  }
}

await shoot('sign-in', '/sign-in/');
await shoot('sign-up', '/sign-up/');
await shoot('account-signed-in', '/account/', { authed: true });
await browser.close();
