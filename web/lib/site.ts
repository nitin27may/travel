import type { Metadata } from 'next';

const DEFAULT_ORIGIN = 'https://nks-travel.pages.dev';

/** The public origin; never hard-code the host elsewhere (plan section 14). */
export function siteOrigin(): string {
  // REF-REVIEW S7: the default is the OLD site, whose home page links every dated trip folder. A production deploy (VERCEL_ENV=production) or
  // a build that asks for it (REQUIRE_SITE_ORIGIN=1) must name its own origin, or the build fails rather than write canonical, sitemap and
  // export URLs on the old host. Dev, test and the e2e builds keep the default.
  if (!process.env.SITE_ORIGIN?.trim() && (process.env.VERCEL_ENV === 'production' || process.env.REQUIRE_SITE_ORIGIN === '1')) {
    throw new Error('SITE_ORIGIN is not set: a production build must name the public origin (docs/v2/build/public-site/README.md, Environment variables)');
  }
  const raw = (process.env.SITE_ORIGIN || DEFAULT_ORIGIN).trim();
  return raw.replace(/\/+$/, '');
}

export function absoluteUrl(pathname: string): string {
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${siteOrigin()}${p}`;
}

export const SITE_NAME = 'Trip Plans';

interface PageMeta {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  noindex?: boolean;
}

/** Metadata for a page: title, description, canonical and the four Open Graph tags plus twitter:card. */
export function pageMetadata({ title, description, path, image, noindex }: PageMeta): Metadata {
  const url = absoluteUrl(path);
  const og = image || absoluteUrl('/og-default.png');
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: { title, description, url, siteName: SITE_NAME, type: 'website', images: [{ url: og }] },
    twitter: { card: 'summary_large_image', title, description, images: [og] },
  };
}
