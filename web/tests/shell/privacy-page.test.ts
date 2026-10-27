import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { metadata } from '@/app/privacy/page';
import { PrivacyBody } from '@/app/privacy/PrivacyBody';
import { sitemapInput } from '@/lib/sitemap';
import { WEB } from '../helpers/built';

const render = (google: boolean, googleSignIn = false) => renderToStaticMarkup(createElement(PrivacyBody, { google, googleSignIn }));
const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\u2019/g, "'");
const html = render(false);
const text = strip(html);

describe('the privacy page (GSI-P)', () => {
  it('is public: indexable, with its own canonical path', () => {
    expect(metadata.robots).toBeUndefined();
    expect(String(metadata.alternates?.canonical)).toMatch(/\/privacy\/$/);
    expect(html).toContain('<h1>Privacy</h1>');
  });

  it('names each service the site uses and what it does with it', () => {
    for (const t of [
      'Cloudflare Web Analytics', 'sets no cookies', 'which site linked to them', 'country, browser, operating system and kind of device', 'It runs only on the live site',
      'Reading the site sets no cookies', 'Signing in sets cookies', 'Vercel', 'request logs', 'deletes them after a limited time', 'Neon', 'trip drafts you save',
      'your name if you give one', 'your password, if you set one, in a scrambled form', 'Turnstile',
      'Resend only to send alerts to the site owner', 'The pages hold no household data', 'Removing your account', 'Last changed 27 October 2026',
    ]) expect(text, t).toContain(t);
    expect(text).toContain('email nitin27may@gmail.com');
    expect(html).toContain('href="mailto:nitin27may@gmail.com"');
  });

  it('says what the sign-in guard keeps and sends, as the code does it (review EML-S SF6)', () => {
    for (const t of [
      // Keys are the address, the IP and the two together (core/src/quota/keys.ts), not a network range.
      'for each email address, for each IP address, and for the two together',
      // quota_take() purges keyed rows 48 h after their window ends, only when it runs (0011_quota.sql); day windows make that 72 h.
      'deleted at the next sign-in attempt by anyone once it is two days past its period', 'at most three days after your attempt',
      'are kept for 35 days',
      // lib/server/turnstile.ts sends remoteip to siteverify.
      'our server sends Cloudflare your IP address with the check',
      // The EML-P wording of "Decision 25 Oct" (email spec).
      "Sign-in, confirmation and password reset emails are sent by Neon, which runs our sign-in, from auth@mail.myneon.app under the name Neon Auth. They use Neon's standard wording. We don't send these emails ourselves yet.",
    ]) expect(text, t).toContain(t);
    for (const t of ['each network', 'within two days']) expect(text, t).not.toContain(t);
  });

  it('names Google Maps only when a Google map family is on', () => {
    expect(text).not.toContain('Google');
    const on = render(true);
    expect(strip(on)).toContain('Trip maps use Google Maps');
    expect(on).toContain('href="https://policies.google.com/privacy"');
  });

  it('"What we keep" lands on the Accounts heading (copy page 63)', () => {
    expect(html).toContain('<h2 id="accounts">Accounts</h2>');
  });

  it('lists the sign-in notes kept on this device, never a password, a code or (in storage) an address beyond the reset hand-off', () => {
    for (const t of ['auth.lastMethod', 'auth.resetEmail', 'never your address', 'never a password or a code', 'when you close the tab']) expect(text, t).toContain(t);
    expect(text).not.toContain('auth.google');
  });

  it('with Continue with Google on: what Google sends, what we keep, and how to stop it (copy page 59 to 62, GSI-R M1)', () => {
    const on = render(false, true);
    const t = strip(on);
    expect(t).toContain(
      'If you use Continue with Google, Google tells us your name, your email address, whether Google has confirmed it, and a link to your Google profile photo. We keep them with your account. We do not show your name on any page and we do not use the photo. We never see your Google password, contacts, calendar or files, and we ask Google for nothing else.',
    );
    expect(t).toContain('To stop Google sharing your details with us, remove Trip Plans at myaccount.google.com/permissions (opens in a new tab) . That does not delete your account here; see "Removing your account" below.'.replace(/"/g, '\u201c').replace('\u201cRemoving your account\u201c', '\u201cRemoving your account\u201d'));
    expect(on).toContain('href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer"');
    for (const k of ['auth.lastMethod', 'auth.resetEmail', 'auth.googlePending', 'auth.googleBefore', 'an emailed code, a password or Google']) expect(t, k).toContain(k);
    // String 61 (Neon keeps Google's tokens) waits for U6.
    expect(t).not.toContain('sign-in tokens');
    expect(on).toContain('<h2 id="accounts">Accounts</h2>');
  });

  it('the privacy page passes the Google sign-in flag through', () => {
    expect(readFileSync(path.join(WEB, 'app', 'privacy', 'page.tsx'), 'utf8')).toContain('googleSignIn={authFlags.signInGoogle}');
  });

  it('does not claim owner approval', () => {
    for (const f of ['page.tsx', 'PrivacyBody.tsx']) expect(readFileSync(path.join(WEB, 'app', 'privacy', f), 'utf8'), f).not.toMatch(/owner-approved|approved wording/);
  });

  it('has one h1 and links to the terms', () => {
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('href="/terms"');
  });

  it('is in the sitemap', () => expect(sitemapInput([], []).fixed).toContain('/privacy/'));

  it('has a footer link, and the footer is on every page through the layout', () => {
    const footer = readFileSync(path.join(WEB, 'components', 'shell', 'SiteFooter.tsx'), 'utf8');
    expect(footer).toContain('<Link href="/privacy/">Privacy</Link>');
    expect(readFileSync(path.join(WEB, 'app', 'layout.tsx'), 'utf8')).toContain('<SiteFooter />');
  });
});
