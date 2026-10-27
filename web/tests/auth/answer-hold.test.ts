// The answer hold of the send and sign-up routes (review EML-S SF5): pure maths, then the real timer under fake timers.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_GUARD } from '@travel/core/config/auth-limits.ts';
import { answerHoldMs, sleep } from '@/lib/auth/answer-hold';

describe('answerHoldMs', () => {
  const limits = { answerMinMs: 1000, answerJitterMs: 200 };

  it('waits the minimum plus jitter, less the time already spent', () => {
    expect(answerHoldMs(0, 0, limits)).toBe(1000);
    expect(answerHoldMs(300, 0.5, limits)).toBe(800);
    expect(answerHoldMs(0, 0.999, limits)).toBe(1199);
  });

  it('never waits a negative time, and clamps a bad random value', () => {
    expect(answerHoldMs(5000, 0.5, limits)).toBe(0);
    expect(answerHoldMs(0, Number.NaN, limits)).toBe(1000);
    expect(answerHoldMs(0, 7, limits)).toBe(1200);
    expect(answerHoldMs(0, -1, limits)).toBe(1000);
  });

  it('uses the configured numbers by default', () => {
    expect(answerHoldMs(0, 0)).toBe(AUTH_GUARD.answerMinMs);
    expect(AUTH_GUARD.answerJitterMs).toBeGreaterThan(0);
  });
});

describe('sleep', () => {
  afterEach(() => vi.useRealTimers());

  it('resolves after the time asked for, and at once for zero', async () => {
    vi.useFakeTimers();
    let done = false;
    const p = sleep(1200).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(1199);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    await expect(sleep(0)).resolves.toBeUndefined();
  });
});
