import { AUTH_GUARD } from '@travel/core/config/auth-limits.ts';

/**
 * The answer hold of the send and sign-up routes (review EML-S SF5). Neon answers faster when it sends nothing (an unknown address on a
 * reset request, an existing one on sign-up), so the guard holds every answer of those routes until a fixed minimum time plus jitter
 * has passed since it started. The numbers live in `core/src/config/auth-limits.ts` (AUTH_GUARD).
 */

/** How much longer to wait, in ms, after `elapsedMs` of work; `random` is in [0, 1). Never negative. */
export function answerHoldMs(elapsedMs: number, random: number, limits: { answerMinMs: number; answerJitterMs: number } = AUTH_GUARD): number {
  const r = Number.isFinite(random) ? Math.min(Math.max(random, 0), 1) : 0;
  const target = limits.answerMinMs + Math.floor(r * limits.answerJitterMs);
  return Math.max(0, Math.ceil(target - elapsedMs));
}

/** Wait `ms` (a timer; route tests mock this module so they do not wait). */
export function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/** A monotonic clock in ms (not the wall clock, which tests fake and NTP can step). */
export function monotonicMs(): number {
  return performance.now();
}
