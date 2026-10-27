'use client';

import { useRef, useState } from 'react';
import { Lightbox } from './Lightbox';
import { imageSrcSet, sizedImage } from '@/lib/format/image';
import type { PhotoCredit } from './Credits';
import { cx } from './cx';

export interface GalleryPhoto extends PhotoCredit {
  url: string;
  caption?: string;
}

const creditLine = (p: GalleryPhoto) => [p.title, p.author, p.licence].filter(Boolean).join(' · ');
/** The line under a tile at rest (the Photos tab): the title is the lightbox's, so the line is who made it and under what licence. */
const restLine = (p: GalleryPhoto) => [p.author, p.licence].filter(Boolean).join(' · ');

/** Grid of 16:10 tiles, 3 columns on desktop and 2 on phone; the credit shows on hover and focus (components 4.5); `creditAtRest` (the Photos tab, 6 or more photos) draws it under each tile always. */
export function Gallery({ photos, className, creditAtRest = false }: { photos: GalleryPhoto[]; className?: string; creditAtRest?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <ul className={cx('gal', creditAtRest && 'gal-rest', className)}>
        {photos.map((p, i) => (
          <li key={`${p.url}-${i}`} className="gal-item">
            <button
              type="button"
              className="gal-tile"
              aria-label={`Open photo ${i + 1} of ${photos.length}${p.caption ? `: ${p.caption}` : ''}`}
              onClick={(e) => {
                opener.current = e.currentTarget;
                setOpen(i);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static export, remote Commons URLs */}
              <img src={sizedImage(p.url, 560)} srcSet={imageSrcSet(p.url)} sizes="(max-width: 639px) 46vw, 24vw" alt="" width={640} height={400} loading="lazy" decoding="async" />
            </button>
            {/* the credit sits beside the button, not inside it: a control's name must contain the text it shows (axe label-content-name-mismatch) */}
            {creditAtRest ? <span className="gal-credit">{restLine(p)}</span> : <span className="gal-credit" aria-hidden="true">{creditLine(p)}</span>}
          </li>
        ))}
      </ul>
      <Lightbox photos={photos} index={open} onIndexChange={setOpen} finalFocus={opener} />
    </>
  );
}
