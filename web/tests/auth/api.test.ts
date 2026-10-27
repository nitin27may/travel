// @vitest-environment node
// The card's fetch wrapper (components/auth/api.ts): the timeout the Google start uses (GSI-R S3), and the answers it maps to.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authCall } from '@/components/auth/api';
import { GOOGLE_START_TIMEOUT_MS } from '@/lib/auth/google';
import { googleStartNotice, GOOGLE_COPY } from '@/lib/auth/oauth-errors';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A fetch that never answers until its signal aborts, as a held hotel-wifi request does. */
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }));
}

describe('authCall timeout (GSI-R S3)', () => {
  it('waits 15 s for the Google start', () => expect(GOOGLE_START_TIMEOUT_MS).toBe(15_000));

  it('gives up after timeoutMs with status 0 and TIMEOUT, which reads string 13', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { onLine: true });
    const fetch = hangingFetch();
    vi.stubGlobal('fetch', fetch);
    const pending = authCall('sign-in/social', { provider: 'google' }, null, { timeoutMs: GOOGLE_START_TIMEOUT_MS });
    await vi.advanceTimersByTimeAsync(GOOGLE_START_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const reply = await pending;
    expect(reply).toEqual({ status: 0, code: 'TIMEOUT', retryAfterS: null, body: null });
    expect(fetch.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(googleStartNotice(reply)).toEqual({ tone: 'notice', message: GOOGLE_COPY.startFailed });
  });

  it('an answer in time clears the timer and reads as before', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ url: 'https://accounts.google.com/x' }), { status: 200, headers: { 'retry-after': '0' } })));
    const reply = await authCall('sign-in/social', {}, null, { timeoutMs: 1000 });
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ url: 'https://accounts.google.com/x' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('without timeoutMs no signal is passed (the email calls are unchanged)', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await authCall('sign-in/email', {});
    expect((fetch.mock.calls[0] as unknown[])[1]).toMatchObject({ signal: undefined });
  });

  it('a network error that is not the timeout stays NETWORK', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('failed'); }));
    expect((await authCall('sign-in/social', {}, null, { timeoutMs: 1000 })).code).toBe('NETWORK');
  });
});
