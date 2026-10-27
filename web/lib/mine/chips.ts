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
  /** Retry, for the `retry` state */
  onRetry?: () => void;
}
