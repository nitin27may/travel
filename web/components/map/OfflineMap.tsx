import { boundsOf, fitPoints } from '@/lib/map/geo';
import type { MapSpec } from '@/lib/map/types';

/** Basemap-free drawing of pins and lines on the --well, used when the tile style cannot load. */
export function OfflineMap({ spec }: { spec: MapSpec }) {
  const b = boundsOf(fitPoints(spec));
  if (!b) return null;
  const W = 1000, H = 600, pad = 50;
  const dx = Math.max(b[1].lng - b[0].lng, 1e-4), dy = Math.max(b[1].lat - b[0].lat, 1e-4);
  const k = Math.min((W - pad * 2) / dx, (H - pad * 2) / dy);
  const x = (lng: number) => W / 2 + (lng - (b[0].lng + b[1].lng) / 2) * k;
  const y = (lat: number) => H / 2 - (lat - (b[0].lat + b[1].lat) / 2) * k;
  return (
    <svg data-map-offline viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Pins and routes without a basemap" preserveAspectRatio="xMidYMid meet">
      {spec.lines.map((l) => (
        <polyline
          key={l.id}
          fill="none"
          points={l.coords.map((c) => `${x(c.lng)},${y(c.lat)}`).join(' ')}
          stroke={l.style === 'route-pick' ? 'var(--accent)' : l.style === 'trail-unconfirmed' ? 'var(--muted)' : 'var(--ink)'}
          strokeWidth={l.style === 'route-pick' ? 4 : l.style === 'trail' || l.style === 'trail-unconfirmed' ? 3 : 2}
          strokeDasharray={l.style === 'straight-estimate' ? '5 5' : l.style === 'trail-unconfirmed' ? '7 5' : undefined}
          opacity={l.style === 'straight-estimate' ? 0.5 : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {spec.pins.map((p) => (
        <g key={p.id} transform={`translate(${x(p.at.lng)} ${y(p.at.lat)})`}>
          <circle r={p.style === 'stop' ? 4 : 11} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
          {p.number != null && p.style !== 'stop' && (
            <text textAnchor="middle" dy="4" fontSize="12" fontWeight="600" fill="var(--surface)" fontFamily="ui-monospace, monospace">{p.number}</text>
          )}
          {p.label && (
            <text y="-16" textAnchor="middle" fontSize="13" fill="var(--ink-2)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" fontFamily="ui-monospace, monospace">{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}
