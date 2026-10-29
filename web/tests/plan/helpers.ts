import { vi } from 'vitest';
import type { PlanOutputs } from '@travel/core/schema/plan-draft.ts';
import { newFlow, type FlowState } from '@/lib/plan/flow';

export const ID = '6f1c0a52-8d0e-4b7e-9a51-2c3d4e5f6a7b';
export const T0 = '2026-10-28T10:00:00.000Z';

/** A browser's storage and window events in memory, for code that goes through lib/storage/safe.ts. */
export function fakeWindow(): { store: Map<string, string>; events: string[] } {
  const store = new Map<string, string>();
  const events: string[] = [];
  vi.stubGlobal('window', {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    dispatchEvent: (e: Event) => void events.push(e.type),
  });
  return { store, events };
}

export const pick = (n: number, must = false) => ({ ref: `place/p${n}`, slug: `p${n}`, name: `Place ${n}`, must });

/** A flow past stage 2 in near mode, with picks. */
export function nearFlow(over: Partial<FlowState> = {}): FlowState {
  return { ...newFlow(ID, T0), kind: 'weekend', stage: 3, start: { kind: 'hub', id: 'calgary' }, startName: 'Calgary', nights: 2, driveLimitMin: 180, month: 7, picks: [pick(1), pick(2, true)], visit: { 'place/p1': 120, 'place/p2': null }, ...over };
}

/** A flow in trip mode. */
export function tripFlow(over: Partial<FlowState> = {}): FlowState {
  return { ...newFlow(ID, T0), kind: 'week_air', stage: 4, cc: 'IT', ccName: 'Italy', regions: ['IT/veneto'], nights: 7, month: 7, picks: [pick(1), pick(2)], origin: { kind: 'airport', iata: 'YYZ' }, ...over };
}

export const outputs: PlanOutputs = { engine: 'tb-e1.1', basis: 'estimate', bases: [], days: [], didNotFit: [], spareDays: 0, builtAt: '2026-10-28T10:05:00.000Z' };
