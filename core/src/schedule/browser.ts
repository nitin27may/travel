// What the trip page ships to the browser (spec D2): the scheduler, variant selection and the URL codec. The planner
// mapping (toItems) and the suitability helpers stay out of the page bundle; the size test measures this entry.
export { DEFAULT_PROFILE } from "./types.ts";
export type * from "./types.ts";
export { scheduleDay, scheduleTrip, addItem, adultsOf } from "./schedule.ts";
export { selectVariant, variantFits } from "./select.ts";
export type { Selection } from "./select.ts";
export { fmtHM } from "./rules.ts";
export { parseTimelineUrl, serialiseTimelineUrl, isChanged, PROFILE_KEYS } from "./profileCodec.ts";
export type { TimelineUrlState } from "./profileCodec.ts";
