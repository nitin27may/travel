/**
 * Product settings that are not secrets. CONS-1 extends this file.
 *
 * `reportUrl` is the public feedback repo's new-issue URL with its form chosen (Q70). It is `null` until the repo exists, and
 * while it is `null` no "Report a problem" link is rendered anywhere. To turn the link on, replace `null` with
 * 'https://github.com/nitin27may/travel-feedback/issues/new?template=report.yml'. No email address goes here.
 */
export const reportUrl: string | null = null;

/** The issue-form URL with the page path added as `page` (path only, no query, no hash, nothing else about the visitor). The value is component-encoded, so `&`, `=`, `+` and `%` in a path cannot add or change a key of the form URL; only `/` stays literal. */
export function reportLink(base: string | null, page: string): string | null {
  if (!base) return null;
  const path = page.split(/[?#]/)[0] ?? '';
  const clean = path.startsWith('/') ? path : '/';
  return `${base}${base.includes('?') ? '&' : '?'}page=${encodeURIComponent(clean).replace(/%2F/g, '/')}`;
}
