'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Icon, kindIcon } from '@/components/ui/Icon';
import type { GlobeEngine, MarkerSpec } from '@/lib/globe/engine';
import { clusterItems, isMerged, type Cluster, type ClusterItem } from '@/lib/globe/cluster';
import { colocationKey, discSize } from '@/lib/globe/model';
import { seaOffset } from '@/lib/globe/placement';
import type { PinModel } from '@/lib/globe/types';

interface Props {
  engine: GlobeEngine;
  pins: PinModel[];
  /** Card key of the selected place or trip. */
  selectedKey: string | null;
  interactive?: boolean;
  /** When given, a pin is a link (the home cover: a country pin goes to /globe/<cc>/). */
  hrefFor?: (p: PinModel) => string | null;
  /** Land test over the 110m countries: with it, a country disc sits on the sea beside its land (review S3). */
  isLand?: (lng: number, lat: number) => boolean;
  onOpen(p: PinModel): void;
}

const FAN_RADIUS = 44;

function ariaLabel(p: PinModel): string {
  if (p.kind === 'country' || p.kind === 'state' || p.kind === 'district') return `${p.label}, ${p.count} ${p.count === 1 ? 'item' : 'items'}. Fly in.`;
  return `${p.label}${p.kind === 'trip' ? ', trip' : p.glyph ? `, ${p.glyph.replace(/_/g, ' ')}` : ''}. Open details.`;
}

const isDisc = (p: PinModel): boolean => p.kind === 'country' || p.kind === 'state' || p.kind === 'district';
/** Radius in px of what a pin draws: half a disc, 13 for a trip, 9 for a place dot, 5 for a quiet dot. */
const radiusOf = (p: PinModel): number => (isDisc(p) ? discSize(p.count) / 2 : p.kind === 'trip' ? 13 : p.quiet ? 5 : 9);

interface PinButtonProps {
  pin: PinModel;
  active: boolean;
  interactive: boolean;
  count?: number;
  merged?: boolean;
  /** The label of a merged disc: its highest-draw member's. */
  mergedLabel?: string;
  dim?: boolean;
  href?: string | null;
  /** Roving tab stop for a row of link pins: only the first is in the Tab order, the arrow keys move between them. */
  tabIndex?: number;
  onOpen(): void;
}

