/**
 * The `planBuilder` flag (TB-W1): `/plan/` and its entry links exist only with `NEXT_PUBLIC_PLAN_BUILDER=1` and `NEXT_PUBLIC_TRIP_EDIT=1`
 * (the builder hands every trip to the details page, which is `tripEdit`; the API routes apply the same rule, `planBuilderOn`).
 * next.config.ts writes both names with a default, so each comparison is a build-time constant: off, the code behind it is dropped.
 */
export const PLAN_BUILDER_ON: boolean = process.env.NEXT_PUBLIC_PLAN_BUILDER === '1' && process.env.NEXT_PUBLIC_TRIP_EDIT === '1';
