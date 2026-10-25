'use client';

import { ButtonLink } from '@/components/ui/Button';

/**
 * The signed-out right cluster of the public header: just the ghost `Sign in` link. Kept tiny and
 * free of Base UI and the auth client so it can be the static SSR placeholder for the dynamically
 * loaded `AccountNav` (review I2 / shell bundle repair) — the account menu and its popover library
 * only load after hydration when a session actually exists.
 */
export function SignInLink() {
  return (
    <ButtonLink variant="ghost" href="/sign-in/" className="header-signin">
      Sign in
    </ButtonLink>
  );
}
