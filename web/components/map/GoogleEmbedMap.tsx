'use client';

import { useImperativeHandle } from 'react';
import { googleEnv } from '@/lib/map/family';
import { embedUrl } from '@/lib/map/google-embed/url';
import type { MapHandle } from '@/lib/map/types';
import { Well } from './MapChrome';
import type { MapFamilyProps } from './MapLibreMap';
import { PointLinks } from './PointLinks';

/** Maps Embed API: one pin, no overlays. Trail routes are shown in the elevation profile instead. */
export default function GoogleEmbedMap({ spec, label, handleRef, className = '' }: MapFamilyProps) {
  const { key } = googleEnv();
  const src = key ? embedUrl(key, spec) : null;
  useImperativeHandle(handleRef, (): MapHandle => ({ flyTo: () => undefined, fit: () => undefined, select: () => undefined, setCursor: () => undefined }), []);
  return (
    <div className={`map-surface flex flex-col gap-2 ${className}`} data-map-family="google-embed">
      {src ? (
        <iframe
          title={label}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="min-h-[320px] w-full flex-1 rounded-xl border"
          style={{ borderColor: 'var(--line)', background: 'var(--well)' }}
        />
      ) : (
        <Well label={label}><p className="m-0 font-mono text-[12px]">No point to show on a map yet.</p></Well>
      )}
      <PointLinks spec={spec} />
    </div>
  );
}
