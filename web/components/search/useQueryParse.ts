'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { onSearchGrow, parseQuery } from '@/lib/client/data';
import { pickAlternative, withoutChips } from '@/lib/search/parse/pick';
import type { Chip, ParsedQuery } from '@/lib/search/parse/types';

/** Keystroke to chips: the debounce of smart-search 6.1. */
export const PARSE_DELAY_MS = 150;

export interface QueryParse {
  /** The reading with the visitor's removals and picks applied; null while nothing has been read, or when the parser failed. */
  parsed: ParsedQuery | null;
  /** The reading the parser gave, before any removal (the count of chips removed is the difference). */
  removed: number;
  remove: (id: string) => void;
  pick: (id: string, alt: Chip) => void;
  /** Put every removed chip and every pick back. */
  reset: () => void;
  /** Read the query now, without waiting for the debounce (Enter). */
  readNow: () => Promise<ParsedQuery | null>;
}

interface Options {
  /** Force a list (the Places and Trips search boxes); the header lets the words decide (A11). */
  target?: 'places' | 'trips';
  enabled?: boolean;
}

/**
 * Reads the text in a search box as filters (backlog 3.43), 150 ms after the last keystroke. A removed chip stays removed while the
 * visitor keeps typing: its words stay used, so the parse does not bring it back (acceptance 4). Emptying the box starts again.
 */
export function useQueryParse(text: string, { target, enabled = true }: Options = {}): QueryParse {
  const [dropped, setDropped] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<string, { from: string; alt: Chip }>>({});
  const [read, setRead] = useState<{ text: string; key: string; parsed: ParsedQuery | null } | null>(null);
  const [tick, setTick] = useState(0);
  const key = `${target ?? ''}|${dropped.join(',')}`;

  // more search parts landed: a place name may now be known
  useEffect(() => (enabled ? onSearchGrow(() => setTick((t) => t + 1)) : undefined), [enabled]);

  // an emptied box starts again (set during render, the pattern React asks for instead of an effect)
  if (!text.trim() && (dropped.length || Object.keys(picks).length)) {
    setDropped([]);
    setPicks({});
  }

  useEffect(() => {
    if (!enabled || !text.trim()) return;
    let live = true;
    const t = setTimeout(() => {
      parseQuery(text, { target, dropped }).then(
        (parsed) => live && setRead({ text, key, parsed }),
        () => live && setRead({ text, key, parsed: null }),
      );
    }, PARSE_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // `dropped` is part of `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, text, target, key, tick]);

  // the last reading stays on screen while the next one is pending, so the row does not blink on every keystroke
  const parsed = useMemo(() => {
    if (!enabled || !text.trim() || !read?.parsed) return null;
    let out = withoutChips(read.parsed, dropped);
    // a pick applies only while the chip it replaced still reads the same
    for (const c of read.parsed.chips) {
      const p = picks[c.id];
      if (p && p.from === c.label) out = pickAlternative(out, c.id, p.alt);
    }
    return out;
  }, [enabled, text, read, dropped, picks]);

  const remove = useCallback((id: string) => setDropped((d) => (d.includes(id) ? d : [...d, id])), []);
  const pick = useCallback(
    (id: string, alt: Chip) => {
      const from = read?.parsed?.chips.find((c) => c.id === id)?.label;
      if (from !== undefined) setPicks((p) => ({ ...p, [id]: { from, alt } }));
    },
    [read],
  );
  const reset = useCallback(() => {
    setDropped([]);
    setPicks({});
  }, []);
  const readNow = useCallback(async () => {
    if (!text.trim()) return null;
    try {
      let out = await parseQuery(text, { target, dropped });
      for (const c of out.chips) {
        const p = picks[c.id];
        if (p && p.from === c.label) out = pickAlternative(out, c.id, p.alt);
      }
      return out;
    } catch {
      return null;
    }
  }, [text, target, dropped, picks]);

  return { parsed, removed: dropped.length, remove, pick, reset, readNow };
}
