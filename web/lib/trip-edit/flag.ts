/**
 * The `tripEdit` flag (STEP2-T1): on only with `NEXT_PUBLIC_TRIP_EDIT=1`. Off, `/t/<id>/` answers notFound() and Mine's Open keeps the
 * `/trips/<slug>/` link, so today's site is unchanged. It lives here, not in `lib/capabilities.ts`: that object is in every page's start
 * chunk. The `NEXT_PUBLIC_` name is written out so a Next build inlines it and the public pages drop the code behind the flag.
 */
export function tripEditFlag(env: { tripEdit?: string } = { tripEdit: process.env.NEXT_PUBLIC_TRIP_EDIT }): boolean {
  return env.tripEdit === '1';
}

/** A literal comparison on the inlined name, so a build with the flag off folds it to `false` and drops what sits behind it. */
export const TRIP_EDIT_ON: boolean = process.env.NEXT_PUBLIC_TRIP_EDIT === '1';
