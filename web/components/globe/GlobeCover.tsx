'use client';

import { useEffect, useRef, useState } from 'react';
import type { GlobeEngine } from '@/lib/globe/engine';
import type { GlobeData } from '@/lib/globe/types';
import '@/styles/globe.css';
import { GlobeCanvas } from './GlobeCanvas';

interface Props {
  /** From `buildGlobeData()` in `@/lib/globe/data`, called in a server component. */
  data: GlobeData;
  className?: string;
  label?: string;
}

/**
 * The globe as a cover picture (the home page). It loads after the page is idle and in view, spins slowly
 * (not at all under reduced motion, and paused while hovered or focused), never takes the scroll wheel or the
 * keyboard, and draws a pin per country that links to /globe/<cc>/.
 */
export function GlobeCover({ data, className = '', label = 'Globe of saved places and published trips' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [go, setGo] = useState(false);
  const engine = useRef<GlobeEngine | null>(null);
  const visible = useRef(true);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle = 0;
    const start = () => {
      const run = () => setGo(true);
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(run, { timeout: 2500 });
      else timer = setTimeout(run, 1200);
    };
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); } });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); if (idle) window.cancelIdleCallback(idle); };
  }, []);

  // Off screen the spin loop stops altogether; it resumes when the cover scrolls back in.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => { for (const e of entries) { visible.current = e.isIntersecting; engine.current?.setActive(e.isIntersecting); } });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pause = (on: boolean) => engine.current?.setSpin(!on, true);

  return (
    <div
      ref={host}
      className={`globe-cover ${className}`}
      onPointerEnter={() => pause(true)}
      onPointerLeave={() => pause(false)}
      onFocus={() => pause(true)}
      onBlur={() => pause(false)}
    >
      {go ? (
        <GlobeCanvas mode="cover" data={data} label={label} onEngine={(e) => { engine.current = e; e?.setActive(visible.current); }} />
      ) : (
        <div className="globe-canvas" data-globe-mode="cover"><div className="globe-loading">Loading globe</div></div>
      )}
    </div>
  );
}
