import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteNav } from '@/components/shell/SiteNav';
import { THEME_INIT_SCRIPT, ThemeToggle } from '@/components/shell/ThemeToggle';
import { UnitSwitch } from '@/components/shell/UnitSwitch';
import { SITE_NAME, siteOrigin } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: 'Researched trip plans, and every place we want to go: trails, maps, timings and conditions.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

const BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="shell" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" href="/">
              Trip Plans
            </Link>
            <SiteNav />
            <div className="header-tools">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main id="main" className="page">
          {children}
        </main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <p>
              Published from the travel repo. <Link href="/about/data/">Data sources and licences</Link>
            </p>
            <UnitSwitch />
          </div>
        </footer>
        {BEACON_TOKEN ? (
          <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: BEACON_TOKEN })} />
        ) : null}
      </body>
    </html>
  );
}
