'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';
import { useMediaQuery } from '@/components/entity/useMediaQuery';
import { countList } from '@/lib/client/data';
import type { EntityDescriptor, ListState } from '@/lib/entities/types';
import type { Applied } from '@/lib/search/applied';
import { stillApplies, undoState } from '@/lib/search/applied';
import { pickAlternative, withoutChips } from '@/lib/search/parse/pick';
import type { Chip, ParsedQuery } from '@/lib/search/parse/types';
import { QueryChips } from './QueryChips';
import { useQueryParse } from './useQueryParse';
import '@/styles/search.css';

export interface SmartRowProps<Row> {
  d: EntityDescriptor<Row>;
  state: ListState;
  onState: (s: ListState, mode?: 'push' | 'replace') => void;
  searchRef: RefObject<HTMLInputElement | null>;
  applied: Applied | null;
  onApplied: (a: Applied | null) => void;
  /** The reading shown as a preview, or null: the page holds its list while one shows (it does not filter by the sentence). */
  onReading: (p: ParsedQuery | null) => void;
  /** Under 640 px the reading is drawn here, below the sticky bar, so the bar does not grow (T2). */
  slot: HTMLElement | null;
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const filtersOf = (p: ParsedQuery) => p.chips.filter((c) => Object.keys(c.set).length > 0).length;

/**
 * The Places and Trips search box reads the same way the header does (Q39). While the visitor types two or more words, the chips show
 * how they are read; Enter writes them into the list's own filters (existing URL keys only), and a one-line note offers the way back
 * to plain text. Backspace at the start of the box removes the last chip, Esc undoes an applied reading.
 */
export function SmartRow<Row>({ d, state, onState, searchRef, applied, onApplied, onReading, slot }: SmartRowProps<Row>) {
  const phone = useMediaQuery('(max-width: 639px)');
  const [ask, setAsk] = useState({ id: 'kid', n: 0 });
  const target = d.type === 'trip' ? 'trips' : 'places';
  const live = applied && stillApplies(state, applied) ? applied : null;
  const draft = state.q;
  const smart = useQueryParse(draft, { target, enabled: !live && wordCount(draft) >= 2 });
  const preview = !live && smart.parsed && smart.parsed.target !== 'search' && smart.parsed.chips.length > 0 ? smart.parsed : null;

  useEffect(() => onReading(preview), [preview, onReading]);
  useEffect(() => () => onReading(null), [onReading]);
  // what Enter would open: the reading merged into the filters already set
  const count = useMemo(
    () => (preview ? countList(d.type, { ...state, q: preview.q, facets: { ...state.facets, ...preview.facets } }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview, d.type],
  );

  // a reading the visitor has since changed by hand is no longer theirs to undo
  useEffect(() => {
    if (applied && !live) onApplied(null);
  }, [applied, live, onApplied]);

  const apply = (p: ParsedQuery, text: string) => {
    onApplied({ parsed: p, text, before: state });
    onState({ ...state, q: p.q, facets: { ...state.facets, ...p.facets }, focus: null }, 'push');
    smart.reset();
  };
  const undo = () => {
    if (!live) return;
    onState(undoState(live), 'push');
    onApplied(null);
    smart.reset();
    searchRef.current?.focus();
  };

  // keys on the box itself, before the shared search field sees them (it clears on Esc)
  const latest = useRef({ preview, live, state, apply, undo, smart });
  useEffect(() => {
    latest.current = { preview, live, state, apply, undo, smart };
  });
  useEffect(() => {
    const input = searchRef.current;
    if (!input) return;
    const onKey = (e: KeyboardEvent) => {
      const cur = latest.current;
      if (e.isComposing) return;
      if (e.key === 'Escape' && cur.live) {
        e.preventDefault();
        e.stopPropagation();
        cur.undo();
      } else if (e.key === 'Backspace' && cur.preview && input.selectionStart === 0 && input.selectionEnd === 0) {
        e.preventDefault();
        e.stopPropagation();
        cur.smart.remove(cur.preview.chips[cur.preview.chips.length - 1]!.id);
      } else if (e.key === 'Enter') {
        const text = input.value;
        if (wordCount(text) < 1) return;
        e.preventDefault();
        e.stopPropagation();
        void cur.smart.readNow().then((p) => {
          if (!p || p.target === 'search' || latest.current.state.q !== text) return;
          if (filtersOf(p) > 0) latest.current.apply(p, text);
          // only a question ("with kids": how old?): ask it, never guess an age and never fall back to a text search with no rows
          else if (p.chips.some((c) => c.ask)) setAsk((a) => ({ id: p.chips.find((c) => c.ask)!.id, n: a.n + 1 }));
        });
      }
    };
    input.addEventListener('keydown', onKey);
    return () => input.removeEventListener('keydown', onKey);
  }, [searchRef]);

  const open = Boolean(preview || live);

  const build = (preview: ParsedQuery | null, live: Applied | null): ReactNode => {
    if (preview) {
      return (
        <div className="smart-box">
          <QueryChips parsed={preview} onRemove={smart.remove} onPick={smart.pick} onEmpty={() => searchRef.current?.focus()} openRequest={ask} />
          <p className="smart-hint">
            {preview.chips.some((c) => c.ask) && filtersOf(preview) === 0 ? (
              <>Pick an age, or press <kbd>Enter</kbd> to choose one.</>
            ) : (
              <>
                <kbd>Enter</kbd> shows {count ? `${count.n} ${count.n === 1 ? d.noun.one : d.noun.many}${count.unchecked ? ` \u00b7 ${count.unchecked} not checked yet` : ''}` : 'this reading in the list'}. <kbd>Esc</kbd> clears the box.
              </>
            )}
          </p>
        </div>
      );
    }
    if (live) {
      const n = filtersOf(live.parsed);
      const askOpen = live.parsed.chips.some((c) => c.ask);
      const setParsed = (parsed: ParsedQuery, facets: ListState['facets']) => {
        onApplied({ ...live, parsed });
        onState({ ...state, facets, focus: null }, 'push');
      };
      return (
        <div className="smart-box">
          <div className="smart-undo" role="status">
            {phone ? (
              <>
                <span>Read as {n} {n === 1 ? 'filter' : 'filters'}</span>
                <button type="button" onClick={undo} aria-label={`Search the words instead: ${live.text}`}>Undo</button>
              </>
            ) : (
              <>
                <span>
                  Read &ldquo;{live.text}&rdquo; as {n} {n === 1 ? 'filter' : 'filters'}
                  {live.parsed.notYet.length ? <> &middot; &ldquo;{live.parsed.notYet.join(', ')}&rdquo; has no filter yet</> : null}
                </span>
                <button type="button" onClick={undo}>Search the words instead</button>
              </>
            )}
          </div>
          {askOpen ? (
            <QueryChips
              parsed={live.parsed}
              onlyAsk
              hideWords
              label="Needs an answer"
              onRemove={(id) => setParsed(withoutChips(live.parsed, [id]), state.facets)}
              onPick={(id: string, alt: Chip) => setParsed(pickAlternative(live.parsed, id, alt), { ...state.facets, ...alt.set })}
            />
          ) : null}
        </div>
      );
    }
    return null;
  };

  // keep the last reading while the row folds away, so it closes smoothly instead of vanishing (set during render, not in an effect)
  const [held, setHeld] = useState<{ preview: ParsedQuery | null; live: Applied | null } | null>(null);
  if (open && (held?.preview !== preview || held?.live !== live)) setHeld({ preview, live });
  const shown = open ? { preview, live } : held;

  const row = (
    <div className="smart-row" data-open={open || undefined}>
      <div inert={!open}>{shown ? build(shown.preview, shown.live) : null}</div>
    </div>
  );
  return phone && slot ? createPortal(row, slot) : row;
}
export default SmartRow;
