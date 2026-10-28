'use client';

import { useEffect, useState } from 'react';

/** True while the media query matches; false before the first read (the server and the first paint). */
export function useMatchMedia(query: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(query);
    const read = () => setOn(q.matches);
    read();
    q.addEventListener('change', read);
    return () => q.removeEventListener('change', read);
  }, [query]);
  return on;
}
/** The phone breakpoint of the foundation: under 640 px. */
export const usePhone = (): boolean => useMatchMedia('(max-width: 639px)');
