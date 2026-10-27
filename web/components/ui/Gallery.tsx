'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Lightbox } from './Lightbox';
import { imageSrcSet, sizedImage } from '@/lib/format/image';
import type { PhotoCredit } from './Credits';
import { cx } from './cx';

export interface GalleryPhoto extends PhotoCredit {
  url: string;
  caption?: string;
  /** The gallery section the photo sits in; the lightbox says it beside the counter. */
  section?: string;
}

/** A section of a long gallery (the Photos tab): its heading, drawn before the tile at `from`. One lightbox still runs over every photo. */
export interface GallerySection {
  heading: ReactNode;
  from: number;
}

const creditLine = (p: GalleryPhoto) => [p.title, p.author, p.licence].filter(Boolean).join(' · ');
/** Grid of 16:10 tiles, 3 columns on desktop and 2 on phone; the credit shows on hover and focus (components 4.5); `creditAtRest` (the Photos tab, 6 or more photos) draws it under each tile always, author first (it truncates) and licence after (it never does). `sections` splits the grid under headings without splitting the lightbox. */
export function Gallery({ photos, className, creditAtRest = false, sections }: { photos: GalleryPhoto[]; className?: string; creditAtRest?: boolean; sections?: GallerySection[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  if (!photos.length) return null;
  const tile = (p: GalleryPhoto, i: number) => (
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
      {creditAtRest ? (
        <span className="gal-credit">
          <span className="gal-credit-by">{p.author}</span>
          <span className="gal-credit-sep" aria-hidden="true"> · </span>
          <span className="gal-credit-lic">{p.licence}</span>
        </span>
      ) : (
        <span className="gal-credit" aria-hidden="true">{creditLine(p)}</span>
      )}
    </li>
  );
  const cls = cx('gal', creditAtRest && 'gal-rest', className);
  const parts = sections?.length ? sections.map((s, k) => ({ s, to: sections[k + 1]?.from ?? photos.length })) : null;
  return (
    <>
      {parts ? (
        parts.map(({ s, to }, k) => (
          <section key={k} className="ph-group" aria-labelledby={`ph-g-${k}`}>
            {s.heading}
            <ul className={cls}>{photos.slice(s.from, to).map((p, j) => tile(p, s.from + j))}</ul>
          </section>
        ))
      ) : (
        <ul className={cls}>{photos.map(tile)}</ul>
      )}
      <Lightbox photos={photos} index={open} onIndexChange={setOpen} finalFocus={opener} />
    </>
  );
}
