'use client';

import dynamic from 'next/dynamic';
import type { GlobeData } from '@/lib/globe/types';

// The globe is browser-only and heavy: it stays out of the page's first scripts (the JS budget test) and loads after hydration.
const GlobeShell = dynamic(() => import('./GlobeShell').then((m) => m.GlobeShell), {
  ssr: false,
  loading: () => (
    <div className="globe-root">
      <div className="globe-canvas"><div className="globe-loading" aria-live="polite">Loading globe</div></div>
    </div>
  ),
});

export function GlobeLoader({ data }: { data: GlobeData }) {
  return <GlobeShell data={data} />;
}
