'use client';

// The picker's data hooks (STEP2-E3): the scheduler once, the places round a point, the search page, and the rows of a few slugs. Each
// read is one page at a time (P8) and is dropped when the picker closes or the words change.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Point, Profile } from '@travel/core/schedule/types.ts';
import type { TimelineModel } from '@/components/trips/timeline/model';
import type { TemplateEngine } from '@/components/trips/timeline/useTimeline';
import type { PlanDraft } from '@/lib/trip-edit/model';
import { deltaOfDraft } from '@/lib/trip-edit/source';
import { makeFitter, type Fitter } from './fit';
import type { Found } from './place';
import { apiAvailable, nearPage, rowsOf, searchPage, type Page } from './source';

/** The template scheduler (its own chunk, loaded with the picker), then the copy's days as they stand. Null while it loads. */
export function useFitter(doc: PlanDraft, model: TimelineModel, profile: Profile): Fitter | null {
  const [engine, setEngine] = useState<TemplateEngine | null>(null);
  useEffect(() => {
    let live = true;
    void import('@travel/core/schedule/template.ts').then((m) => live && setEngine(m));
    return () => {
      live = false;
    };
  }, []);
  return useMemo(() => {
    if (!engine) return null;
    try {
      return makeFitter({ engine, days: model.days, delta: deltaOfDraft(doc), overrides: doc.template?.overrides ?? {}, profile, candidates: model.addables, model });
    } catch {
      return null;
    }
  }, [engine, doc, model, profile]);
}

/** The model with the days the page shows (an inserted or dropped day changes the numbers); the published model when there are no day edits. */
export function useDayView(model: TimelineModel, fitter: Fitter | null): TimelineModel {
  return useMemo(() => (fitter?.eff ? { ...model, days: fitter.eff.days } : model), [model, fitter]);
}

export interface Paged {
  rows: Found[];
  next: number | null;
  /** `loading` until the first page answers; `off` when the build has no API or the read failed */
  status: 'loading' | 'ok' | 'off';
  /** true while a later page is on its way */
  busy: boolean;
  more: () => void;
}

/** Pages of rows from one read (`first` makes page 1, `later` the others). The key restarts it; a null key asks for nothing and reports `idle`. */
function usePaged(key: string | null, ask: (page: number, signal: AbortSignal) => Promise<Page | null>, idle: Paged['status'] = 'ok'): Paged {
  const [state, setState] = useState<{ key: string | null; rows: Found[]; next: number | null; status: Paged['status']; busy: boolean }>({ key: null, rows: [], next: null, status: 'loading', busy: false });
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    abort.current?.abort();
    if (key === null) return;
    const c = new AbortController();
    abort.current = c;
    void askRef.current(1, c.signal).then((p) => {
      if (c.signal.aborted) return;
      setState({ key, rows: p?.rows ?? [], next: p?.next ?? null, status: p ? 'ok' : 'off', busy: false });
    });
    return () => c.abort();
  }, [key]);
  const more = useCallback(() => {
    const c = abort.current;
    if (!c || state.next === null || state.busy || state.key !== key) return;
    const page = state.next;
    setState((s) => ({ ...s, busy: true }));
    void askRef.current(page, c.signal).then((p) => {
      if (c.signal.aborted) return;
      setState((s) => ({ ...s, rows: p ? [...s.rows, ...p.rows.filter((r) => !s.rows.some((x) => x.slug === r.slug))] : s.rows, next: p?.next ?? null, busy: false }));
    });
  }, [state, key]);
  const live = state.key === key && key !== null;
  return { rows: live ? state.rows : [], next: live ? state.next : null, status: key === null ? idle : live ? state.status : 'loading', busy: state.busy, more };
}

/** The places round a point, nearest first within each page. With no API or no point it is `off` (not `ok` and empty), so the picker falls back to the plan model's own candidates. */
export const useNearRows = (centre: Point | null, k?: number): Paged => usePaged(centre && apiAvailable() ? `${centre.lat},${centre.lon},${k ?? ''}` : null, (page, signal) => (centre ? nearPage(centre, page, signal, k) : Promise.resolve(null)), 'off');
/** The catalogue's matches for the words (nothing for fewer than two letters). */
export const useSearchRows = (q: string): Paged => {
  const words = q.trim();
  return usePaged(words.length >= 2 && apiAvailable() ? words : null, (page, signal) => searchPage(words, page, signal));
};

/** The rows of these slugs, read once. Null while on its way or when the read failed. */
export function useRowsOf(slugs: readonly string[]): Found[] | null {
  const key = slugs.join(',');
  const [got, setGot] = useState<{ key: string; rows: Found[] | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    const c = new AbortController();
    void rowsOf(key.split(','), c.signal).then((rows) => !c.signal.aborted && setGot({ key, rows }));
    return () => c.abort();
  }, [key]);
  return key && got?.key === key ? got.rows : null;
}

/** The search words, after the person stops typing. */
export function useDebounced(value: string, ms: number): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}
