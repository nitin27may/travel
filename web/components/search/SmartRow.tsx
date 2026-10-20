'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';
import { useMediaQuery } from '@/components/entity/useMediaQuery';
import { countListAsync, relaxText, relaxToResults } from '@/lib/client/data';
import type { Relaxation } from '@/lib/client/data';
import type { EntityDescriptor, ListState } from '@/lib/entities/types';
import type { Applied } from '@/lib/search/applied';
import { HANDOFF_KEY, stillApplies, undoState } from '@/lib/search/applied';
import type { Handoff } from '@/lib/search/applied';
import { decodeState, emptyState, encodeState } from '@/lib/entities/url';
import { pickAlternative, withChip, withoutChips } from '@/lib/search/parse/pick';
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
  // what Enter would open: the reading merged into the filters already set. A scope of more than three row files stays uncounted
  // ("Enter shows this reading in the list") rather than load the catalogue for a hint.
  const [count, setCount] = useState<{ for: ParsedQuery; n: number; unchecked: number; relaxed: Relaxation | null } | null>(null);
  useEffect(() => {
    if (!preview) return;
    let alive = true;
    void (async () => {
      const got = await countListAsync(d.type, { ...state, q: preview.q, facets: { ...state.facets, ...preview.facets } }, 3);
      // a reading that gives nothing says what Enter will show instead, never a bare "0"
      const relaxed = got && got.n === 0 && got.unchecked === 0 ? await relaxToResults(preview, state).catch(() => null) : null;
      if (alive) setCount(got ? { for: preview, ...got, relaxed } : null);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, d.type]);
  const shownCount = preview && count?.for === preview ? count : null;

  // a reading the header search handed over for this very list: hold it like one typed here (undo line), and relax it when it gives no rows
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(HANDOFF_KEY);
      if (raw) sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let hand: Handoff;
    try {
      hand = JSON.parse(raw) as Handoff;
    } catch {
      return;
    }
    const canon = (search: string) => encodeState(decodeState(search));
    const here = new URL(window.location.href);
    if (hand.parsed.target !== target || !hand.parsed.href.startsWith(here.pathname) || canon(hand.parsed.href.split('?')[1] ?? '') !== canon(here.search)) return;
    void (async () => {
      const before = { ...emptyState(), view: state.view };
      const relaxed = hand.relaxed ? null : await relaxToResults(hand.parsed).catch(() => null);
      const use = relaxed?.parsed ?? hand.parsed;
      const note = relaxed ? { dropped: relaxed.dropped, total: relaxed.total } : hand.relaxed;
      onApplied({ parsed: use, text: hand.text, before, relaxed: note });
      if (relaxed) onState({ ...state, q: use.q, facets: { ...use.facets }, focus: null }, 'replace');
    })();
    // once, on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a reading the visitor has since changed by hand is no longer theirs to undo
  useEffect(() => {
    if (applied && !live) onApplied(null);
  }, [applied, live, onApplied]);

  const apply = async (p: ParsedQuery, text: string) => {
    // never a bare "0" under neat chips: a reading that gives no rows is relaxed, narrowest chip first, and the list says so
    const relaxed = await relaxToResults(p, state).catch(() => null);
    const use = relaxed?.parsed ?? p;
    onApplied({ parsed: use, text, before: state, relaxed: relaxed ? { dropped: relaxed.dropped, total: relaxed.total } : undefined });
    onState({ ...state, q: use.q, facets: { ...state.facets, ...use.facets }, focus: null }, 'push');
    smart.reset();
  };
  const undo = () => {
    if (!live) return;
    onState(undoState(live), 'replace');
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
          if (filtersOf(p) > 0) void latest.current.apply(p, text);
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
                <kbd>Enter</kbd> shows {shownCount?.relaxed ? `${shownCount.relaxed.n} ${shownCount.relaxed.n === 1 ? d.noun.one : d.noun.many} that match ${shownCount.relaxed.total - shownCount.relaxed.dropped.length} of ${shownCount.relaxed.total}` : shownCount ? `${shownCount.n} ${shownCount.n === 1 ? d.noun.one : d.noun.many}${shownCount.unchecked ? ` \u00b7 ${shownCount.unchecked} not checked yet` : ''}` : 'this reading in the list'}. <kbd>Esc</kbd> clears the box.
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
                <button type="button" onClick={undo} aria-label={`Undo: search the words instead (${live.text})`}>Undo</button>
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
          {live.relaxed ? (
            <p className="smart-relaxed" role="status">
              {relaxText({ parsed: live.parsed, dropped: live.relaxed.dropped, total: live.relaxed.total, n: 0, unchecked: 0 }, d.noun.many)}
              {' \u00b7 '}
              {live.relaxed.dropped.map((c, i) => (
                <span key={c.id}>
                  {i ? ', ' : null}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => {
                      const rest = live.relaxed!.dropped.filter((x) => x !== c);
                      onApplied({ ...live, parsed: withChip(live.parsed, c), relaxed: rest.length ? { dropped: rest, total: live.relaxed!.total } : undefined });
                      onState({ ...state, facets: { ...state.facets, ...c.set }, focus: null }, 'push');
                    }}
                  >
                    put back {c.label}
                  </button>
                </span>
              ))}
            </p>
          ) : null}
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
