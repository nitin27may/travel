'use client';

import { useContext, type ReactNode } from 'react';
import { resolveFamily } from '@/lib/map/family';
import type { MapFamily } from '@/lib/map/types';
import { FamilyContext } from './family-context';

/**
 * One per page. Declares the page's map family; any MapSurface under it that resolves to a different family
 * is an error (Google Maps Platform terms 3.2.3(e)). A Google family without a key resolves to maplibre.
 */
export function MapFamilyProvider({ family, children }: { family: MapFamily; children: ReactNode }) {
  return <FamilyContext.Provider value={resolveFamily(family)}>{children}</FamilyContext.Provider>;
}

export const usePageFamily = (): MapFamily | null => useContext(FamilyContext);
