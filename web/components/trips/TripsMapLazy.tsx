'use client';

import dynamic from 'next/dynamic';

// The Trips map loads when the Map view is first opened (list JS budget). It lives in its own client file so the Trips descriptor can be
// imported by server code, the API's list engine included (a server module may not call dynamic() with ssr: false).
export const TripsMapLazy = dynamic(() => import('@/components/trips/TripsMap').then((m) => m.TripsMap), { ssr: false });
