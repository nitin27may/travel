import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import PrivacyPage, { metadata } from '@/app/privacy/page';
import { sitemapInput } from '@/lib/sitemap';
import { WEB } from '../helpers/built';

const html = renderToStaticMarkup(createElement(PrivacyPage));
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the privacy page (GSI-P)', () => {
  it('is public: indexable, with its own canonical path', () => {
    expect(metadata.robots).toBeUndefined();
    expect(String(metadata.alternates?.canonical)).toMatch(/\/privacy\/$/);
    expect(html).toContain('<h1>Privacy</h1>');
  });

  it('names each service the site uses and what it does with it (the approved copy)', () => {
    expect(text).toContain('Cloudflare Web Analytics');
    expect(text).toContain('It uses no cookies');
    expect(text).toContain('by path');
    expect(text).toContain('It is off everywhere except the live site');
    expect(text).toContain('Vercel');
    expect(text).toContain('request logs');
    expect(text).toContain('Neon');
    expect(text).toContain('Turnstile');
    expect(text).toContain('Resend only to send alerts to the site owner');
    expect(text).toContain('The pages hold no household data');
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
