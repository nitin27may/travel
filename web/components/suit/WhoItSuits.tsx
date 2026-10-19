import type { PublicSuitability, SuitGroup } from '@/lib/public/suitability';
import { GapChip, RowLine, fromSuit } from './Rows';
import { SuitChips } from './SuitChips';
import { SuitGlyph } from './SuitGlyph';

/** Groups that are echoes of a section of their own (Facilities is section 9, When you can go is section 8): values only, no gap marker here (PS1). */
const ECHO_GROUPS = new Set<string>(['facilities', 'when']);

function Group({ g, slugs }: { g: SuitGroup; slugs: Record<string, string> }) {
  const echo = ECHO_GROUPS.has(g.id);
  const rows = echo ? g.rows.filter((r) => !r.gap) : g.rows;
  if (echo && rows.length === 0) return null;
  const gaps = g.rows.filter((r) => r.gap);
  const closing = echo ? null : g.closing;
  return (
    <details className="su-group" data-group={g.id} open={g.open && !echo}>
      <summary>
        <span className="su-gtitle">{g.title}</span>
        <span className="su-gsum">
          {rows.filter((r) => !r.gap).map((r, i) => (
            <span key={r.key} className="su-gitem">
              {i ? <span className="su-dot" aria-hidden="true">·</span> : null}
              {r.short}
            </span>
          ))}
          {!echo ? gaps.map((r) => <GapChip key={r.key}>{`Not checked yet · ${r.label.toLowerCase()}`}</GapChip>) : null}
          {!echo && g.closing ? <GapChip>{g.closing}</GapChip> : null}
        </span>
      </summary>
      <div className="su-gbody">
        {rows.map((r) => (
          <RowLine key={r.key} row={fromSuit(r)} slugs={slugs} id={`su-${r.key}`} />
        ))}
        {closing ? (
          <p className="su-closing">
            <span aria-hidden="true" className="su-q">?</span> {closing}
          </p>
        ) : null}
      </div>
    </details>
  );
}

/**
 * "Who it suits" (suitability-display sections 1 to 4): three chips at rest, one warning line, the research line, then the groups.
 * Limits and Who it suits are open; the rest are collapsed to a header with their values inline.
 */
export function WhoItSuits({ suit, slugs, title = 'Who it suits' }: { suit: PublicSuitability; slugs: Record<string, string>; title?: string }) {
  return (
    <section className="ps-sec su" id="suits" aria-labelledby="h-suits">
      <header className="ps-head">
        <h2 id="h-suits">{title}</h2>
        {suit.research.text ? <p className="ps-meta">{suit.research.text}</p> : null}
      </header>
      <SuitChips chips={suit.chips} />
      {suit.warning ? (
        <p className="su-warn">
          <SuitGlyph name="triangle" size={16} />
          <span>{suit.warning}</span>
        </p>
      ) : null}
      {suit.groups.map((g) => (
        <Group key={g.id} g={g} slugs={slugs} />
      ))}
    </section>
  );
}

/** The section when the record has no suitability block at all: one gap chip, in the same words as everywhere else. */
export function WhoItSuitsEmpty({ title = 'Who it suits' }: { title?: string }) {
  return (
    <section className="ps-sec su" id="suits" aria-labelledby="h-suits">
      <header className="ps-head">
        <h2 id="h-suits">{title}</h2>
      </header>
      <ul className="su-chips" aria-label="Who it suits">
        <li className="su-chip" data-kind="gap">
          <span className="su-chip-in" aria-label="Not checked yet: family checks">
            <span>Family checks not done yet</span>
          </span>
        </li>
      </ul>
    </section>
  );
}
