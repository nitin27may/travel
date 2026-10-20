// Drives headless Chromium (Arc GPU flags) against serve.mjs and prints/writes the timings.
//   node browser/measure.mjs [port]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { CACHE, HERE } from '../common.mjs';

const port = Number(process.argv[2] ?? 4317);
const base = `http://127.0.0.1:${port}`;
const labels = JSON.parse(readFileSync(path.join(HERE, 'labels.json'), 'utf8')).queries.map((q) => q.query);
const places = JSON.parse(readFileSync(path.join(CACHE, 'places.json'), 'utf8'));
const { vecs: nodeVecs } = JSON.parse(readFileSync(path.join(CACHE, 'vectors.json'), 'utf8'));
const { cardText } = await import('../common.mjs');
const texts = places.slice(0, 50).map(cardText);
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`;
const ARGS = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-webgpu', '--enable-features=Vulkan'];

const rss = async (browser) => {
  const cdp = await browser.newBrowserCDPSession();
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  let total = 0;
  for (const p of processInfo.filter((x) => x.type === 'renderer' || x.type === 'gpu-process' || x.type === 'GPU')) {
    try {
      const m = readFileSync(`/proc/${p.id}/status`, 'utf8').match(/VmRSS:\s+(\d+) kB/);
      total += m ? Number(m[1]) / 1024 : 0;
    } catch { /* process gone */ }
  }
  await cdp.detach();
  return Math.round(total);
};
const cosine = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

async function run(cfg) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
  const ctx = await browser.newContext(); // fresh: empty Cache API, so the first load is a cold, uncached one
  const result = { cfg, visits: [] };
  for (const visit of ['first (download)', 'return (cached)']) {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
    page.on('console', (m) => { if (m.type() === 'error') console.log('console.error', m.text().slice(0, 300)); });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    let transferred = 0;
    const kinds = new Map();
    cdp.on('Network.responseReceived', (e) => kinds.set(e.requestId, e.response.url));
    cdp.on('Network.loadingFinished', (e) => { transferred += e.encodedDataLength; const u = kinds.get(e.requestId) ?? ''; if (/\.(onnx|wasm)/.test(u)) result[`bytes_${u.split('/').pop()}`] = e.encodedDataLength; });
    await page.goto(`${base}/bench.html${cfg.iso ? '?iso=1' : ''}`);
    await page.waitForFunction(() => window.benchReady);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
    const before = await rss(browser);
    const r = await page.evaluate((c) => window.bench(c), { device: cfg.device, queries: labels, texts, rounds: cfg.rounds, threads: cfg.threads ?? 4 });
    const after = await rss(browser);
    if (r.vecs) {
      const cos = r.vecs.map((v, i) => cosine(v, nodeVecs[i]));
      r.parityMinCos = Math.min(...cos);
      delete r.vecs;
    }
    r.visit = visit;
    r.transferredMB = +(transferred / 1e6).toFixed(2);
    r.rssBeforeMB = before;
    r.rssAfterMB = after;
    r.rssExtraMB = after - before;
    result.visits.push(r);
    await page.close();
    if (r.error) break;
  }
  await browser.close();
  return result;
}

const plan = [
  { name: 'wasm 1 thread, 1x CPU (desktop)', device: 'wasm', throttle: 1, rounds: 3 },
  { name: 'wasm 1 thread, 4x CPU (phone proxy)', device: 'wasm', throttle: 4, rounds: 3 },
  { name: 'wasm 4 threads, 4x CPU (phone proxy, isolated page)', device: 'wasm', throttle: 4, rounds: 3, iso: true, threads: 4 },
  { name: 'webgpu, 1x CPU (desktop)', device: 'webgpu', throttle: 1, rounds: 3 },
  { name: 'webgpu, 4x CPU (phone proxy)', device: 'webgpu', throttle: 4, rounds: 3 },
];
const only = process.argv[3];
const out = [];
for (const cfg of plan) {
  if (only && !cfg.name.includes(only)) continue;
  console.log('running', cfg.name);
  const r = await run(cfg);
  out.push(r);
  console.log(JSON.stringify(r.visits.map((v) => ({ visit: v.visit, error: v.error, loadMs: v.loadMs && Math.round(v.loadMs), first: v.firstQueryMs && Math.round(v.firstQueryMs), warm: v.warm && { p50: Math.round(v.warm.p50), p95: Math.round(v.warm.p95) }, MB: v.transferredMB, rssExtraMB: v.rssExtraMB, parity: v.parityMinCos, adapter: v.adapter, iso: v.crossOriginIsolated }))));
}
writeFileSync(path.join(HERE, only ? 'browser-results.partial.json' : 'browser-results.json'), JSON.stringify({ chrome: CHROME, args: ARGS, runs: out }, null, 1));
