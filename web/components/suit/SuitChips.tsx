import type { Chip } from '@/lib/public/suitability';
import { SuitGlyph } from './SuitGlyph';

/**
 * One suitability chip (suitability-display 3.1): a rule is the quiet filled chip with a lock, advice is the outlined chip with a
 * person, a gap is dashed. The look comes from the chip kind, never from a type. The accessible name leads with what kind of
 * statement it is ("Operator rule:", "Our judgement:", "Not checked yet:").
 */
export function SuitChip({ chip, short = false }: { chip: Chip; short?: boolean }) {
  const text = short && chip.textNoTime ? chip.textNoTime : chip.text;
  return (
    <li className="ch" data-kind={chip.kind}>
      <span className="ci" aria-label={chip.label}>
        <SuitGlyph name={chip.glyph} />
        <span>{text}</span>
        {chip.extra > 0 ? <span className="ch-more">+{chip.extra}</span> : null}
      </span>
    </li>
  );
}

/** The chip row, a list named "Who it suits". A row may wrap; a chip never wraps inside itself. */
export function SuitChips({ chips, short = false, className }: { chips: readonly (Chip | null)[]; short?: boolean; className?: string }) {
  const shown = chips.filter((c): c is Chip => c !== null);
  if (shown.length === 0) return null;
  return (
    <ul className={`chs ${className ?? ''}`} aria-label="Who it suits">
      {shown.map((c, i) => (
        <SuitChip key={`${c.field ?? c.kind}-${i}`} chip={c} short={short} />
      ))}
    </ul>
  );
}

/** The two card chips (kids, effort), built from the list row's own fields so the card ships no new data (P8). */
export function CardChip({ kind, text, glyph }: { kind: Chip['kind']; text: string; glyph: Chip['glyph'] }) {
  return (
    <span className="ch ch-card" data-kind={kind}>
      <span className="ci">
        <SuitGlyph name={glyph} />
        <span>{text}</span>
      </span>
    </span>
  );
}
