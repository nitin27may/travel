// "Flying from" remembers the last choice on this device (RB-019, FLOW TF4: pre-filled, then Change). One typed reference and its name under
// the builder's own key; nothing else, never sent anywhere. A signed-in account could seed it later (no home airport is stored there yet).
import type { PlanOrigin } from '@travel/core/schema/plan-draft.ts';
import { readLocal, writeLocal } from '@/lib/storage/safe';
import { PLANS_FROM_KEY } from './keys';

export interface LastFrom {
  origin: PlanOrigin;
  name: string;
}

export function readLastFrom(): LastFrom | null {
  const raw = readLocal(PLANS_FROM_KEY);
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { o, n } = v as { o?: unknown; n?: unknown };
    if (typeof n !== 'string' || n.length === 0 || n.length > 120 || typeof o !== 'string') return null;
    const air = /^iata:([A-Z]{3})$/.exec(o);
    if (air) return { origin: { kind: 'airport', iata: air[1]! }, name: n };
    const hub = /^hub:([a-z0-9][a-z0-9-]{0,59})$/.exec(o);
    if (hub) return { origin: { kind: 'hub', id: hub[1]! }, name: n };
    return null;
  } catch {
    return null;
  }
}

export function writeLastFrom(origin: PlanOrigin, name: string): boolean {
  const o = origin.kind === 'airport' ? `iata:${origin.iata}` : origin.kind === 'hub' ? `hub:${origin.id}` : null;
  return o === null ? false : writeLocal(PLANS_FROM_KEY, JSON.stringify({ v: 1, o, n: name.slice(0, 120) }));
}
