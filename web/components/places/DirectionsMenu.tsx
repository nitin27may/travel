'use client';

import { Icon } from '@/components/ui/Icon';
import { Menu, type MenuEntry } from '@/components/ui/Menu';
import { appleMapsUrl, directionsUrl } from '@/lib/map/links';
import type { LngLat } from '@/lib/map/types';

const open = (url: string) => () => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * The cover's Directions button opens the same two choices as the Directions card in the rail (R4-C1): Google Maps and Apple Maps,
 * both built from our stored point by the one link builder. Until the menu code loads the button is a plain Google Maps link.
 */
export default function DirectionsMenu({ at, label }: { at: LngLat; label: string }) {
  const entries: MenuEntry[] = [
    { label: 'Google Maps directions', icon: 'navigate', onSelect: open(directionsUrl(at)) },
    { label: 'Apple Maps', onSelect: open(appleMapsUrl(at, label)) },
  ];
  return (
    <Menu
      trigger={
        <>
          <Icon name="navigate" size={14} /> Directions<span className="sr-only"> to {label}: choose a map app</span>
        </>
      }
      triggerClassName="btn btn-primary pl-dir"
      entries={entries}
    />
  );
}
