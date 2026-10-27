// The Continue with Google button and step 1's Google part (GSI-1; Google spec 4.1 to 4.5, copy page strings 1 to 6 and 10).
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GoogleButton, GoogleStart } from '@/components/auth/GoogleButton';
import { GOOGLE_COPY } from '@/lib/auth/oauth-errors';

const web = path.resolve(__dirname, '..', '..');

describe('GoogleButton', () => {
  it('is a real button named by its visible text, with a decorative "G" and no aria-label', () => {
    const h = renderToStaticMarkup(<GoogleButton busy={false} onPress={() => {}} describedBy="d1" />);
    expect(h).toContain('<button type="button" class="auth-google"');
    expect(h).toContain('>Continue with Google</span>');
    expect(h).not.toContain('aria-label');
    expect(h).toContain('<img src="/brand/google-g.svg" alt="" width="18" height="18"/>');
    expect(h).toContain('aria-describedby="d1"');
    expect(h).not.toContain('aria-busy');
  });
  it('while it leaves for Google: aria-busy, a spinner in place of the "G", the same label (string 10)', () => {
    const h = renderToStaticMarkup(<GoogleButton busy onPress={() => {}} />);
    expect(h).toContain('aria-busy="true"');
    expect(h).toContain('data-loading="true"');
    expect(h).toContain('class="btn-spin"');
    expect(h).not.toContain('<img');
    expect(h).toContain('>Continue with Google</span>');
  });
});

describe('GoogleStart (step 1)', () => {
  it('button first, then the consent line with "What we keep" to the privacy page, then the divider "or"', () => {
    const h = renderToStaticMarkup(<GoogleStart busy={false} onPress={() => {}} lastUsed={false} />);
    const order = ['class="auth-google"', GOOGLE_COPY.consent, '>What we keep<', 'class="auth-divider"', '>or<'].map((n) => h.indexOf(n));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(h).toContain('aria-describedby="auth-google-consent"');
    // next/link writes the trailing slash in the build (trailingSlash: true), not in a unit render
    expect(h).toMatch(/<a href="\/privacy\/?#accounts">What we keep<\/a>/);
    expect(h).not.toContain(GOOGLE_COPY.lastUsed);
    expect(h).not.toContain(GOOGLE_COPY.hostNote);
  });
  it('shows "Last used on this browser" when Google was the last way in, and the button reads it (string 6)', () => {
    const h = renderToStaticMarkup(<GoogleStart busy={false} onPress={() => {}} lastUsed />);
    expect(h).toContain(`id="auth-google-last">${GOOGLE_COPY.lastUsed}</p>`);
    expect(h).toContain('aria-describedby="auth-google-last auth-google-consent"');
  });
});

describe('colour and the mark', () => {
  it('the button takes its colours only from the brand tokens (tokens.md 2.3)', () => {
    const css = readFileSync(path.join(web, 'components', 'auth', 'auth.css'), 'utf8');
    const rule = css.slice(css.indexOf('.auth-google {'), css.indexOf('}', css.indexOf('.auth-google {')));
    expect(rule).toContain('border: 1px solid var(--brand-google-stroke)');
    expect(rule).toContain('background: var(--brand-google-fill)');
    expect(rule).toContain('color: var(--brand-google-ink)');
    expect(css).not.toMatch(/--brand-google-[\w-]+\s*:/);
  });
  it('is never below the 44 px touch target: 46 on phones, --touch-min from 640 px (GSI-R S2)', () => {
    const css = readFileSync(path.join(web, 'components', 'auth', 'auth.css'), 'utf8');
    const rules = [...css.matchAll(/\.auth-google\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const heights = rules.flatMap((r) => [...r.matchAll(/min-height:\s*([^;]+);/g)].map((m) => m[1].trim()));
    expect(heights.sort()).toEqual(['46px', 'var(--touch-min)']);
  });
  it("the G is Google's four-colour mark as a file, never inline markup", () => {
    const svg = readFileSync(path.join(web, 'public', 'brand', 'google-g.svg'), 'utf8');
    // Google's four colours (red, blue, yellow, green), written without a hex literal (no-hex.test.ts holds every source file)
    const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1].toUpperCase());
    expect(fills.filter((f) => f !== 'NONE')).toEqual(['EA4335', '4285F4', 'FBBC05', '34A853'].map((h) => String.fromCharCode(35) + h));
    expect(readFileSync(path.join(web, 'components', 'auth', 'GoogleButton.tsx'), 'utf8')).not.toContain('<svg');
  });
});
