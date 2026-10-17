'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// `app` links are routes of this app (client-side navigation); the globe is still a separate static page.
const LINKS = [
  { href: '/trips/', label: 'Trips', app: true },
  { href: '/places/', label: 'Places', app: true },
  { href: '/globe/', label: 'Globe', app: false },
  { href: '/about/data/', label: 'About the data', app: true },
];

function Wrapper({ href, app, current, children }: { href: string; app: boolean; current: boolean; children: ReactNode }) {
  const aria = current ? ('page' as const) : undefined;
  return app ? (
    <Link href={href} aria-current={aria}>
      {children}
    </Link>
  ) : (
    <a href={href} aria-current={aria}>
      {children}
    </a>
  );
}

export function SiteNav() {
  const path = usePathname() ?? '/';
  return (
    <nav className="site-nav" aria-label="Main">
      {LINKS.map((l) => (
        <Wrapper key={l.href} href={l.href} app={l.app} current={path === l.href || path.startsWith(l.href)}>
          {l.label}
        </Wrapper>
      ))}
    </nav>
  );
}
