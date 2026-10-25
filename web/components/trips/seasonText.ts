/** Wording for a trip's season on cards, the map card and the strip. Kept out of format.ts so the trip page's start bundle does not carry it. */

/** The suffix the suitability chips use for a figure that is only the plan's own ("From about 6 · our plan"). */
export const PLAN_SUFFIX = ' · our plan';
export const PLAN_WINDOW_TITLE = 'The window this plan was written for, not checked against other months';
/** A season as one line: "Mid-February · our plan" when the window is only the plan's own. */
export const seasonText = (label: string, basis: 'plan' | 'researched' | null): string => (basis === 'plan' ? `${label}${PLAN_SUFFIX}` : label);
