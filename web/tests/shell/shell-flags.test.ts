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
});
