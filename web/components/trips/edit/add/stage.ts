// Work done a little at a time while the page is idle (review STEP2-PRV PR-003): the park arrival scores each member on its near days with the
// template scheduler, a few milliseconds each. The rows on show go first, in their order, in batches inside the browser's idle time, so the
// sheet opens at once and a long list never holds the main thread. Pure over the host, so a test drives it with a fake clock.
import { TRIP_EDIT_UI } from '@/lib/config/product';

export interface IdleDeadline {
  timeRemaining(): number;
}
export interface IdleHost {
  request(cb: (d: IdleDeadline) => void): number;
  cancel(handle: number): void;
}

const { idleSliceMs, idleTimeoutMs } = TRIP_EDIT_UI;

/** `requestIdleCallback`, with a timeout so it never starves; a timer where the browser has none (WebKit). */
export const browserIdle = (): IdleHost => {
  const w = globalThis as typeof globalThis & { requestIdleCallback?: (cb: (d: IdleDeadline) => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
  if (typeof w.requestIdleCallback === 'function' && typeof w.cancelIdleCallback === 'function') {
    return { request: (cb) => w.requestIdleCallback!(cb, { timeout: idleTimeoutMs }), cancel: (h) => w.cancelIdleCallback!(h) };
  }
  return {
    request: (cb) => {
      const start = Date.now();
      return setTimeout(() => cb({ timeRemaining: () => Math.max(0, idleSliceMs - (Date.now() - start)) }), 16) as unknown as number;
    },
    cancel: (h) => clearTimeout(h),
  };
};

/**
 * Runs `work` over `jobs` in order, a batch per idle callback (at least one job each, then while the deadline has time left), and reports every
 * result so far after each batch. Returns the cancel: a closed sheet or a new list stops it at once.
 */
export function runStaged<J, R>(jobs: readonly J[], work: (job: J) => R, onBatch: (done: ReadonlyMap<J, R>) => void, host: IdleHost = browserIdle()): () => void {
  const done = new Map<J, R>();
  let i = 0;
  let handle: number | null = null;
  let live = true;
  const step = (d: IdleDeadline) => {
    handle = null;
    if (!live) return;
    do {
      const job = jobs[i++]!;
      done.set(job, work(job));
    } while (i < jobs.length && d.timeRemaining() > 1);
    onBatch(done);
    if (live && i < jobs.length) handle = host.request(step);
  };
  if (jobs.length) handle = host.request(step);
  return () => {
    live = false;
    if (handle !== null) host.cancel(handle);
  };
}
