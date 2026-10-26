import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { BottomBar } from '@/components/shell/BottomBar';
import { AccountItems } from '@/components/shell/AccountItems';
import { capabilities } from '@/lib/capabilities';
import { SiteFooter } from '@/components/shell/SiteFooter';
import { SiteHeader } from '@/components/shell/SiteHeader';
import { THEME_INIT_SCRIPT } from '@/components/shell/ThemeToggle';
import { ToastProvider } from '@/components/ui/Toast';
import { SITE_NAME, siteOrigin } from '@/lib/site';
import './globals.css';
import './themes.css';
import '@/components/ui/ui.css';
import './app.css';
import './account.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: 'Researched trip plans, and every place we want to go: trails, maps, timings and conditions.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

const BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

// The two faces that paint first: Big Shoulders for titles, Source Serif roman for body (tokens 6).
const PRELOAD = ['big-shoulders-display-latin-wght-normal.woff2', 'source-serif-4-latin-wght-normal.woff2'];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {PRELOAD.map((f) => (
          <link key={f} rel="preload" href={`/fonts/${f}`} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
      </head>
      <body>
        <ToastProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="page">
            {children}
          </main>
          <SiteFooter />
          <BottomBar account={capabilities.signIn ? <AccountItems /> : undefined} />
        </ToastProvider>
        {BEACON_TOKEN ? (
          <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: BEACON_TOKEN })} />
        ) : null}
      </body>
    </html>
  );
}
