import { GOOGLE_SIGN_IN } from '@travel/core/config/auth-limits.ts';

/**
 * Where the Cloudflare Web Analytics beacon is never served (review GSI-S S7, Google spec 7.1): the account pages, where Neon's
 * verifier lands on the return from Google, and the two pages a sign-in starts from, where a failed exchange sends it back. A
 * third-party script on those pages could read the address bar before the card strips it. Every `/account/*` path counts.
 */
export const NO_BEACON_PATHS: readonly string[] = [GOOGLE_SIGN_IN.landingPath, ...GOOGLE_SIGN_IN.startPaths];

/** Whether the beacon may be served on `pathname` (with or without the trailing slash Next drops from `usePathname`). */
export function beaconAllowed(pathname: string | null | undefined): boolean {
  const raw = (pathname ?? '/').split(/[?#]/)[0] || '/';
  const path = raw.endsWith('/') ? raw : `${raw}/`;
  return !NO_BEACON_PATHS.some((prefix) => path.toLowerCase().startsWith(prefix));
}
