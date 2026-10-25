/**
 * The sign-in method flags (email spec 11.1). Kept out of `lib/capabilities.ts` on purpose: that object is imported by the client
 * header on every page, so a new property there would grow every page's start JS, and the trip and place pages have almost no headroom
 * left (budget.test.ts). These are read only by the sign-in server pages and passed to the lazy card as props.
 *
 * - `signInCode` (Phase 1): "Email me a code" on the card. Needs `signIn` and `NEXT_PUBLIC_SIGN_IN_CODE=1`; off by default until the
 *   owner turns it on (O-E1 order: after this card is live).
 * - `signInLink` (Phase 2, not built): needs `signInCode` too, so a link can never be offered without the code fallback.
 */
export interface AuthFlags {
  signIn: boolean;
  signInCode: boolean;
  signInLink: boolean;
}

export function authFlagsFrom(env: { signIn?: string; code?: string; link?: string }): AuthFlags {
  const signIn = env.signIn === '1';
  const signInCode = signIn && env.code === '1';
  const signInLink = signInCode && env.link === '1';
  return { signIn, signInCode, signInLink };
}

/** Build-time values: written out in full so Next inlines each `NEXT_PUBLIC_` name. */
export const authFlags: AuthFlags = authFlagsFrom({
  signIn: process.env.NEXT_PUBLIC_SIGN_IN,
  code: process.env.NEXT_PUBLIC_SIGN_IN_CODE,
  link: process.env.NEXT_PUBLIC_SIGN_IN_LINK,
});

/** The Turnstile widget key (public by design), or null: no key, no widget (local runs; the guard skips Turnstile only there). */
export const turnstileSiteKey: string | null = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
