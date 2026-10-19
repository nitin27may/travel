import { stubOf, type ShowRow } from '@/components/suit/Rows';

// The month grid of "When to go" (place-page-sections 3.8): one row per season line, twelve cells, open months filled, part
// months hatched. Built from the stored season rows, so a new kind of season line needs no code.

const MONTH_INITIAL = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const START = DAYS.reduce<number[]>((a, d, i) => [...a, (a[i] ?? 0) + d], [0]);

const doy = (md: string): number => {
  const [m, d] = md.split('-').map(Number);
  return START[(m ?? 1) - 1]! + (d ?? 1);
};

/** The share of each month a from-to range covers (0, a part, 1); a range that wraps the year is two ranges. */
export function monthCover(from: string, to: string): number[] {
  const a = doy(from);
  const b = doy(to);
  const ranges: [number, number][] = a <= b ? [[a, b]] : [[a, 365], [1, b]];
  return DAYS.map((d, i) => {
    const s = START[i]! + 1;
    const e = START[i]! + d;
    let n = 0;
    for (const [x, y] of ranges) n += Math.max(0, Math.min(e, y) - Math.max(s, x) + 1);
    return n / d;
  });
}

interface SeasonLine {
  from: string;
  to: string;
  status?: string;
  via?: string;
  why?: string;
}
const isLine = (x: unknown): x is SeasonLine => typeof x === 'object' && x !== null && typeof (x as SeasonLine).from === 'string' && typeof (x as SeasonLine).to === 'string';

const words = (l: SeasonLine): string => [l.via, l.status ?? 'open'].filter(Boolean).join(' ').replace(/_/g, ' ');

export function SeasonGrid({ row }: { row: ShowRow }) {
  const lines = Array.isArray(row.value) ? row.value.filter(isLine) : [];
  if (lines.length === 0) return null;
  return (
    <div className="ps-seasons" id={`row-${row.key}`}>
      <p className="ps-grid-title">
        {row.label}
        <span className="ps-stub">{row.val ? ` · ${stubOf(row.val)}` : ''}</span>
      </p>
      {lines.map((l, i) => {
        const cover = monthCover(l.from, l.to);
        const open = (l.status ?? 'open') === 'open';
        return (
          <div key={i} className="ps-grid" role="img" aria-label={`${words(l)}: ${cover.map((c, m) => (c > 0 ? MONTH_NAME[m] : null)).filter(Boolean).join(', ')}`}>
            <span className="ps-grid-lab">{words(l)}</span>
            <span className="ps-cells" aria-hidden="true">
              {cover.map((c, m) => (
                <span key={m} className="ps-cell" data-fill={c >= 0.95 ? 'full' : c > 0 ? 'part' : 'none'} data-open={open || undefined}>
                  {MONTH_INITIAL[m]}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const MD = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dm = (md: string): string => `${Number(md.slice(3))} ${MD[Number(md.slice(0, 2)) - 1]}`;

/** A season value as one short line for the glance: "Shuttle 15 May to 12 Oct · Road all year (limited)". */
export function seasonShort(value: unknown): string {
  const lines = Array.isArray(value) ? value.filter(isLine) : [];
  return lines
    .slice(0, 2)
    .map((l) => {
      const span = l.from === '01-01' && l.to === '12-31' ? 'all year' : `${dm(l.from)} to ${dm(l.to)}`;
      const who = l.via ? `${l.via.charAt(0).toUpperCase()}${l.via.slice(1)} ` : '';
      const st = l.status && l.status !== 'open' ? ` (${l.status.replace(/_/g, ' ')})` : '';
      return `${who}${span}${st}`;
    })
    .join(' · ');
}
