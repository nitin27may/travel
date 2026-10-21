/**
 * What this build can offer. Every flag is off until the thing behind it exists; components read the flag, never the reason.
 * API-1 and CONS-1 append their own flags below; do not reorder.
 */
export const capabilities = {
  /** Header Sign in link (laundry list items 1 and 36). On when a server sign-in exists; `/sign-in/` stays as a noindex notice for old links. */
  signIn: false,
} as const;

export type Capabilities = { readonly [K in keyof typeof capabilities]: boolean };
