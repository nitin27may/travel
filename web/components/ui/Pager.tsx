import Link from 'next/link';
import { cx } from './cx';

/** Page size by view: 48 cards or 100 rows (components 8.5). */
export const PAGE_SIZE = { cards: 48, list: 48, table: 100, map: 48 } as const;

/** The pages to show: first, last, the current page and its neighbours, with 0 marking a gap. */
export function pageWindow(page: number, pages: number): number[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: number[] = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) out.push(0);
    out.push(n);
  });
  return out;
}

interface Props {
  page: number;
  pageSize: number;
  total: number;
  /** Called with the new page; the list pages put it in the URL as `?page=`. */
  onPage?: (page: number) => void;
  /** Server-rendered pages use real links instead. */
  hrefFor?: (page: number) => string;
  className?: string;
}

/** Pager "‹ 1 2 3 ›" with the count "49 to 64 of 64"; the current page is amber (components 8.5). Renders nothing for a single page. */
export function Pager({ page, pageSize, total, onPage, hrefFor, className }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const cur = Math.min(Math.max(1, page), pages);
  const from = (cur - 1) * pageSize + 1;
  const to = Math.min(total, cur * pageSize);
  const item = (n: number, label: string, current = false, disabled = false) => {
    const cls = cx('pager-item', current && 'pager-current');
    if (disabled) return <span key={`${label}-${n}`} className={cx(cls, 'pager-off')} aria-hidden="true">{label}</span>;
    const common = { className: cls, 'aria-current': current ? ('page' as const) : undefined };
    const name = typeof label === 'string' && /^\d+$/.test(label) ? `Page ${label}` : label === '‹' ? 'Previous page' : 'Next page';
    if (hrefFor) return <Link key={`${label}-${n}`} href={hrefFor(n)} aria-label={name} {...common}>{label}</Link>;
    return (
      <button key={`${label}-${n}`} type="button" aria-label={name} onClick={() => onPage?.(n)} {...common}>
        {label}
      </button>
    );
  };
  return (
    <nav className={cx('pager', className)} aria-label="Pages">
      {item(cur - 1, '‹', false, cur === 1)}
      {pageWindow(cur, pages).map((n, i) => (n === 0 ? <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">&hellip;</span> : item(n, String(n), n === cur)))}
      {item(cur + 1, '›', false, cur === pages)}
      <span className="pager-count" role="status">
        {from} to {to} of {total}
      </span>
    </nav>
  );
}
