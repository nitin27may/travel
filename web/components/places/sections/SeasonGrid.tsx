// The season line as one short sentence, for the glance. The month grid itself is built in components/suit/html.ts.
const isLine = (x: unknown): x is { from: string; to: string; status?: string; via?: string } => typeof x === 'object' && x !== null && typeof (x as { from?: unknown }).from === 'string' && typeof (x as { to?: unknown }).to === 'string';

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
