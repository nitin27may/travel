'use client';

// Candidate rows for a query, one page at a time (P1, P8): the first page of 40, then "Show more". The data comes through the one boundary
// (lib/client/data.ts), loaded when the first stage that needs it opens so the start chunk does not carry it.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanCandidatePage, PlanCandidateRow, PlanCandidatesQuery } from '@travel/core/schema/api/plan.ts';

export type CandidateState =
  | { status: 'idle' }
  | { status: 'loading'; rows: PlanCandidateRow[] }
  /** `null` answer: this site has no builder endpoint (flag off, static files) */
  | { status: 'unavailable' }
  | { status: 'error'; code: string; rows: PlanCandidateRow[] }
  | { status: 'ok'; rows: PlanCandidateRow[]; total: number; removed: PlanCandidatePage['removed']; more: boolean; loadingMore: boolean };

const keyOf = (q: PlanCandidatesQuery | null): string => (q ? JSON.stringify(q) : '');
type Result = { total: number | null; status: 'idle' | 'loading' | 'ok' | 'unavailable' | 'error'; code: string | null };

export function useCandidates(query: PlanCandidatesQuery | null): { state: CandidateState; more: () => void; retry: () => void } {
  const [state, setState] = useState<CandidateState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const key = keyOf(query);
  const live = useRef<{ ac: AbortController; query: PlanCandidatesQuery; rows: PlanCandidateRow[]; page: number } | null>(null);

  const run = useCallback(async (q: PlanCandidatesQuery, page: number, ac: AbortController, prior: PlanCandidateRow[]) => {
    try {
      const data = await import('@/lib/client/data');
      const a = await data.planCandidates({ ...q, page }, ac.signal);
      if (ac.signal.aborted) return;
      if (a === null) {
        setState({ status: 'unavailable' });
        return;
      }
      const rows = page === 1 ? a.items : [...prior, ...a.items];
      if (live.current?.ac === ac) {
        live.current.rows = rows;
        live.current.page = page;
      }
      setState({ status: 'ok', rows, total: a.total, removed: a.removed, more: a.nextPage !== null, loadingMore: false });
    } catch (e) {
      if (ac.signal.aborted) return;
      setState({ status: 'error', code: (e as { code?: string }).code ?? 'internal', rows: prior });
    }
  }, []);

  useEffect(() => {
    live.current?.ac.abort();
    if (!query) {
      live.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no query: nothing is shown
      setState({ status: 'idle' });
      return;
    }
    const ac = new AbortController();
    live.current = { ac, query, rows: [], page: 1 };
    setState({ status: 'loading', rows: [] });
    void run(query, 1, ac, []);
    return () => ac.abort();
    // the query is keyed by its JSON
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, run]);

  const more = useCallback(() => {
    const l = live.current;
    if (!l) return;
    setState((s) => (s.status === 'ok' ? { ...s, loadingMore: true } : s));
    void run(l.query, l.page + 1, l.ac, l.rows);
  }, [run]);

  return { state, more, retry: () => setAttempt((n) => n + 1) };
}

/** One count: how many places a query lists (page size 1). */
export function useCount(query: PlanCandidatesQuery | null): Result {
  const key = keyOf(query);
  const [r, setR] = useState<Result>({ total: null, status: 'idle', code: null });
  useEffect(() => {
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no query: no count
      setR({ total: null, status: 'idle', code: null });
      return;
    }
    const ac = new AbortController();
    setR((x) => ({ ...x, status: 'loading' }));
    void (async () => {
      try {
        const data = await import('@/lib/client/data');
        const a = await data.planCandidates({ ...query, pageSize: 1, page: 1 }, ac.signal);
        if (ac.signal.aborted) return;
        setR(a === null ? { total: null, status: 'unavailable', code: null } : { total: a.total, status: 'ok', code: null });
      } catch (e) {
        if (!ac.signal.aborted) setR({ total: null, status: 'error', code: (e as { code?: string }).code ?? 'internal' });
      }
    })();
    return () => ac.abort();
    // the query is keyed by its JSON
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return r;
}