function PinButton({ pin, active, interactive, count, merged, mergedLabel, dim, href, tabIndex, onOpen }: PinButtonProps) {
  const [hover, setHover] = useState(false);
  const n = count ?? pin.count;
  const disc = merged || pin.kind === 'country' || pin.kind === 'state' || pin.kind === 'district';
  const size = disc ? discSize(n) : pin.kind === 'trip' ? 26 : pin.quiet ? 10 : 18;
  const hot = active || hover;
  const label = merged ? `${mergedLabel ?? pin.label} and ${n - 1} more, ${n} items. Zoom in.` : ariaLabel(pin);
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
        data-dim={dim ? 'true' : undefined}
        style={{ width: size, height: size }}
        aria-label={merged ? `${mergedLabel ?? pin.label} and ${n - 1} more, ${n} items. Open the globe.` : `${pin.label}, ${n} ${n === 1 ? 'item' : 'items'}. Open on the globe.`}
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
      data-dim={dim ? 'true' : undefined}
      data-quiet={pin.quiet ? 'true' : undefined}
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

/** What the camera is at: enough to know the clusters have to be worked out again. */
const sig = (cs: Cluster[]): string => cs.map((c) => `${c.id}@${Math.round(c.x / 4)},${Math.round(c.y / 4)}`).join('|');

/**
 * Draws pins as DOM markers: ink discs at rest, amber only when hovered, focused or selected (tokens 5). Discs and pins that would
 * touch on screen merge into one disc with the summed count and the label of the highest-draw member (spec 6.5, relevance 6.4);
 * the merge is worked out after each camera move and every 100 ms during a flight. The engine owns the marker positions; React
 * renders each pin into its marker element.
 */
export function PinLayer({ engine, pins, selectedKey, interactive = true, hrefFor, isLand, onOpen }: Props) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [fan, setFan] = useState<string | null>(null);
  const [els, setEls] = useState<Map<string, HTMLElement>>(new Map());
  const stagger = useRef(false);
  const byId = useMemo(() => new Map(pins.map((p) => [p.id, p])), [pins]);

  // A new set of pins closes any open fan.
  const [seen, setSeen] = useState(pins);
  if (seen !== pins) { setSeen(pins); setFan(null); }

  const last = useRef('');
  const recompute = useMemo(() => {
    return () => {
      const items: ClusterItem[] = [];
      for (const p of pins) {
        const at = engine.project(p.lng, p.lat);
        if (at) items.push({ id: p.id, x: at.x, y: at.y, lng: p.lng, lat: p.lat, r: radiusOf(p), count: p.count, label: p.label, tier: p.tier, quiet: p.quiet });
      }
      // the home cover runs the same pass as /globe/ (review S4): two discs that would touch become one link to the globe
      const next = clusterItems(items);
      const key = sig(next);
      if (key === last.current) return;
      last.current = key;
      setClusters(next);
    };
  }, [engine, pins]);

  useEffect(() => {
    const map = engine.map;
    const first = window.setTimeout(recompute, 0);
    let timer = 0;
    // every 100 ms while the camera moves, and once more when it rests
    const tick = () => { if (!timer) timer = window.setTimeout(() => { timer = 0; recompute(); }, 100); };
    map.on('move', tick);
    map.on('moveend', recompute);
    map.on('resize', recompute);
    return () => { map.off('move', tick); map.off('moveend', recompute); map.off('resize', recompute); window.clearTimeout(timer); window.clearTimeout(first); };
  }, [engine, recompute]);

  const members = (c: Cluster): PinModel[] => c.items.map((i) => byId.get(i.id)).filter((p): p is PinModel => !!p);
  const colocated = (c: Cluster): boolean => new Set(members(c).map((p) => colocationKey(p))).size === 1;
  const clusterAt = (c: Cluster): { lng: number; lat: number } => (colocated(c) ? { lng: c.items[0].lng, lat: c.items[0].lat } : { lng: c.lng, lat: c.lat });

  /** The sea offset of a country disc: the direction is geographic, so it holds as the globe turns (and it is a few dozen bounding-box tests, so no cache). */
  const offsetOf = (c: Cluster): [number, number] | null => {
    const p = byId.get(c.id);
    if (!isLand || !p || p.kind !== 'country') return null;
    return seaOffset(p.lng, p.lat, isLand, discSize(p.count) / 2 + 8);
  };

  const specs = useMemo<MarkerSpec[]>(() => {
    const out: MarkerSpec[] = [];
    for (const c of clusters) {
      if (!isMerged(c)) { const off = offsetOf(c); out.push({ key: c.id, lng: c.lng, lat: c.lat, className: 'globe-marker', ...(off ? { offset: off } : {}) }); continue; }
      const at = clusterAt(c);
      out.push({ key: `g:${c.id}`, lng: at.lng, lat: at.lat, className: 'globe-marker' });
      if (fan === c.id) {
        c.items.forEach((it, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / c.items.length;
          out.push({ key: it.id, lng: at.lng, lat: at.lat, offset: [Math.cos(a) * FAN_RADIUS, Math.sin(a) * FAN_RADIUS], className: 'globe-marker globe-marker-fan' });
        });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clusterAt and offsetOf read `byId`, which changes with `pins`
  }, [clusters, fan, byId, isLand]);

  useLayoutEffect(() => {
    const made = engine.syncMarkers('pins', specs);
    // The first set of pins arrives staggered by latitude, north first, 15 ms apart (spec 8.3).
    if (!stagger.current && specs.length) { stagger.current = true; [...specs].sort((a, b) => b.lat - a.lat).forEach((sp, i) => made.get(sp.key)?.style.setProperty('--pin-d', `${Math.min(i, 40) * 15}ms`)); }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the marker elements exist only after the engine syncs them
    setEls(made);
  }, [engine, specs]);
  useLayoutEffect(() => () => { engine.syncMarkers('pins', []); }, [engine]);

  // The discs drawn here keep the map's own labels off them (collision boxes).
  useEffect(() => {
    engine.setDiscs(clusters.flatMap((c) => {
      const m = members(c);
      const disc = isMerged(c) || (m[0] && isDisc(m[0]));
      if (!disc) return [];
      // a disc moved onto the sea keeps the map's names off where it is drawn, not off the land it stands for
      const off = isMerged(c) ? null : offsetOf(c);
      const at = off ? engine.map.unproject([c.x + off[0], c.y + off[1]]) : null;
      return [{ lng: at ? at.lng : c.lng, lat: at ? at.lat : c.lat, size: discSize(c.count) }];
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `members` and `offsetOf` read `byId`
  }, [engine, clusters, byId, isLand]);
  useEffect(() => () => engine.setDiscs([]), [engine]);

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

  /** A merged disc zooms in by 1.5 around itself; one that cannot separate (the same spot, or already at the closest zoom) fans out. */
  const openMerged = (c: Cluster) => {
    const map = engine.map;
    if (colocated(c) || map.getZoom() >= 15.5) { setFan(fan === c.id ? null : c.id); return; }
    const at = clusterAt(c);
    map.easeTo({ center: [at.lng, at.lat], zoom: Math.min(16, map.getZoom() + 1.5), duration: 500 });
  };

  return (
    <>
      {clusters.flatMap((c) => {
        if (!isMerged(c)) {
          const p = byId.get(c.id);
          const el = els.get(c.id);
          return p && el ? [createPortal(<PinButton key={p.id} pin={p} active={!!selectedKey && p.cardKey === selectedKey} interactive={interactive} dim={p.dim} href={hrefFor?.(p)} tabIndex={hrefFor ? -1 : undefined} onOpen={() => onOpen(p)} />, el, p.id)] : [];
        }
        const out = [];
        const ms = members(c);
        const gel = els.get(`g:${c.id}`);
        if (gel && ms[0]) out.push(createPortal(<PinButton key={`g:${c.id}`} pin={ms[0]} active={ms.some((p) => !!selectedKey && p.cardKey === selectedKey)} interactive={interactive} merged mergedLabel={c.label} count={c.count} dim={ms.every((p) => p.dim)} href={hrefFor ? '/globe/' : undefined} tabIndex={hrefFor ? -1 : undefined} onOpen={() => openMerged(c)} />, gel, `g:${c.id}`));
        if (fan === c.id) {
          for (const p of ms) {
            const el = els.get(p.id);
            if (el) out.push(createPortal(<PinButton key={p.id} pin={p} active={!!selectedKey && p.cardKey === selectedKey} interactive={interactive} onOpen={() => { setFan(null); onOpen(p); }} />, el, p.id));
          }
        }
        return out;
      })}
    </>
  );
}
