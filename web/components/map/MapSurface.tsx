'use client';

import dynamic from 'next/dynamic';
import { forwardRef, useContext, type Ref } from 'react';
import { resolveFamily } from '@/lib/map/family';
import type { CameraState, MapFamily, MapHandle, MapSpec } from '@/lib/map/types';
import { FamilyContext } from './family-context';
import { Well } from './MapChrome';
import { useFamilyGuard } from './useFamilyGuard';

const Loading = () => (
  <div
    role="status"
    className="flex min-h-[320px] items-center justify-center rounded-xl border font-mono text-[12px]"
    style={{ background: 'var(--well)', borderColor: 'var(--line)', color: 'var(--muted)' }}
  >
    Loading map
  </div>
);

// Each family is its own client chunk, so MapLibre is never in the first-load JS of a page without a map.
const MapLibreMap = dynamic(() => import('./MapLibreMap'), { ssr: false, loading: Loading });
const GoogleJsMap = dynamic(() => import('./GoogleJsMap'), { ssr: false, loading: Loading });
const GoogleEmbedMap = dynamic(() => import('./GoogleEmbedMap'), { ssr: false, loading: Loading });

export interface MapSurfaceProps {
  spec: MapSpec;
  /** Defaults to the provider's family, else maplibre. */
  family?: MapFamily;
  label: string;
  onSelect?: (id: string | null) => void;
  onCamera?: (c: CameraState) => void;
  className?: string;
}

export class MixedFamilyError extends Error {
  constructor(msg: string) { super(msg); this.name = 'MixedFamilyError'; }
}

export const MapSurface = forwardRef<MapHandle, MapSurfaceProps>(function MapSurface({ spec, family, label, onSelect, onCamera, className }, ref) {
  const page = useContext(FamilyContext);
  const resolved = resolveFamily(family ?? page ?? 'maplibre');
  const others = useFamilyGuard(resolved);

  const clash = page && family && resolveFamily(family) !== page
    ? `MapSurface wants ${resolveFamily(family)} but this page's MapFamilyProvider is ${page}.`
    : others.length
      ? `This page mixes map families (${[resolved, ...others].join(' + ')}).`
      : null;
  if (clash) {
    const msg = `${clash} One map family per page (Google Maps Platform terms 3.2.3(e)).`;
    if (process.env.NODE_ENV !== 'production') throw new MixedFamilyError(msg);
    console.error(`[map] ${msg}`);
    return (
      <Well label={label} className={className}>
        <p role="alert" className="m-0 font-mono text-[12px]">This map cannot be shown here.</p>
      </Well>
    );
  }

  const props = { spec, label, onSelect, onCamera, className, handleRef: ref as Ref<MapHandle> };
  if (resolved === 'google-js') return <GoogleJsMap {...props} />;
  if (resolved === 'google-embed') return <GoogleEmbedMap {...props} />;
  return <MapLibreMap {...props} />;
});
