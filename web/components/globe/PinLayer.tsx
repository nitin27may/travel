'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Icon, kindIcon } from '@/components/ui/Icon';
import type { GlobeEngine, MarkerSpec } from '@/lib/globe/engine';
import { discSize, groupColocated, type Group } from '@/lib/globe/model';
import type { PinModel } from '@/lib/globe/types';

interface Props {
  engine: GlobeEngine;
  pins: PinModel[];
  /** Card key of the selected place or trip. */
  selectedKey: string | null;
  interactive?: boolean;
  /** When given, a pin is a link (the home cover: a country pin goes to /globe/<cc>/). */
  hrefFor?: (p: PinModel) => string | null;
  onOpen(p: PinModel): void;
}

const FAN_RADIUS = 44;
const total = (g: Group) => g.pins.reduce((s, p) => s + p.count, 0);

function ariaLabel(p: PinModel): string {
  if (p.kind === 'country' || p.kind === 'state' || p.kind === 'district') return `${p.label}, ${p.count} ${p.count === 1 ? 'item' : 'items'}. Fly in.`;
  return `${p.label}${p.kind === 'trip' ? ', trip' : p.glyph ? `, ${p.glyph.replace(/_/g, ' ')}` : ''}. Open details.`;
}

interface PinButtonProps {
  pin: PinModel;
  active: boolean;
  interactive: boolean;
  count?: number;
  merged?: boolean;
  href?: string | null;
  /** Roving tab stop for a row of link pins: only the first is in the Tab order, the arrow keys move between them. */
  tabIndex?: number;
  onOpen(): void;
}

