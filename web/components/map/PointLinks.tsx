import { appleMapsUrl, directionsUrl, formatPoint } from '@/lib/map/links';
import { primaryPin } from '@/lib/map/primary';
import type { MapSpec } from '@/lib/map/types';

const linkCls = 'inline-flex min-h-9 items-center rounded-lg border px-3 font-mono text-[12px] underline-offset-2 hover:underline';
const linkStyle = { borderColor: 'var(--line)', color: 'var(--ink)', background: 'var(--surface)' } as const;

/**
 * The stored points as text, with directions links built from OUR coordinates (no Google call, no key).
 * Used by the Google facade and the Embed family, where we cannot draw lines.
 */
export function PointLinks({ spec, list = true }: { spec: Pick<MapSpec, 'pins' | 'selectedId'>; list?: boolean }) {
  const p = primaryPin(spec);
  const named = spec.pins.filter((x) => x.style === 'trailhead' || x.style === 'parking' || x.style === 'place' || x.style === 'base');
  return (
    <div data-map-links className="flex flex-col gap-2">
      {list && named.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-[12px]" style={{ color: 'var(--ink-2)' }}>
          {named.map((x) => (
            <li key={x.id}>
              <span style={{ color: 'var(--ink)' }}>{x.label ?? x.style}</span> · {formatPoint(x.at)}
            </li>
          ))}
        </ul>
      )}
      {p && (
        <div className="flex flex-wrap gap-2">
          <a className={linkCls} style={linkStyle} href={directionsUrl(p.at)} target="_blank" rel="noopener noreferrer">Directions in Google Maps</a>
          <a className={linkCls} style={linkStyle} href={appleMapsUrl(p.at, p.label)} target="_blank" rel="noopener noreferrer">Apple Maps</a>
        </div>
      )}
    </div>
  );
}
