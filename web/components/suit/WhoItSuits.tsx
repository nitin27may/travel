import type { PublicSuitability } from '@/lib/public/suitability';
import { suitsInner } from './html';

/**
 * "Who it suits" (suitability-display sections 1 to 4): three chips at rest, one warning line, the research line, then the groups.
 * Limits and Who it suits are open; the rest are collapsed to a header with their values inline. Built as one string of markup (see html.ts).
 */
export function WhoItSuits({ suit, slugs, title = 'Who it suits', hide }: { suit: PublicSuitability; slugs: Record<string, string>; title?: string; hide?: ReadonlySet<string> }) {
  return <section className="ps su" id="suits" aria-labelledby="h-suits" dangerouslySetInnerHTML={{ __html: suitsInner(suit, slugs, title, hide) }} />;
}

/** The section when the record has no suitability block at all: one gap chip, in the same words as everywhere else. */
export function WhoItSuitsEmpty({ title = 'Who it suits' }: { title?: string }) {
  return (
    <section className="ps su" id="suits" aria-labelledby="h-suits">
      <header className="ph">
        <h2 id="h-suits">{title}</h2>
      </header>
      <ul className="chs" aria-label="Who it suits">
        <li className="ch" data-kind="gap">
          <span className="ci" aria-label="Not checked yet: family checks">
            <span>Family checks not done yet</span>
          </span>
        </li>
      </ul>
    </section>
  );
}
