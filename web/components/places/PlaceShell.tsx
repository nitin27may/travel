'use client';

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { LngLat, MapHandle } from '@/lib/map/types';

interface Ctx {
  /** The map registers its handle here; the elevation profile moves the amber cursor through it. */
  setHandle: (h: MapHandle | null) => void;
  setCursor: (p: LngLat | null) => void;
}

const PlaceCtx = createContext<Ctx | null>(null);

/** Joins the profile (left column) and the map (right column) without lifting state through the server page. */
export function PlaceShell({ children }: { children: ReactNode }) {
  const handle = useRef<MapHandle | null>(null);
  const setHandle = useCallback((h: MapHandle | null) => {
    handle.current = h;
  }, []);
  const setCursor = useCallback((p: LngLat | null) => handle.current?.setCursor(p), []);
  const value = useMemo(() => ({ setHandle, setCursor }), [setHandle, setCursor]);
  return <PlaceCtx.Provider value={value}>{children}</PlaceCtx.Provider>;
}

export function usePlaceShell(): Ctx {
  return useContext(PlaceCtx) ?? { setHandle: () => undefined, setCursor: () => undefined };
}
