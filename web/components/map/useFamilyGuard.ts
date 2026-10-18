'use client';

import { useEffect, useId, useSyncExternalStore } from 'react';
import type { MapFamily } from '@/lib/map/types';

/** Families of the map surfaces currently mounted in this document. */
const active = new Map<string, MapFamily>();
const subs = new Set<() => void>();
let version = 0;
const bump = () => { version += 1; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function mountedFamilies(): MapFamily[] { return [...new Set(active.values())]; }
export function resetFamilyGuard(): void { active.clear(); bump(); }

/** Returns the other families present on the page; non-empty means a mix. */
export function useFamilyGuard(family: MapFamily): MapFamily[] {
  const id = useId();
  useEffect(() => {
    active.set(id, family);
    bump();
    return () => { active.delete(id); bump(); };
  }, [id, family]);
  useSyncExternalStore(subscribe, () => version, () => 0);
  return mountedFamilies().filter((f) => f !== family);
}
