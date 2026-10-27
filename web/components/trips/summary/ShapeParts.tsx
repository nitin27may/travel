import type { ShapeModel } from '@travel/core/trips/shape.ts';
import type { ShapePhraseKey } from './shapeTypes';

// The ribbon and the count line of the trip's shape (spec 4.2, W5): drawn from a `ShapeModel` of the timelines on screen.
type ShapeHead = Pick<ShapeModel, 'ribbon' | 'tail' | 'phrases' | 'countLine'>;

const ARTICLE = /^(?:el|la|le|les|los|las|il|the)$/i;

/**
 * The short form of a stay's name, for a segment too narrow for the whole name (review UXB-3 M2): a name of two or more words takes its
 * initials ("Lake Louise village" gives "LL"); a single word keeps up to six letters whole ("Banff", "Myvatn") and a longer one four and a
 * full stop ("Grun."). A leading article is skipped ("El Chalten" gives "Chal."). The list and the names line always have the whole name.
 */
export function shortName(name: string): string {
  const all = name.split(/[\s/–-]+/).filter(Boolean);
  const words = all.length > 1 && ARTICLE.test(all[0]!) ? all.slice(1) : all;
  if (words.length >= 2) return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
  const w = words[0] ?? name;
  return w.length <= 6 ? w : `${w.slice(0, 4)}.`;
}

/** How much room the whole name needs, by its length: the stylesheet shortens it under 56, 96, 140 or 200 px of segment (data-fit). */
export function fitOf(name: string): 's' | 'm' | 'l' | 'xl' {
  const n = name.length;
  return n <= 6 ? 's' : n <= 10 ? 'm' : n <= 16 ? 'l' : 'xl';
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "+ the flight home on Day 15"; null with no tail. */
export function tailText(tail: ShapeHead['tail']): string | null {
  if (!tail || !tail.days.length) return null;
  const first = tail.days[0]!;
  const last = tail.days[tail.days.length - 1]!;
  if (tail.label === 'Flight home') return `+ the flight home on ${first === last ? `Day ${first}` : `Days ${first} to ${last}`}`;
  return first === last ? `+ Day ${first}, the last day` : `+ Days ${first} to ${last} after the last night`;
}

/** Where you sleep: one segment per stay, wide by its nights, name and nights in text, no colour per base (spec 4.2). */
export function Ribbon({ m }: { m: ShapeHead }) {
  const segs = m.ribbon.filter((s) => s.nights > 0);
  if (!segs.length) return null;
  const tail = tailText(m.tail);
  // a names line under the ribbon: more than six stays, or a stay too thin for any name on a phone (under 12% of the nights) or anywhere (under 7%)
  const thin = Math.min(...segs.map((x) => x.share));
  const names = segs.length > 6 ? 'all' : thin < 0.07 ? 'all' : thin < 0.12 ? 'phone' : null;
  return (
    <div className="shape-ribbon-w" data-names={names ?? undefined}>
      <ol className="shape-ribbon" aria-label="Where you sleep">
        {segs.map((s, i) => {
          const nights = plural(s.nights, 'night', 'nights');
          return (
            <li key={`${s.name}-${i}`} className="shape-seg" data-fit={fitOf(s.name)} style={{ flexGrow: s.nights }}>
              <span className="shape-seg-n" aria-hidden="true">
                <span className="shape-full">{s.name}</span>
                <span className="shape-short">{shortName(s.name)}</span>
              </span>
              <span className="shape-seg-k num" aria-hidden="true">
                <span className="shape-nfull">{nights}</span>
                <span className="shape-nshort">{s.nights}</span>
              </span>
              <span className="sr-only">
                {s.name}, {nights}
              </span>
            </li>
          );
        })}
      </ol>
      {names ? (
        <p className="shape-names" aria-hidden="true">
          {segs.map((x, i) => (
            <span key={`${x.name}-${i}`}>
              {i > 0 ? ' · ' : ''}
              {x.name} {x.nights}
            </span>
          ))}
        </p>
      ) : null}
      {tail ? <p className="shape-tail">{tail}</p> : null}
    </div>
  );
}

interface CountProps {
  m: ShapeHead;
  /** Which phrase the open table is filtered to; "days" for the unfiltered table; null while closed. */
  active: ShapePhraseKey | null;
  controls: string;
  onPhrase?: (key: ShapePhraseKey) => void;
  onIntent?: () => void;
}

/** The count line: each phrase is a live disclosure button that opens the table filtered to those days. */
export function CountLine({ m, active, controls, onPhrase, onIntent }: CountProps) {
  return (
    <>
      <p className="shape-count" data-print="hide">
        {m.phrases.map((p, i) => (
          <span key={p.key} className="shape-count-i">
            {i > 0 ? (
              <span className="shape-dot" aria-hidden="true">
                {' · '}
              </span>
            ) : null}
            <button
              type="button"
              className="shape-phrase"
              aria-expanded={active === p.key}
              aria-controls={controls}
              data-phrase={p.key}
              onClick={onPhrase ? () => onPhrase(p.key) : undefined}
              onPointerEnter={onIntent}
              onFocus={onIntent}
            >
              <span className="shape-long">{p.text}</span>
              <span className="shape-brief">{p.short}</span>
            </button>
          </span>
        ))}
      </p>
      <p className="shape-print" data-print="show">
        {m.countLine}
      </p>
    </>
  );
}
