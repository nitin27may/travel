/**
 * What this build can offer. Every flag is off until the thing behind it exists; components read the flag, never the reason.
 * API-1 and CONS-1 append their own flags below; do not reorder.
 */
export const capabilities = {
  /**
   * Header Sign in link and the real account path (laundry list items 1 and 36). On only when
   * Managed Better Auth is configured for this deployment (`NEXT_PUBLIC_SIGN_IN=1`, set by the root
   * env wrapper from the presence of `NEON_AUTH_BASE_URL`). Off by default, so public builds and
   * tests keep `/sign-in/` as a noindex notice and never reach `/account/`. A build flag, not a secret.
   */
  signIn: process.env.NEXT_PUBLIC_SIGN_IN === '1',
} as const;

export type Capabilities = { readonly [K in keyof typeof capabilities]: boolean };
