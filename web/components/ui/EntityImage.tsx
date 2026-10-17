'use client';

import { useCallback, useState } from 'react';
import { sizedImage } from '@/lib/format/image';
import { Icon } from './Icon';
import type { IconName } from './Icon';

interface Props {
  src: string | null;
  width: number;
  fallbackIcon: IconName;
  /** Short text shown on the tinted placeholder, e.g. the kind. */
  fallbackLabel?: string;
  className?: string;
}

/**
 * Lazy image with a tinted placeholder (icon plus label) when there is no image or it fails to load.
 * Decorative: the card title next to it carries the meaning.
 */
export function EntityImage({ src, width, fallbackIcon, fallbackLabel, className }: Props) {
  const [failed, setFailed] = useState(false);
  // An image that failed before hydration never fires onError on the client; catch it on mount.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (!src || failed) {
    return (
      <div className={`img-fallback ${className ?? ''}`} aria-hidden="true">
        <Icon name={fallbackIcon} size={34} />
        {fallbackLabel ? <span>{fallbackLabel}</span> : null}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, remote Commons URLs
    <img ref={ref} src={sizedImage(src, width)} alt="" loading="lazy" decoding="async" className={className} onError={() => setFailed(true)} />
  );
}
