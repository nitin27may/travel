const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = MONTHS;

/** [6,7,8,9] -> "Jun to Sep"; non-contiguous months are listed; 12 months -> "Year-round". */
export function seasonLabel(months: readonly number[]): string {
  const m = [...new Set(months)].filter((x) => x >= 1 && x <= 12).sort((a, b) => a - b);
  if (!m.length) return '';
  if (m.length === 12) return 'Year-round';
  const runs: number[][] = [];
  for (const x of m) {
    const last = runs[runs.length - 1];
    if (last && x === last[last.length - 1] + 1) last.push(x);
    else runs.push([x]);
  }
  // a run that ends in December joins one that starts in January
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1].at(-1) === 12) {
    const tail = runs.pop() as number[];
    runs[0] = [...tail, ...runs[0]];
  }
  return runs
    .map((r) => (r.length === 1 ? MONTHS[r[0] - 1] : r.length === 2 ? `${MONTHS[r[0] - 1]}, ${MONTHS[r[1] - 1]}` : `${MONTHS[r[0] - 1]} to ${MONTHS[r[r.length - 1] - 1]}`))
    .join(', ');
}
