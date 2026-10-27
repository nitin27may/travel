'use client';

import { usePathname } from 'next/navigation';
import { beaconAllowed } from '@/lib/beacon';

/**
 * The Cloudflare Web Analytics beacon, left out of the account and sign-in pages (lib/beacon.ts, review GSI-S S7). Rendered on the
 * server too, so those pages' HTML never carries it. `async` makes it a React resource: it also loads when a visitor who started on
 * a page without it moves on inside the app, and it is never loaded twice.
 */
export function Beacon() {
  const pathname = usePathname();
  // Read here, not passed from the layout, so the excluded pages' HTML does not carry the token in the component's props either.
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token || !beaconAllowed(pathname)) return null;
  return <script async src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token })} />;
}
