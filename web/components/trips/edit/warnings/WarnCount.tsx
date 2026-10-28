'use client';

import { Icon } from '@/components/ui/Icon';
import { jumpToFirstFix, useWarnCounts } from './store';
import './warnings.css';

/**
 * "2 to fix" in the sticky row (edit-mode-spec 11.1) and, on a phone, on its own line under the day rail (review M5): a button, never a
 * label, that jumps to the first Fix warning. The words and the triangle say it, not the colour alone. Nothing renders when nothing is
 * to fix; the Check count lives on the day headers and in the Summary.
 */
export function WarnCount() {
  const c = useWarnCounts();
  if (!c.fix) return null;
  return (
    <button type="button" className="wn-count" data-testid="warn-count" onClick={jumpToFirstFix} aria-label={`${c.fix} to fix. Go to the first one${c.firstFixDay ? `, on Day ${c.firstFixDay}` : ''}`}>
      <Icon name="warn" size={15} />
      <span className="num">
        {c.fix} to fix{c.firstFixDay ? <span className="wn-count-day"> · Day {c.firstFixDay}</span> : null}
      </span>
    </button>
  );
}

/** The Summary's Checks line of a copy being edited (edit-mode-spec 11.1): both counts, each a link to the first day that holds one. */
export function SummaryChecks() {
  const c = useWarnCounts();
  return (
    <section className="wn-sum" aria-labelledby="wn-sum-h" data-testid="summary-checks">
      <h2 id="wn-sum-h" className="trip-kicker-h">Checks</h2>
      {c.fix || c.check ? (
        <p className="wn-sum-line">
          {c.fix ? (
            <a className="wn-sum-fix" href={`#day-${c.firstFixDay ?? 1}`}>
              <Icon name="warn" size={15} /> <b>{c.fix} to fix</b>
            </a>
          ) : null}
          {c.fix && c.check ? <span aria-hidden="true"> · </span> : null}
          {c.check ? <span className="wn-sum-check"><b>{c.check} to check</b>, on the day headers</span> : null}
        </p>
      ) : (
        <p className="wn-sum-line">Nothing to fix or check.</p>
      )}
    </section>
  );
}
