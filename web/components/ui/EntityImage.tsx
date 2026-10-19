'use client';

import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { imageSrcSet, sizedImage } from '@/lib/format/image';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface Props {
  src: string | null;
  width: number;
  fallbackIcon: IconName;
  /** Short text shown with the glyph, e.g. the kind. */
  fallbackLabel?: string;
  /** Where the subject sits in the photo, 0 to 100 on each axis (components 3.1: focus point from data). */
  focus?: { x: number; y: number };
  className?: string;
  /** Intrinsic height for the width/height pair (layout is set by the container; this only reserves the ratio). Default 16:10. */
  height?: number;
  /** The largest image on the page (a hero, the first card): load now, with high fetch priority. */
  priority?: boolean;
  /** Above the fold but not the largest: load now, normal priority. */
  eager?: boolean;
  /** How wide the box is at each breakpoint, for the browser's pick from the 320, 640 and 960 px renditions. Default: `width` px. */
  sizes?: string;
}

/**
 * Lazy image. With no image, or when it fails to load, the kind glyph (22 px ink) sits on `--well`
 * (components 3.1). Decorative: the card title next to it carries the meaning.
 */
export function EntityImage({ src, width, fallbackIcon, fallbackLabel, focus, className, height, priority, eager, sizes }: Props) {
  const [failed, setFailed] = useState(false);
  // An image that failed before hydration never fires onError on the client; catch it on mount.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (!src || failed) {
    return (
      <div className={`img-fallback ${className ?? ''}`} aria-hidden="true">
        <Icon name={fallbackIcon} size={22} />
        {fallbackLabel ? <span>{fallbackLabel}</span> : null}
      </div>
    );
  }
  const style: CSSProperties | undefined = focus ? { objectPosition: `${focus.x}% ${focus.y}%` } : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, remote Commons URLs
    <img ref={ref} src={sizedImage(src, width)} srcSet={imageSrcSet(src)} sizes={sizes ?? `${width}px`} alt="" width={width} height={height ?? Math.round(width * 0.625)} loading={priority || eager ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" className={className} style={style} onError={() => setFailed(true)} />
  );
}
