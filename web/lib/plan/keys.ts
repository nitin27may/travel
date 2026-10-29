/**
 * The builder's device storage keys, named once (trip-builder ISO-3: every key starts `travel.plans.`). STEP2-P2 creates this file as
 * the builder's X-point so Mine can read the drafts a person keeps on this device without owning the key's name.
 */
/** The device list of plans: `plan-drafts/1` (builder drafts, built or not yet built). */
export const PLANS_KEY = 'travel.plans.local';
/** Builder UI state (step, panes). Not data; Mine never reads it. */
export const PLANS_UI_KEY = 'travel.plans.ui';

/** A draft's address in the builder, on the stage that finishes it (FLOW TF13, TF14). */
export const draftHref = (id: string, stage = 4): string => `/plan/?draft=${id}&s=${stage}`;
