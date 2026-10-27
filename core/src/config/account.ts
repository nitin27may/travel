// The account's saved travellers: the numbers of `travellers/1` that are not the party's own (ACCT-PC;
// docs/v2/features/account-profile-and-travellers.md 5.1, amended 27 Oct 2026). The party's caps (adults 1 to 12, children 0 to 8, a
// child 0 to 17) stay in core/src/trips/party.ts and are imported from there; nothing here copies them. Migration 0012's CHECK
// repeats the 2 KB cap and the adult age range as its second net; change them together.

export const TRAVELLERS = {
  /** The oldest age an entry may hold, now or on the day it was entered. */
  maxAge: 120,
  /** The youngest adult whose age is saved (a child is 0 to CHILD_MAX_AGE). */
  adultMinAge: 18,
  /** Days a date may be after the server's UTC day: a person east of UTC is already on tomorrow (spec 13, time zones). */
  dateSkewDays: 1,
  /** An age entered this many months ago, with no date of birth, asks "Are these ages still right?" (spec 2.4). */
  recheckMonths: 12,
  /** The whole document, as UTF-8 JSON (and as `pg_column_size` in 0012). */
  maxBytes: 2048,
} as const;
