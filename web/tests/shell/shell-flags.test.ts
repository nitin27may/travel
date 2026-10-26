import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/places/moraine-lake/' }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

import { capabilities } from '@/lib/capabilities';
import { reportLink, reportUrl } from '@/lib/config/product';
import { reportProblem } from '@/lib/client/data';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { BottomBar } from '@/components/shell/BottomBar';
import { mineCurrent } from '@/lib/mine/current';
import { ReportAnchor } from '@/components/shell/ReportLink';

const FORM = 'https://example.test/feedback/issues/new?template=report.yml';

describe('signIn flag (11.1)', () => {
  it('is off in the shipped config', () => expect(capabilities.signIn).toBe(false));
  it('header and phone bar show no Sign in when off', () => {
    expect(renderToStaticMarkup(createElement(SiteHeader))).not.toContain('Sign in');
    expect(renderToStaticMarkup(createElement(BottomBar))).not.toContain('Sign in');
  });
  it('header shows Sign in, linking to /sign-in/, when on', () => {
    const html = renderToStaticMarkup(createElement(SiteHeader, { capabilities: { signIn: true } }));
    expect(html).toMatch(/href="\/sign-in\/?"/);
    expect(html).toContain('Sign in');
  });
});

describe('phone bar: Mine replaces the interim account item (NAV-1)', () => {
  it('renders the same five items whatever the sign-in flag, Mine last, with no session-driven label', () => {
    const html = renderToStaticMarkup(createElement(BottomBar));
    expect(html).toMatch(/href="\/mine\/?"[^>]*>.*Mine<\/a>/);
    expect(html).not.toContain('data-acct');
    expect(html).not.toContain('Sign in');
    expect(html.match(/<(a|button)\b/g)).toHaveLength(5);
    expect(html.indexOf('Search')).toBeLessThan(html.indexOf('Mine'));
  });
  it('draws the bar icons as CSS masks, not inline SVG', () => {
    const html = renderToStaticMarkup(createElement(BottomBar));
    expect(html).not.toContain('<svg');
    expect(html).toContain('mi-layers');
  });
});

describe('phone header account link (NAV-F D2)', () => {
  const on = renderToStaticMarkup(createElement(SiteHeader, { capabilities: { signIn: true } }));
  it('renders both links, Sign in and Account, between Search and Theme, for html[data-signed-in] to swap', () => {
    expect(on).toMatch(/href="\/sign-in\/" data-acct="out" aria-label="Sign in"/);
    expect(on).toMatch(/href="\/account\/" data-acct="in" aria-label="Account"/);
    expect(on.indexOf('aria-label="Search"')).toBeLessThan(on.indexOf('data-acct="out"'));
    expect(on.indexOf('data-acct="in"')).toBeLessThan(on.indexOf('Switch to'));
  });
  it('renders neither when sign-in is off', () => {
    expect(renderToStaticMarkup(createElement(SiteHeader, { capabilities: { signIn: false } }))).not.toContain('data-acct');
  });
  it('reserves the Mine slot and ships no Mine link markup (it mounts after hydration)', () => {
    expect(on).toContain('mine-slot');
    expect(on).not.toContain('mine-link');
  });
});

describe('Mine current by path (D3)', () => {
  it('is "page" on /mine/ and "true" in the account flow, and nowhere else', () => {
    expect(mineCurrent('/mine/', true)).toBe('page');
    for (const p of ['/account/', '/sign-in/', '/sign-in/reset/', '/sign-up/']) expect(mineCurrent(p, true), p).toBe('true');
    for (const p of ['/', '/trips/', '/places/mine-lake/', '/globe/', '/signin/']) expect(mineCurrent(p, true), p).toBeUndefined();
  });
  it('does not light Mine on the account routes when sign-in is off (the public build placeholders)', () => {
    for (const p of ['/account/', '/sign-in/', '/sign-up/']) expect(mineCurrent(p, false), p).toBeUndefined();
    expect(mineCurrent('/mine/', false)).toBe('page');
  });
});

describe('Report a problem (11.2)', () => {
  it('is off until the repo exists, and the boundary says so', async () => {
    expect(reportUrl).toBeNull();
    expect(await reportProblem({ page: '/places/moraine-lake/' })).toEqual({ kind: 'off' });
  });
  it('renders no anchor when off, an external anchor when on', () => {
    expect(renderToStaticMarkup(createElement(ReportAnchor, { url: null }))).toBe('');
    const html = renderToStaticMarkup(createElement(ReportAnchor, { url: reportLink(FORM, '/places/moraine-lake/') }));
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('page=/places/moraine-lake/');
    expect(html).toContain('Report a problem');
  });
  it('carries the path only: no query, no hash, no email', () => {
    expect(reportLink(FORM, '/trips/x/?q=secret#top')).toBe(`${FORM}&page=/trips/x/`);
    expect(reportLink('https://example.test/new', 'not-a-path')).toBe('https://example.test/new?page=/');
    expect(reportLink(null, '/')).toBeNull();
    expect(FORM + reportLink(FORM, '/a/')).not.toMatch(/@/);
  });
  it('a hostile page path cannot add or alter a key: exactly one page param, base keys intact', () => {
    const hostile = ['/x&title=x', '/x&labels=bug&template=evil.yml', '/a=b', '/a+b%26c', '/a b', '/caf\u00e9/\u5c71/', '/x#frag&title=y', '/x?title=z&page=2', '/\u0026title=u'];
    for (const p of hostile) {
      const url = new URL(reportLink(FORM, p)!);
      expect([...url.searchParams.keys()]).toEqual(['template', 'page']);
      expect(url.searchParams.get('template')).toBe('report.yml');
      expect(url.hash).toBe('');
      const page = url.searchParams.get('page')!;
      expect(page.startsWith('/')).toBe(true);
      expect(page).toBe(p.split(/[?#]/)[0]);
    }
  });
  it('keeps slashes readable and encodes the rest', () => {
    expect(reportLink(FORM, '/a b/caf\u00e9/')).toBe(`${FORM}&page=/a%20b/caf%C3%A9/`);
    expect(reportLink(FORM, '/x&title=x')).toBe(`${FORM}&page=/x%26title%3Dx`);
    expect(reportLink('https://example.test/new', '/x&a=b')).toBe('https://example.test/new?page=/x%26a%3Db');
  });
});
