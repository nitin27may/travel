import { cx } from './cx';

export type MonthState = 'open' | 'possible' | 'closed';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface Props {
  /** Twelve entries, January first. `open` is solid (as written), `possible` is hatched (inferred), `closed` is empty. */
  months: MonthState[];
  className?: string;
  /** The screen-reader name. Defaults to "Open <months>"; a plan's own window passes "Months this plan covers: <months>", so it never reads as an opening season. */
  label?: string;
}

function summary(months: MonthState[]): string {
  const open = MONTHS.filter((_, i) => months[i] === 'open');
  const possible = MONTHS.filter((_, i) => months[i] === 'possible');
  const parts: string[] = [];
  parts.push(open.length ? `Open ${open.length === 12 ? 'all year' : open.join(', ')}` : 'No month confirmed open');
  if (possible.length) parts.push(`possible ${possible.join(', ')}`);
  return parts.join('; ');
}

/** Twelve-month strip for the season band (patterns 3.4). Solid means written in the source; hatched means possible. */
export function SeasonStrip({ months, className, label }: Props) {
  return (
    <div className={cx('season-strip', className)} role="img" aria-label={label ?? summary(months)}>
      {INITIALS.map((m, i) => (
        <span key={i} className="season-cell" data-state={months[i] ?? 'closed'}>
          {m}
        </span>
      ))}
    </div>
  );
}
