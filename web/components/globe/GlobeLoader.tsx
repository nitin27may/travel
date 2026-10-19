'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { globeTree } from '@/lib/client/data';
import { newGlobeData } from '@/lib/globe/store';
import type { GlobeData } from '@/lib/globe/types';

// The halo disc is the placeholder (spec 8.3): it is in the static HTML, so the world's shape shows within 300 ms, before any script.
const Loading = () => (
  <div className="globe-root">
    <div className="globe-halo" aria-hidden="true" />
    <div className="globe-canvas"><div className="globe-loading" aria-live="polite">Loading globe</div></div>
  </div>
);

// The globe is browser-only and heavy: it stays out of the page's first scripts (the JS budget test) and loads after hydration.
const GlobeShell = dynamic(() => import('./GlobeShell').then((m) => m.GlobeShell), { ssr: false, loading: Loading });

/** Fetches the area tree (small: counts and a centre per country), then hands the shell an empty store that fills as areas open. */
export function GlobeLoader() {
  const [data, setData] = useState<GlobeData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    globeTree().then((t) => live && setData(newGlobeData(t))).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);
  if (failed) {
    return (
      <div className="globe-root">
        <div className="globe-halo" aria-hidden="true" />
        <div className="globe-canvas"><div className="globe-loading" role="alert">The globe could not load its places. Reload the page to try again.</div></div>
      </div>
    );
  }
  return data ? <GlobeShell data={data} /> : <Loading />;
}
