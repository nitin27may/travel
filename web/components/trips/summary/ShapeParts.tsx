import type { ShapeModel } from '@travel/core/trips/shape.ts';
import type { ShapePhraseKey } from './shapeTypes';

// The ribbon and the count line of the trip's shape (spec 4.2, W5): drawn from a `ShapeModel` of the timelines on screen.
type ShapeHead = Pick<ShapeModel, 'ribbon' | 'tail' | 'phrases' | 'countLine'>;

const ARTICLE = /^(?:el|la|le|les|los|las|il|the)$/i;

/**
 * The name a ribbon segment keeps when it is under 64 px wide (spec 4.4; the list always has the full name): the first three letters of a
 * first word of five letters or more ("Kananaskis Village" gives "Kan"), else the initials of the first two words ("Lake Louise village" gives "LL").
 */
export function shortName(name: string): string {
  const all = name.split(/[\s/–-]+/).filter(Boolean);
  // a leading article tells places apart worse than the word after it ("El Chalten", "El Calafate")
  const words = all.length > 1 && ARTICLE.test(all[0]!) ? all.slice(1) : all;
  const first = words[0] ?? name;
  if (first.length >= 5) return first.slice(0, 3);
  if (words.length >= 2) return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
  return first;
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
  return (
    <div className="shape-ribbon-w">
      <ol className="shape-ribbon" aria-label="Where you sleep">
        {segs.map((s, i) => {
          const nights = plural(s.nights, 'night', 'nights');
          return (
            <li key={`${s.name}-${i}`} className="shape-seg" style={{ flexGrow: s.nights }}>
              <span className="shape-seg-n" aria-hidden="true">
                <span className="shape-full">{s.name}</span>
                <span className="shape-short">{shortName(s.name)}</span>
              </span>
              <span className="shape-seg-k num" aria-hidden="true">
                <span className="shape-full">{nights}</span>
                <span className="shape-short">{s.nights}</span>
              </span>
              <span className="sr-only">
                {s.name}, {nights}
              </span>
            </li>
          );
        })}
      </ol>
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
              {p.text}
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
