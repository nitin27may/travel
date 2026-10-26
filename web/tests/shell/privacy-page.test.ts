import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { metadata } from '@/app/privacy/page';
import { PrivacyBody } from '@/app/privacy/PrivacyBody';
import { sitemapInput } from '@/lib/sitemap';
import { WEB } from '../helpers/built';

const render = (google: boolean) => renderToStaticMarkup(createElement(PrivacyBody, { google }));
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
      'your name if you give one', 'scrambled form', 'within two days', 'Turnstile', 'Sign-in and password reset codes are sent by Neon',
      'Resend only to send alerts to the site owner', 'The pages hold no household data', 'Removing your account', 'Last changed 26 October 2026',
    ]) expect(text, t).toContain(t);
    expect(text).toContain('email nitin27may@gmail.com');
    expect(html).toContain('href="mailto:nitin27may@gmail.com"');
  });

  it('names Google Maps only when a Google map family is on', () => {
    expect(text).not.toContain('Google');
    const on = render(true);
    expect(strip(on)).toContain('Trip maps use Google Maps');
    expect(on).toContain('href="https://policies.google.com/privacy"');
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
