// The editable trip document's numbers (edit-my-trip.md 2, 3, 4; Q204, Q-EM12; task EM-C), defined once. Pure and framework-free:
// the document (core/src/schema/plan-draft.ts), the device copies (core/src/schema/copies.ts), the account route shapes
// (core/src/schema/api/account-plans.ts) and the sync helpers (core/src/plan/) read them from here. Changing a limit is a change to
// this file only. The builder's own caps (`PLAN_LIMITS` in plan-draft.ts: picks, bases, the 10-draft builder list until EM-5) stay
// where they are.

/** What one document and one list may hold. */
export const PLAN_DOC_LIMITS = {
  /** copies and plans on one device (Q204 for copies; Q-EM12 extends it to plans in EM-5) */
  devicePlans: 20,
  /** live copies and plans in one account, together (Q204, edit-my-trip 3: the cap trigger counts both) */
  accountPlans: 50,
  /** one document as UTF-8 JSON (R5); the same number as the builder's `PLAN_LIMITS.draftBytes` */
  docBytes: 16 * 1024,
  /** the highest day number a template document names (the copies' day keys run 1 to 99) */
  templateDays: 99,
  /** per-day version choices (copies/1's 60) */
  overrides: 60,
  /** places the person added (copies/1's 30) */
  added: 30,
  /** published stops the person removed */
  removed: 40,
  /** published stops the person moved (R5) */
  moved: 40,
  /** days inserted or dropped (R5) */
  dayOps: 10,
  /** places on the Maybe list */
  maybe: 30,
  /** characters of every note together (R5) */
  noteChars: 2000,
} as const;

/** The sync's numbers (edit-my-trip 4). */
export const PLAN_SYNC = {
  /** a removed draft stays as a tombstone this many days, so an offline device learns of it (4.5) */
  tombstoneDays: 30,
  /** conflict rounds before "Not synced · Retry" (4.4 step 3) */
  rebaseRounds: 3,
  /** refetch period while Mine or a copy is open, seconds (EM7) */
  refetchSeconds: 60,
  /** pending operations one device may hold for all drafts together */
  outboxOps: 500,
  /** writes a minute per user, the `plans:write` quota bucket (4.1) */
  writesPerMinute: 120,
  /** writes an hour per user, the same bucket (review-em-s B2: bounds an outbox loop or a hostile client to a day's churn) */
  writesPerHour: 600,
  /** writes a day per user, the same bucket (B2). A merge takes one per copy it carries (S5) */
  writesPerDay: 3000,
  /** tombstones one account keeps; the delete drops the oldest beyond it (B2). Live rows (at most 50) and these fit one list answer */
  tombstoneCap: 150,
} as const;

/**
 * Edit mode on the trip details page (edit-mode-spec 10, 18; task STEP2-C1). The undo stack lives in the tab's session storage and is
 * never synced; Reset to our plan confirms only past `resetConfirmOver` changes (README ruling R7, a foundation exception).
 */
export const PLAN_EDIT = {
  /** undo steps kept per trip per tab session; the oldest drops when a new step passes it (EA5) */
  undoSteps: 50,
  /** Reset to our plan asks first when it would discard more than this many changes (Q-BE4) */
  resetConfirmOver: 3,
  /**
   * operation ids a built document remembers (`opLog`): a resend of operations already applied (a lost answer) is skipped instead of
   * applied twice. A device rarely holds more unconfirmed changes to one trip than this; about 1 KB of the 16 KB document
   */
  builtOpLog: 64,
} as const;
