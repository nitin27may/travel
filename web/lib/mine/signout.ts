// The sign-out question (edit-my-trip 4.6), loaded only when the `accountTrips` flag is on and a person presses Sign out. Thin on purpose:
// the rules are in sync.ts; this file wires them to the browser's storage and session.
export { clearAccountData, hashOf, sendWaiting, unsentSummary } from './sync';
export type { UnsentSummary } from './sync';
export { mineStorage } from './storage';
