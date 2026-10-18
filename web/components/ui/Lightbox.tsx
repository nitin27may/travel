'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';
import { Button } from './Button';
import type { GalleryPhoto } from './Gallery';
import { Icon } from './Icon';
import { sizedImage } from '@/lib/format/image';

interface Props {
  photos: GalleryPhoto[];
  /** Null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  finalFocus?: RefObject<HTMLElement | null>;
}

/**
 * Full-screen viewer on a `--header` background (components 4.5): image letterboxed, caption with the credit line
 * and linked licence, previous/next 48 px buttons, close, counter "4 / 42". Arrows and Esc; swipe on phone; focus trapped.
 * Open and close are a 200 ms fade and scale; the shared-element move from the tile is not built.
 */
export function Lightbox({ photos, index, onIndexChange, finalFocus }: Props) {
  const swipe = useRef<number | null>(null);
  const open = index !== null;
  // keep showing the last photo while the closing transition runs
  const [last, setLast] = useState(0);
  if (index !== null && index !== last) setLast(index);
  const i = index ?? last;
  const photo = photos[i];
  const go = (n: number) => onIndexChange((n + photos.length) % photos.length);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
  };
  const onDown = (e: PointerEvent) => {
    swipe.current = e.clientX;
  };
  const onUp = (e: PointerEvent) => {
    if (swipe.current === null) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? i + 1 : i - 1);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Popup className="lightbox" aria-roledescription="carousel" aria-label="Photo viewer" finalFocus={finalFocus} onKeyDown={onKey}>
          {photo ? (
            <>
              <Dialog.Close className="lb-close btn btn-icon" aria-label="Close viewer">
                <Icon name="close" size={18} />
              </Dialog.Close>
              <div className="lb-stage" onPointerDown={onDown} onPointerUp={onUp} aria-roledescription="slide" aria-label={`${i + 1} of ${photos.length}`}>
                <Button className="lb-nav" variant="ghost" icon aria-label="Previous photo" onClick={() => go(i - 1)}>
                  <Icon name="chevronLeft" size={22} />
                </Button>
                {/* eslint-disable-next-line @next/next/no-img-element -- static export, remote Commons URLs */}
                <img src={sizedImage(photo.url, 1600)} alt={photo.caption ?? ''} draggable={false} />
                <Button className="lb-nav" variant="ghost" icon aria-label="Next photo" onClick={() => go(i + 1)}>
                  <Icon name="chevronRight" size={22} />
                </Button>
              </div>
              <div className="lb-caption">
                <Dialog.Title className="lb-title">{photo.caption ?? photo.title ?? 'Photo'}</Dialog.Title>
                <p className="lb-credit">
                  {photo.author} &middot;{' '}
                  {photo.licenceUrl ? (
                    <a href={photo.licenceUrl} target="_blank" rel="noopener noreferrer">
                      {photo.licence}
                    </a>
                  ) : (
                    photo.licence
                  )}
                  {photo.sourceUrl ? (
                    <>
                      {' '}
                      &middot;{' '}
                      <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">
                        Source
                      </a>
                    </>
                  ) : null}{' '}
                  &middot; <span aria-live="polite">{i + 1} / {photos.length}</span>
                </p>
              </div>
            </>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
