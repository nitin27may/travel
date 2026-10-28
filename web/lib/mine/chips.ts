/**
 * The row chips of signed-in Mine (edit-my-trip 4.7), in the foundation's words: "saved" is never used for a copy (patterns 3.7). The
 * state names equal core's `PLAN_ROW_STATES` (pinned by tests/mine/sync-chips.test.ts); they are repeated here because this file is
 * imported by the rows, which the builder's fence keeps from importing the plan module.
 */
export type RowChip = 'quiet' | 'syncing' | 'offline' | 'retry' | 'device';

/** The chip's words; null: no chip (the quiet default says "in your account" through the card line and the row's name). */
export const CHIP_WORDS: Record<RowChip, string | null> = {
  quiet: null,
  syncing: 'Syncing',
  offline: 'Not synced yet',
  retry: 'Not synced · Retry',
  device: 'On this device',
};

/** What a screen reader hears after the row's name. */
export const CHIP_NAME: Record<RowChip, string> = {
  quiet: ', in your account',
  syncing: ', syncing',
  offline: ', not synced yet, will sync when online',
  retry: ', not synced',
  device: ', on this device only',
};

/** A row's chip as the row draws it. */
export interface RowSync {
  state: RowChip;
  /**
   * Every row is in this state and the account card's line says it (patterns 3.7 rule 4; review ACCT-PR SF10): no chip is drawn; the
   * link's name still carries the state.
   */
  bare?: boolean;
  /** Retry, for the `retry` state */
  onRetry?: () => void;
}

/** States the card line speaks for when every row shares them: the account is out of reach, so everything waits on this device. */
export const CARD_SAYS: ReadonlySet<RowChip> = new Set<RowChip>(['device', 'offline']);

/** True when no row needs its own chip: one state for every row, and the card line says it (SF10). Retry is an action, never bare. */
export function chipsBare(states: readonly RowChip[]): boolean {
  if (states.length === 0) return false;
  const first = states[0]!;
  return CARD_SAYS.has(first) && states.every((s) => s === first);
}

/** The polite sentence for a row that has just become "Not synced" (review ACCT-PR SF11; WCAG 4.1.3). */
export const retryAnnouncement = (title: string): string => `${title}: not synced. Retry is next to it.`;
