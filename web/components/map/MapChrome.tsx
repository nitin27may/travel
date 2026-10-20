import type { ReactNode } from 'react';
import type { LegendItem } from '@/lib/map/types';

const btn = 'inline-flex h-[34px] min-w-[34px] items-center justify-center rounded-lg border px-2 font-mono text-[13px] font-semibold';
const btnStyle = { fontFamily: 'var(--font-mono, ui-monospace, monospace)', background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)' } as const;

export function Controls({ onZoom, onFit }: { onZoom: (d: number) => void; onFit: () => void }) {
  return (
    <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5" data-map-controls>
      <button type="button" className={btn} style={btnStyle} aria-label="Zoom in" onClick={() => onZoom(1)}>+</button>
      <button type="button" className={btn} style={btnStyle} aria-label="Zoom out" onClick={() => onZoom(-1)}>−</button>
      <button type="button" className={btn} style={btnStyle} onClick={onFit}>Fit</button>
    </div>
  );
}

const swatch = (s: LegendItem['style']): ReactNode => {
  const base = { display: 'inline-block', flex: 'none' } as const;
  switch (s) {
    case 'route': return <span style={{ ...base, width: 18, height: 2, background: 'var(--ink)' }} />;
    case 'route-pick': return <span style={{ ...base, width: 18, height: 4, background: 'var(--accent)', outline: '1px solid var(--ink)' }} />;
    case 'trail': return <span style={{ ...base, width: 18, height: 3, background: 'var(--ink)' }} />;
    case 'trail-unconfirmed': return <span style={{ ...base, width: 18, height: 0, borderTop: '3px dashed var(--muted)' }} />;
    case 'straight-estimate': return <span style={{ ...base, width: 18, height: 0, borderTop: '2px dashed var(--ink)', opacity: 0.5 }} />;
    // the same picture as the pin on the map: a surface disc with an ink ring and an ink centre
    case 'place': return (
      <span style={{ ...base, width: 14, height: 14, borderRadius: '50%', background: 'var(--surface)', border: '2.5px solid var(--ink)', position: 'relative', boxSizing: 'border-box' }}>
        <span style={{ position: 'absolute', inset: 2.5, borderRadius: '50%', background: 'var(--ink)' }} />
      </span>
    );
    case 'stop': return <span style={{ ...base, width: 6, height: 6, borderRadius: '50%', background: 'var(--ink)' }} />;
    case 'base': return <span style={{ ...base, width: 12, height: 12, borderRadius: 3, background: 'var(--ink)' }} />;
    case 'trailhead': return <span style={{ ...base, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '11px solid var(--ink)' }} />;
    default: return <span style={{ ...base, width: 12, height: 12, borderRadius: '50%', background: 'var(--ink)' }} />;
  }
};

export function Legend({ items }: { items: LegendItem[] }) {
  if (!items.length) return null;
  return (
    <ul
      data-map-legend
      className="absolute bottom-8 left-2 z-10 m-0 flex list-none flex-col gap-1 rounded-lg border p-2 font-mono text-[12px]"
      style={{ background: 'color-mix(in srgb, var(--surface) 92%, transparent)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
    >
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-2">{swatch(i.style)}<span>{i.label}</span></li>
      ))}
    </ul>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      data-map-notice
      className="absolute left-2 right-12 top-2 z-10 rounded-lg border px-3 py-2 font-mono text-[12px]"
      style={{ background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink)' }}
    >
      {children}
    </div>
  );
}

export function Well({ children, label, className = '' }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`map-surface relative flex min-h-[320px] flex-col justify-center gap-3 rounded-xl border p-4 ${className}`}
      style={{ background: 'var(--well)', borderColor: 'var(--line)', color: 'var(--ink)' }}
    >
      {children}
    </div>
  );
}
