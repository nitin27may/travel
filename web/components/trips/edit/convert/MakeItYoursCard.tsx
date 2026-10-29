'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import './convert.css';

export interface CardProps {
  /** our trip's name, when the catalogue knows it */
  ours: string | null;
  onPlaces: () => void;
  onDriving: () => void;
  onStart: () => void;
  onKeep: () => void;
}

/**
 * Make it yours (components 9.11; edit-mode-spec 2.2): a non-modal card inline above Day 1 on a new copy, never a sheet. Focus lands on its
 * heading when it appears. Three text buttons lead to the places picker and the two engine sections of Settings (which convert the copy
 * first); "Keep it as it is" dismisses it for good. After that it is a section of Settings and a row of the cover's `⋯`.
 */
export function MakeItYoursCard({ ours, onPlaces, onDriving, onStart, onKeep }: CardProps) {
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    head.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section className="myc" aria-labelledby="myc-h" data-testid="make-it-yours">
      <h3 id="myc-h" className="myc-h" tabIndex={-1} ref={head}>Make it yours</h3>
      <p className="myc-text">
        {ours ? `This is your copy of our ${ours} trip. ` : 'This is your copy. '}Change what you like; our trip stays as it is.
      </p>
      <div className="myc-links">
        <button type="button" className="myc-link" onClick={onPlaces}>Change places</button>
        <button type="button" className="myc-link" onClick={onDriving}>Your driving and pace</button>
        <button type="button" className="myc-link" onClick={onStart}>Where you start</button>
      </div>
      <Button variant="ghost" size="sm" className="myc-keep" onClick={onKeep}>Keep it as it is</Button>
    </section>
  );
}
