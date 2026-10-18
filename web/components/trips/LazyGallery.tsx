'use client';

import dynamic from 'next/dynamic';

/** The photo grid and its lightbox sit at the foot of the page; they load after the first paint so the trip page stays inside the JS budget. */
export const LazyGallery = dynamic(() => import('@/components/ui/Gallery').then((m) => m.Gallery), {
  ssr: false,
  loading: () => <p className="trip-sec-note">Loading photos</p>,
});
