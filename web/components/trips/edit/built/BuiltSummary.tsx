'use client';

import { Button } from '@/components/ui/Button';
import type { BuiltFacts, MissRow } from '@/lib/trip-edit/built';
import './built.css';

/**
 * The Summary's build block (ruling R2: stage 8's state line, Checks and Did not fit now live on the details page): what the build did and
 * what it left out, each left-out pick with the engine's reason. Known costs and Book ahead wait for a per-place price and booking source
 * (the resolve rows carry a name and a kind only, P8). `onRemove` is present only while editing: a left-out pick can be taken off the trip.
 */
export function BuiltSummary({ facts, misses, onRemove }: { facts: BuiltFacts; misses: readonly MissRow[]; onRemove: ((m: MissRow) => void) | null }) {
  return (
    <section className="built-sum sum-sec" aria-labelledby="built-sum-h" data-testid="built-summary">
      <h2 id="built-sum-h" className="trip-kicker-h">How it was built</h2>
      <p className="built-sum-line"><b>{facts.line}</b></p>
      {facts.checks ? <p className="built-sum-checks"><span className="built-sum-k">Checks</span> {facts.checks}</p> : null}
      <div id="built-miss" className="built-miss" tabIndex={-1}>
        <h3 className="built-miss-h">Did not fit</h3>
        {misses.length ? (
          <ul className="built-miss-list">
            {misses.map((m) => (
              <li key={m.ref} className="built-miss-row">
                <div className="built-miss-text">
                  <span className="built-miss-name">{m.name}</span>
                  <span className="built-miss-why">{m.why}</span>
                </div>
                {onRemove ? <Button size="sm" onClick={() => onRemove(m)} aria-label={`Take ${m.name} off the trip`}>Remove</Button> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="built-miss-none">Every place you picked is on a day.</p>
        )}
      </div>
    </section>
  );
}