function PinButton({ pin, active, interactive, count, merged, href, tabIndex, onOpen }: PinButtonProps) {
  const [hover, setHover] = useState(false);
  const n = count ?? pin.count;
  const disc = merged || pin.kind === 'country' || pin.kind === 'state' || pin.kind === 'district';
  const size = disc ? discSize(n) : pin.kind === 'trip' ? 26 : 14;
  const hot = active || hover;
  const label = merged ? `${n} items here. Show them.` : ariaLabel(pin);
  const content = disc ? <span className="globe-pin-n">{n}</span> : pin.kind === 'trip' ? <Icon name="route" size={14} /> : null;
  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        tabIndex={tabIndex}
        onKeyDown={(e) => {
          const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
          if (!dir) return;
          // pins on the far side of the globe are culled (visibility hidden) and cannot take focus: skip them
          const all = [...(e.currentTarget.closest('.globe-canvas')?.querySelectorAll<HTMLAnchorElement>('a[data-globe-pin]') ?? [])];
          const here = all.indexOf(e.currentTarget);
          let next: HTMLAnchorElement | undefined;
          for (let i = 1; i <= all.length && !next; i++) {
            const cand = all[(here + dir * i + all.length * i) % all.length];
            if (cand && getComputedStyle(cand).visibility !== 'hidden') next = cand;
          }
          if (next && next !== e.currentTarget) { e.preventDefault(); all.forEach((a) => { a.tabIndex = -1; }); next.tabIndex = 0; next.focus(); }
        }}
        className="globe-pin"
        data-globe-pin=""
        data-kind={disc ? 'disc' : pin.kind}
        data-hot={hot ? 'true' : undefined}
        style={{ width: size, height: size }}
        aria-label={`${pin.label}, ${n} ${n === 1 ? 'item' : 'items'}. Open on the globe.`}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        {content}
      </Link>
    );
  }
  if (!interactive) {
    return <span className="globe-pin" data-kind={disc ? 'disc' : pin.kind} data-globe-pin="" style={{ width: size, height: size }} aria-hidden="true">{content}</span>;
  }
  return (
    <button
      type="button"
      className="globe-pin"
      data-globe-pin=""
      data-kind={disc ? 'disc' : pin.kind}
      data-hot={hot ? 'true' : undefined}
      data-active={active ? 'true' : undefined}
      style={{ width: size, height: size }}
      aria-label={label}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
    >
      {content}
      {!disc ? (
        <span className="globe-pin-tag" data-show={hot ? 'true' : undefined}>
          {pin.kind === 'place' ? <Icon name={kindIcon(pin.glyph ?? '')} size={13} /> : null}
          {pin.label}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Draws pins as DOM markers: ink discs at rest, amber only when hovered, focused or selected (tokens 5).
 * The engine owns the marker positions; React renders each pin into its marker element.
 */
export function PinLayer({ engine, pins, selectedKey, interactive = true, hrefFor, onOpen }: Props) {
  const groups = useMemo(() => groupColocated(pins), [pins]);
  const [fan, setFan] = useState<string | null>(null);
  const [els, setEls] = useState<Map<string, HTMLElement>>(new Map());

  // A new set of pins closes any open fan.
  const [seen, setSeen] = useState(pins);
  if (seen !== pins) { setSeen(pins); setFan(null); }

  const specs = useMemo<MarkerSpec[]>(() => {
    const out: MarkerSpec[] = [];
    for (const g of groups) {
      if (g.pins.length === 1) { out.push({ key: g.pins[0].id, lng: g.at[0], lat: g.at[1], className: 'globe-marker' }); continue; }
      out.push({ key: `g:${g.key}`, lng: g.at[0], lat: g.at[1], className: 'globe-marker' });
      if (fan === g.key) {
        g.pins.forEach((p, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / g.pins.length;
          out.push({ key: p.id, lng: g.at[0], lat: g.at[1], offset: [Math.cos(a) * FAN_RADIUS, Math.sin(a) * FAN_RADIUS], className: 'globe-marker globe-marker-fan' });
        });
      }
    }
    return out;
  }, [groups, fan]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the marker elements exist only after the engine syncs them
  useLayoutEffect(() => { setEls(engine.syncMarkers('pins', specs)); }, [engine, specs]);
  useLayoutEffect(() => () => { engine.syncMarkers('pins', []); }, [engine]);

  // A row of link pins (the home cover) is one Tab stop: the first pin that can take focus. The engine hides pins on the far
  // side of the globe, so the stop moves whenever the set of visible pins changes.
  useEffect(() => {
    if (!hrefFor) return;
    const box = engine.map.getContainer();
    const settle = () => {
      const all = [...box.querySelectorAll<HTMLAnchorElement>('a[data-globe-pin]')];
      const usable = (a: HTMLAnchorElement) => getComputedStyle(a).visibility !== 'hidden';
      const keep = all.find((a) => a === document.activeElement && usable(a)) ?? all.find((a) => a.tabIndex === 0 && usable(a)) ?? all.find(usable);
      for (const a of all) a.tabIndex = a === keep ? 0 : -1;
    };
    settle();
    box.addEventListener('globe-culled', settle);
    return () => box.removeEventListener('globe-culled', settle);
  }, [engine, hrefFor, els]);

  return (
    <>
      {groups.flatMap((g) => {
        if (g.pins.length === 1) {
          const p = g.pins[0];
          const el = els.get(p.id);
          return el ? [createPortal(<PinButton key={p.id} pin={p} active={!!selectedKey && p.cardKey === selectedKey} interactive={interactive} href={hrefFor?.(p)} tabIndex={hrefFor ? -1 : undefined} onOpen={() => onOpen(p)} />, el, p.id)] : [];
        }
        const out = [];
        const gel = els.get(`g:${g.key}`);
        if (gel) out.push(createPortal(<PinButton key={`g:${g.key}`} pin={g.pins[0]} active={g.pins.some((p) => !!selectedKey && p.cardKey === selectedKey)} interactive={interactive} merged count={total(g)} onOpen={() => setFan(fan === g.key ? null : g.key)} />, gel, `g:${g.key}`));
        if (fan === g.key) {
          for (const p of g.pins) {
            const el = els.get(p.id);
            if (el) out.push(createPortal(<PinButton key={p.id} pin={p} active={!!selectedKey && p.cardKey === selectedKey} interactive={interactive} onOpen={() => { setFan(null); onOpen(p); }} />, el, p.id));
          }
        }
        return out;
      })}
    </>
  );
}
