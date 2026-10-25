'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The card's one polite live region (review M2, WCAG 4.1.3). Field errors and notice lines arrive inside nodes that are not live,
 * and a status node that is inserted with its text already in it is often skipped by NVDA and VoiceOver. So every new message
 * (an error, a notice, a resend, the end of a wait) is written here instead: the region is mounted empty with the card, cleared,
 * then filled on the next tick, so the same message twice is read twice. Urgent banners keep `role="alert"` and are not repeated.
 */
export function useAnnouncer(): { region: React.ReactNode; announce: (message: string) => void } {
  const [text, setText] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const announce = useCallback((message: string) => {
    window.clearTimeout(timer.current);
    setText('');
    timer.current = window.setTimeout(() => setText(message), 60);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const region = (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {text}
    </p>
  );
  return { region, announce };
}

/** Whole seconds left until `until` (ms since epoch), re-rendering once a second while it runs; 0 when it has passed. */
export function useCountdown(until: number, onDone?: () => void): number {
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  const running = left > 0;
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    // Re-read the clock at once (a new wait starts from the real time, not from the last tick), then once a second.
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    if (!running) return () => window.clearTimeout(first);
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) {
        window.clearInterval(t);
        done.current?.();
      }
    }, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [running, until]);
  return left;
}

/** "0:42" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The time left in a button label: "0:42" up to 10 minutes, then "15 min" (review M3). */
export function timeLeft(seconds: number): string {
  return seconds <= 600 ? clock(seconds) : `${Math.ceil(seconds / 60)} min`;
}
