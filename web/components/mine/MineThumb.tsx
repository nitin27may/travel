'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { useThumb } from '@/lib/mine/thumb';
import './mine-thumb.css';

interface Props {
  space: 'place' | 'trip';
  slug: string;
  /** A photo path the item already holds (a copy's snapshot). Otherwise the page's own small card file is asked as the row nears the screen. */
  known?: string | null;
  /** No lookup and no photo (a page no longer listed). */
  off?: boolean;
  /** The icon that stands in until a photo arrives, and when there is none. */
  icon: IconName;
  /** Grid area in the row. */
  area?: string;
}

/**
 * The thumbnail of a Mine row, the same for My trips and Favourites (owner, 27 Oct 2026): a fixed 4:3 box, a decorative lazy image from
 * our own rendition (alt "": the name sits beside it), and the type icon when there is no photo. Never Commons (P8, P9).
 */
export function MineThumb({ space, slug, known, off, icon, area }: Props) {
  const { box, thumb } = useThumb(space, slug, known, !off);
  const [broken, setBroken] = useState(false);
  const shown = !!thumb && !broken && !off;
  return (
    <span className="mthumb" ref={box} data-missing={shown ? undefined : ''} style={area ? { gridArea: area } : undefined} aria-hidden="true">
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element -- a same-origin rendition from the build's image step
        <img src={thumb.src} srcSet={thumb.srcSet} sizes="56px" alt="" width={56} height={42} loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <Icon name={icon} size={22} />
      )}
    </span>
  );
}
