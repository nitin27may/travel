'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { Icon } from '@/components/ui/Icon';
import { directionsUrl } from '@/lib/map/links';
import type { LngLat } from '@/lib/map/types';

type Props = { at: LngLat; label: string };

/**
 * The cover Directions button (R4-C1). The server draws a plain Google Maps link; once the page is idle the menu code loads (it stays out of
 * the place page's JS budget, P8) and the same button becomes the chooser the rail card offers: Google Maps or Apple Maps.
 */
export function DirectionsMenuLazy({ at, label }: Props) {
  const [Menu, setMenu] = useState<ComponentType<Props> | null>(null);
  useEffect(() => {
    let live = true;
    void import('./DirectionsMenu').then((m) => live && setMenu(() => m.default));
    return () => {
      live = false;
    };
  }, []);
  if (Menu) return <Menu at={at} label={label} />;
  return (
    <a className="btn btn-primary pl-dir" href={directionsUrl(at)} target="_blank" rel="noopener noreferrer">
      <Icon name="navigate" size={14} /> Directions<span className="sr-only"> to {label} (opens in a new tab)</span>
    </a>
  );
}
