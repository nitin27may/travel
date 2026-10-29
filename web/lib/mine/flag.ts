/**
 * The `accountTrips` flag (edit-my-trip 8, Q-EM3): My trips synced to the account. On only with `NEXT_PUBLIC_ACCOUNT_TRIPS=1` and where
 * sign-in is on (`NEXT_PUBLIC_SIGN_IN=1`), the same rule the routes apply (lib/server/plans.ts `accountTripsOn`). Off by default; off is
 * today's behaviour exactly. It lives here, not in `lib/capabilities.ts`: that object is in every page's start chunk (see the
 * favourites flag), and only Mine's lazy modules read this one. The `NEXT_PUBLIC_` names are written out so a Next build inlines them.
 */
export function accountTripsFlag(env: { signIn?: string; accountTrips?: string } = {
  signIn: process.env.NEXT_PUBLIC_SIGN_IN,
  accountTrips: process.env.NEXT_PUBLIC_ACCOUNT_TRIPS,
}): boolean {
  return env.signIn === '1' && env.accountTrips === '1';
}

export const ACCOUNT_TRIPS_ON: boolean = accountTripsFlag();

/**
 * The `planBuilder` flag as Mine's empty state reads it ("Plan your own trip"). The `NEXT_PUBLIC_` name is written out so a Next build
 * inlines it; off, the empty state says what it always said.
 */
export const PLAN_BUILDER_ON: boolean = process.env.NEXT_PUBLIC_PLAN_BUILDER === '1';
