import { MONTH_NAMES, MONTH_SHORT, STATE_LEGEND, STATE_PHRASE, STATE_WORD, legendStates, stateSummary, type MonthState } from './whenModel';

/**
 * The month strip (components 4.7, uxb-components 5): twelve months, three-letter names, a state in pattern AND word (never colour alone).
 * Server-rendered, no JS. The layout follows the strip's own width (a container query in when-to-go.css): 12 x 1 from 340 px with a legend
 * under it, 6 x 2 with the word in the cell under 340 px, and the word in the cell again from 705 px (desktop). A screen reader gets a summary
 * line, then an ordered list of twelve items with the full month and state as text; the visible names and words are aria-hidden.
 */
export function MonthStrip({ states, idBase = 'wtg' }: { states: readonly MonthState[]; idBase?: string }) {
  const legend = legendStates(states);
  const checked = legend.length > 0;
  return (
    <div className="mstrip" data-mstrip="">
      <p className="sr-only" id={`${idBase}-strip-sum`}>{stateSummary(states)}</p>
      <ol className="mstrip-list" aria-describedby={`${idBase}-strip-sum`} aria-label="Months">
        {MONTH_NAMES.map((name, i) => {
          const s = states[i] ?? 'none';
          return (
            <li key={name} className="mstrip-cell" data-state={s} data-month={i + 1}>
              <span className="mstrip-m" aria-hidden="true">{MONTH_SHORT[i]}</span>
              <span className="mstrip-w" aria-hidden="true">{STATE_WORD[s]}</span>
              <span className="sr-only">{`${name}, ${STATE_PHRASE[s]}`}</span>
            </li>
          );
        })}
      </ol>
      {checked ? (
        <ul className="mstrip-legend" aria-label="What the cells mean">
          {legend.map((s) => (
            <li key={s}>
              <i className="mstrip-key" data-state={s} aria-hidden="true" />
              {STATE_LEGEND[s]}
            </li>
          ))}
          <li>
            <i className="mstrip-key" data-state="none" aria-hidden="true" />
            Blank: not checked
          </li>
        </ul>
      ) : null}
    </div>
  );
}
