'use client';

import dynamic from 'next/dynamic';

// The Map view loads when first opened, so the list's first load stays inside the JS budget. It lives in its own client file so the
// Places descriptor can be imported by the build that writes the row files (a server module may not call dynamic() with ssr: false).
export const PlacesMapLazy = dynamic(() => import('@/components/places/PlacesMap').then((m) => m.PlacesMap), { ssr: false, loading: () => <p className="muted">Loading map</p> });
