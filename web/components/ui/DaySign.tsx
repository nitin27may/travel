import { cx } from './cx';

interface Props {
  n: number;
  /** `focused` is the one amber sign on a page (the picked day); `quiet` is every other day. */
  state?: 'quiet' | 'focused';
  size?: 'md' | 's';
  className?: string;
}

/** DAY 03 as a signpost: Big Shoulders 19 (15 small), arrow-cut right edge. Quiet unless it is the focused day. */
export function DaySign({ n, state = 'quiet', size = 'md', className }: Props) {
  return (
    <span className={cx('sign', state === 'quiet' && 'sign-quiet', size === 's' && 'sign-s', className)} data-state={state}>
      DAY {String(n).padStart(2, '0')}
    </span>
  );
}
