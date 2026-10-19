'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
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
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const filtersOf = (p: ParsedQuery) => p.chips.filter((c) => Object.keys(c.set).length > 0).length;

/**
 * The Places and Trips search box reads the same way the header does (Q39). While the visitor types two or more words, the chips show
 * how they are read; Enter writes them into the list's own filters (existing URL keys only), and a one-line note offers the way back
 * to plain text. Backspace at the start of the box removes the last chip, Esc undoes an applied reading.
 */
export function SmartRow<Row>({ d, state, onState, searchRef, applied, onApplied }: SmartRowProps<Row>) {
  const target = d.type === 'trip' ? 'trips' : 'places';
  const live = applied && stillApplies(state, applied) ? applied : null;
  const draft = state.q;
  const smart = useQueryParse(draft, { target, enabled: !live && wordCount(draft) >= 2 });
  const preview = !live && smart.parsed && smart.parsed.target !== 'search' && smart.parsed.chips.length > 0 ? smart.parsed : null;

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
          if (p && p.target !== 'search' && filtersOf(p) > 0 && latest.current.state.q === text) latest.current.apply(p, text);
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
          <QueryChips parsed={preview} onRemove={smart.remove} onPick={smart.pick} onEmpty={() => searchRef.current?.focus()} />
          <p className="smart-hint">
            <kbd>Enter</kbd> applies this reading to the list. <kbd>Esc</kbd> clears the box.
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
            <span>
              Read &ldquo;{live.text}&rdquo; as {n} {n === 1 ? 'filter' : 'filters'}
              {live.parsed.notYet.length ? <> &middot; &ldquo;{live.parsed.notYet.join(', ')}&rdquo; has no filter yet</> : null}
            </span>
            <button type="button" onClick={undo}>Search the words instead</button>
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

  return (
    <div className="smart-row" data-open={open || undefined}>
      <div inert={!open}>{shown ? build(shown.preview, shown.live) : null}</div>
    </div>
  );
}
export default SmartRow;
