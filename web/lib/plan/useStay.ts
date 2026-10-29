'use client';

// "Stay here" on a picked town (RB-022, FLOW TF6, R5): the town becomes a base. The base is a towns-layer id, so the first press asks the
// public towns read for the town at the pick (one small read through the data boundary, P9; nothing of the person's goes with it).
import { useCallback, useState, type Dispatch } from 'react';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import type { FlowAction, FlowState } from './flow';

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export type StayState = { busy: string | null; failed: string | null };

export function useStay(flow: FlowState, dispatch: Dispatch<FlowAction>, now: () => string) {
  const [state, setState] = useState<StayState>({ busy: null, failed: null });
  const isOn = useCallback((ref: string): boolean => {
    const town = flow.stay?.[ref];
    return !!town && flow.bases.some((b) => b.town === town);
  }, [flow.stay, flow.bases]);
  const toggle = useCallback(
    async (pick: { ref: string; slug: string; name: string }) => {
      if (isOn(pick.ref)) {
        dispatch({ t: 'unstay', ref: pick.ref, now: now() });
        return;
      }
      setState({ busy: pick.ref, failed: null });
      try {
        const { townsAround } = await import('@/lib/client/data');
        const near = (await townsAround({ place: pick.slug, r: PLAN_BUILDER_UI.stayTownKm })) ?? [];
        const want = norm(pick.name);
        const town = near.find((t) => norm(t.name) === want) ?? [...near].sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))[0];
        if (!town) {
          setState({ busy: null, failed: pick.ref });
          return;
        }
        dispatch({ t: 'stay', ref: pick.ref, town: town.id, info: { name: town.name, lat: town.lat, lon: town.lon }, now: now() });
        setState({ busy: null, failed: null });
      } catch {
        setState({ busy: null, failed: pick.ref });
      }
    },
    [dispatch, isOn, now],
  );
  return { isOn, toggle, busy: state.busy, failed: state.failed };
}
