// The two device keys of the trip page (trip-and-places-ux-fixes.md 10.2; Q294, Q295): the party and the page's UI state. Both go
// through safe.ts, so a browser that blocks site data gets the defaults every time, silently. Hand-written guards instead of Zod:
// the trip page reads these in its start chunk (about 460 B of headroom), and Zod must stay out of it.
//
// travel.party  { v: 1, adults: 1..12, children: (0..17 | null)[] max 8 }   household data: never in a URL, the export, the share
//               text, analytics or a feedback report (spec 15). A child whose age is not set yet is null and plans as 10 (FAMAGE10).
// travel.tripui { v: 1, partyOpen, trips: { [slug]: { tab, daysView, shapeOpen, rows, asWritten } } }   UI state only, never
//               sensitive; at most 30 trips, the least recently written dropped first.
export { PARTY_CHANGED_EVENT, PARTY_KEY, clearParty, readParty, writeParty } from './partyKey';
export * from './tripUi';
