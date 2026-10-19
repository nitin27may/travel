import type { Topology } from './geometry';
import { buildAdmin, buildCountriesShapes, buildLakes, type AdminJob, type AdminResult, type CountriesJob, type CountriesResult } from './geoWork';

/**
 * Runs the heavy shape work in a Web Worker and falls back to doing it inline (tests, a browser without module workers, a worker that
 * failed to start). The answer is the same either way; only the thread differs.
 */
let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, { ok(v: unknown): void; fail(e: Error): void; retry(): unknown }>();

function start(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('./geo.worker.ts', import.meta.url), { type: 'module' });
    worker?.addEventListener('message', (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.ok) w.ok(e.data.result); else w.fail(new Error(e.data.error));
    });
    // a worker that dies: every request in flight is answered inline
    worker?.addEventListener('error', () => {
      worker = null;
      for (const [id, w] of [...waiting]) { waiting.delete(id); try { w.ok(w.retry()); } catch (err) { w.fail(err as Error); } }
    });
  } catch {
    worker = null;
  }
  return worker;
}

function call<T>(kind: 'admin' | 'countries' | 'lakes', job: AdminJob | CountriesJob | Topology, inline: () => T): Promise<T> {
  const w = start();
  if (!w) return Promise.resolve(inline());
  return new Promise<T>((ok, fail) => {
    const id = nextId++;
    waiting.set(id, { ok: ok as (v: unknown) => void, fail, retry: inline });
    w.postMessage({ id, kind, job });
  });
}

export const adminInWorker = (job: AdminJob): Promise<AdminResult> => call('admin', job, () => buildAdmin(job));
export const countriesInWorker = (job: CountriesJob): Promise<CountriesResult> => call('countries', job, () => buildCountriesShapes(job));
export const lakesInWorker = (topo: Topology): Promise<string> => call('lakes', topo, () => buildLakes(topo));
