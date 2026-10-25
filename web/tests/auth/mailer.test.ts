import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectMailer } from '@/lib/server/mailer';

const OWNER = 'owner@example.test';

afterEach(() => vi.unstubAllGlobals());

describe('mail adapter selection (fails closed)', () => {
  it('uses the outbox under NODE_ENV test, behind the owner-only guard', async () => {
    const m = selectMailer({ NODE_ENV: 'test', OWNER_EMAIL: OWNER });
    expect(m.kind).toBe('outbox');
    expect((await m.send({ to: OWNER, subject: 's', text: 't' })).ok).toBe(true);
    expect(await m.send({ to: 'visitor@example.test', subject: 's', text: 't' })).toEqual({ ok: false, reason: 'recipient' });
  });

  it('refuses the outbox on a Vercel production deployment, even under NODE_ENV test', async () => {
    const m = selectMailer({ NODE_ENV: 'test', VERCEL_ENV: 'production', OWNER_EMAIL: OWNER });
    expect(m.kind).toBe('disabled');
    expect(await m.send({ to: OWNER, subject: 's', text: 't' })).toEqual({ ok: false, reason: 'config' });
  });

  it.each([
    [{ NODE_ENV: 'production' }],
    [{ NODE_ENV: 'production', RESEND_API_KEY: 're_x' }],
    [{ NODE_ENV: 'production', OWNER_EMAIL: OWNER }],
    [{ NODE_ENV: 'production', RESEND_API_KEY: '  ', OWNER_EMAIL: OWNER }],
    [{ NODE_ENV: 'development', OWNER_EMAIL: OWNER }],
  ])('is disabled when the Resend key or OWNER_EMAIL is missing: %j', async (env) => {
    expect(selectMailer(env).kind).toBe('disabled');
  });

  it('uses Resend from the sandbox sender, to the owner only, while MAIL_FROM is unset', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ id: 'msg' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const m = selectMailer({ NODE_ENV: 'production', VERCEL_ENV: 'production', RESEND_API_KEY: 're_x', OWNER_EMAIL: OWNER });
    expect(m.kind).toBe('resend');
    expect(await m.send({ to: 'visitor@example.test', subject: 's', text: 't' })).toEqual({ ok: false, reason: 'recipient' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await m.send({ to: OWNER, subject: 's', text: 't' })).toEqual({ ok: true, id: 'msg' });
    const body = JSON.parse(String((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.from).toBe('Trip Plans <onboarding@resend.dev>');
  });
});
