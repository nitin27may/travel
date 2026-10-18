'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { PlaceMap as PlaceMapType } from './PlaceMap';

// Keeps the map wrapper and its family logic out of the page's first load (JS budget); the map is below the fold on phones.
const PlaceMap = dynamic(() => import('./PlaceMap').then((m) => m.PlaceMap), {
  ssr: false,
  loading: () => (
    <div role="status" className="pl-map-loading">
      Loading map
    </div>
  ),
});

export function PlaceMapLazy(props: ComponentProps<typeof PlaceMapType>) {
  return <PlaceMap {...props} />;
}
