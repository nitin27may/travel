import type { Dispatch } from 'react';
import type { Party } from '@travel/core/trips/party.ts';
import type { FlowAction, FlowState } from '@/lib/plan/flow';

/**
 * What every stage component receives (FLOW 4). The stages are written so the details page's Settings sheets can mount them later
 * (extension point X10): they read the state and dispatch actions, and own no navigation, storage or chrome.
 */
export interface StageProps {
  flow: FlowState;
  dispatch: Dispatch<FlowAction>;
  party: Party;
  /** the time of an action, as an ISO string (a test passes a fixed one) */
  now: () => string;
}
