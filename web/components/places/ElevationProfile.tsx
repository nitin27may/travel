'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { usePrefs } from '@/lib/format/prefs';
import { formatElevation } from '@/lib/format/units';
import type { LngLat } from '@/lib/map/types';
import { elevationAt, lerpPoint, profileSummary, profileTicks, sampleProfile, type ProfileInput } from './model';
import { usePlaceShell } from './PlaceShell';

const W = 640;
const H = 170;
const L = 46;
const R = 26;
const T = 12;
const B = 28;

interface Props extends ProfileInput {
  /** Straight-line guide for the map marker: trailhead to destination. Null for loops and when only one point is stored. */
  guide: { from: LngLat; to: LngLat } | null;
}

/**
 * Elevation profile (components 4.4): `--ink` line with a 10% area, nothing amber at rest. Scrubbing (pointer or arrow
 * keys) shows the one amber element, a vertical cursor with a dot and a readout, and moves the map marker.
 */
export function ElevationProfile({ guide, ...input }: Props) {
  const pts = useMemo(() => sampleProfile(input), [input.km, input.gainM, input.startM, input.loop, input.highM]); // eslint-disable-line react-hooks/exhaustive-deps
  const { setCursor } = usePlaceShell();
  const [prefs] = usePrefs();
  const [at, setAt] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const id = useId();

  const ys = pts.map((p) => p.m);
  const lo = Math.floor(Math.min(...ys) / 100) * 100;
  const hiRaw = Math.ceil(Math.max(...ys) / 100) * 100;
  const hi = hiRaw > lo ? hiRaw : lo + 100;
  const maxX = input.km;
  const X = (x: number) => L + (x / maxX) * (W - L - R);
  const Y = (y: number) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.km).toFixed(1)},${Y(p.m).toFixed(1)}`).join('');
  const ticks = profileTicks(lo, hi, maxX, prefs.distance, prefs.elevation);
  const label = `Sketch of the elevation profile. ${profileSummary(pts)}.`;

  const move = (km: number | null) => {
    setAt(km);
    if (km === null || !guide) setCursor(null);
    else setCursor(lerpPoint(guide.from, guide.to, Math.min(1, km / maxX)));
  };
  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * W;
    move(Math.max(0, Math.min(maxX, ((x - L) / (W - L - R)) * maxX)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const stepKm = maxX / 24;
    if (e.key === 'ArrowRight') move(Math.min(maxX, (at ?? 0) + stepKm));
    else if (e.key === 'ArrowLeft') move(Math.max(0, (at ?? 0) - stepKm));
    else if (e.key === 'Escape') move(null);
    else return;
    e.preventDefault();
  };

  const cursorM = at === null ? null : elevationAt(pts, at);
  return (
    <figure className="pl-profile">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        aria-describedby={`${id}-hint`}
        tabIndex={0}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => move(null)}
        onBlur={() => move(null)}
        onKeyDown={onKey}
      >
        {ticks.y.map((t) => (
          <g key={t.label}>
            <line x1={L} x2={W - R} y1={Y(t.at)} y2={Y(t.at)} className="pl-grid" />
            <text x={L - 6} y={Y(t.at) + 4} textAnchor="end" className="pl-tick">
              {t.label}
            </text>
          </g>
        ))}
        {ticks.x.map((t) => (
          <text key={t.label} x={X(t.at)} y={H - 8} textAnchor="middle" className="pl-tick">
            {t.label}
          </text>
        ))}
        <path d={`${line}L${X(maxX)},${Y(lo)}L${X(0)},${Y(lo)}Z`} className="pl-area" />
        <path d={line} className="pl-line" />
        {at !== null && cursorM !== null ? (
          <g className="pl-cursor">
            <line x1={X(at)} x2={X(at)} y1={T} y2={H - B} />
            <circle cx={X(at)} cy={Y(cursorM)} r={4} />
          </g>
        ) : null}
      </svg>
      <figcaption>
        <span className="pl-readout num" aria-live="off">
          {at !== null && cursorM !== null ? `${(prefs.distance === 'mi' ? at / 1.609344 : at).toFixed(1)} ${prefs.distance} · ${formatElevation(Math.round(cursorM), prefs.elevation)}` : ' '}
        </span>
        <span id={`${id}-hint`} className="muted small">
          A sketch from the published distance and climb, not a surveyed track.
          {guide ? ' The map marker follows a straight line from the trailhead.' : ' Hover or use the arrow keys to read it.'}
        </span>
      </figcaption>
    </figure>
  );
}
