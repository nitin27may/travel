'use client';

import dynamic from 'next/dynamic';
import type { GalleryPhoto } from '@/components/ui/Gallery';

// The lightbox (a dialog primitive) loads only when a place has photos, and after the page is interactive.
const Gallery = dynamic(() => import('@/components/ui/Gallery').then((m) => m.Gallery), {
  ssr: false,
  loading: () => <p className="muted small">Loading photos</p>,
});

export function GalleryLazy({ photos }: { photos: GalleryPhoto[] }) {
  return <Gallery photos={photos} />;
}
