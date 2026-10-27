'use client';

import { useEffect, useRef, useState } from 'react';
import { sizedImage } from '@/lib/format/image';

/**
 * The thumbnail of a Mine row (owner, 27 Oct 2026). A favourite is a slug on the device, so its photo is looked up from the one small
 * card file the globe already builds for that page (`DataClient.globeCard`: same-origin, one file per item, the build's own rendition
 * of the same photo the public cards show; P8, P9). Nothing is asked until the row nears the screen, and never from Commons.
 * `null` means no photo: the row keeps its type icon.
 */
export interface Thumb {
  src: string;
  srcSet: string | undefined;
}

/** A rendition that is ours (`/img/<key>-<w>.webp`) as a 320/640 pair; anything else (a source URL left by a build with no image step) is no photo. */
export function thumbOf(url: string | null | undefined): Thumb | null {
  if (!url || !url.startsWith('/img/')) return null;
  const small = sizedImage(url, 320);
  const large = sizedImage(url, 640);
  return { src: small, srcSet: small !== large ? `${small} 320w, ${large} 640w` : undefined };
}

const seen = new Map<string, Promise<Thumb | null>>();

/** The thumbnail for `space:slug`, or null. Cached for the page view. */
export function lookupThumb(space: 'place' | 'trip', slug: string): Promise<Thumb | null> {
  const key = `${space}:${slug}`;
  let p = seen.get(key);
  if (!p) {
    p = import('@/lib/client/data')
      .then((m) => m.globeCard(key))
      .then((f) => thumbOf(f?.card.image?.url))
      .catch(() => null);
    seen.set(key, p);
  }
  return p;
}

/**
 * The row's thumbnail once it is near the viewport. `known` is a path the row already holds (a copy's snapshot photo) and needs no lookup.
 * Returns the ref to put on the thumbnail box and the picture, or null while unknown or when there is none.
 */
export function useThumb(space: 'place' | 'trip', slug: string, known?: string | null, enabled = true) {
  const box = useRef<HTMLSpanElement | null>(null);
  const [thumb, setThumb] = useState<Thumb | null>(() => thumbOf(known))
  const shown = enabled ? thumb : null;
  useEffect(() => {
    if (!enabled || thumbOf(known)) return;
    const el = box.current;
    if (!el) return;
    let live = true;
    const ask = () => void lookupThumb(space, slug).then((t) => live && setThumb(t));
    if (typeof IntersectionObserver === 'undefined') {
      ask();
      return () => {
        live = false;
      };
    }
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          io.disconnect();
          ask();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [space, slug, known, enabled]);
  return { box, thumb: shown };
}
