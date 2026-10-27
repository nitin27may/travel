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

/**
 * The AP-15 wording a travellers save is made under (account-profile-and-travellers.md 3, string AP-15; review-em-s S3). The Account
 * page's Save travellers (and the Undo of a removal, shown beside the same wording) passes it through `saveTravellers(..., { consent:
 * true })`; the value itself never comes from a client. Migration 0012 stores it with the consent time and its CHECK holds the
 * allow-list, so a new wording is a new constant here AND a migration that widens the CHECK (core/test/db/profile.test.ts pins both).
 */
export const TRAVELLERS_CONSENT_VERSION = "ap15-2026-10-27";
/** Every wording 0012's CHECK accepts, oldest first. */
export const TRAVELLERS_CONSENT_VERSIONS: readonly string[] = [TRAVELLERS_CONSENT_VERSION];
