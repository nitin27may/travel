'use client';

import { Icon } from '@/components/ui/Icon';
import { useTripUrl } from '@/components/trips/useTripUrl';
import { DEFAULT_TAB_STATE } from '@travel/core/trips/tabs.ts';
import type { BuiltFacts } from '@/lib/trip-edit/built';
import { jumpToFirstFix } from '../warnings/store';
import './built.css';

/**
 * The just-built line above Day 1 (edit-mode-spec 2.1; patterns 3.10 item 1): "Built 8 days · 1 did not fit · 1 to check", zero parts left out
 * ("all fit"). "did not fit" and "to check" go to the Summary where they are listed; "to fix" goes to the first fix. One polite
 * announcement when it appears. Shown for the page view Build my days opened, and on Days only (the Summary holds the same facts).
 */
export function JustBuilt({ facts }: { facts: BuiltFacts }) {
  const { go } = useTripUrl();
  const toSummary = (hash: string) => () => go({ tab: DEFAULT_TAB_STATE, hash }, 'push');
  const parts = facts.line.split(' · ');
  return (
    <p className="built-line own-changes-line" data-testid="just-built" data-print="hide" role="status">
      <span className="built-kick"><Icon name="check" size={14} /> Just built</span>
      {parts.map((p) => {
        const target = /did not fit$/.test(p) ? toSummary('built-miss') : /to check$/.test(p) ? toSummary('wn-sum-h') : /to fix$/.test(p) ? jumpToFirstFix : null;
        return (
          <span key={p}>
            <span aria-hidden="true"> · </span>
            {target ? (
              <button type="button" className="own-link" onClick={target}>{p}</button>
            ) : (
              <b>{p}</b>
            )}
          </span>
        );
      })}
    </p>
  );
}
