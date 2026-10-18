import { pinName } from '@/lib/map/pinName';
import type { Pin } from '@/lib/map/types';

/**
 * The map's pins as an off-screen list of buttons: Tab cycles them, Enter selects. Every pin is here, including
 * `quiet` ones that draw no label on the map, so their names still reach assistive tech.
 */
export function PinList({ pins, label, onFocusPin, onSelect }: { pins: Pin[]; label: string; onFocusPin?: (id: string | null) => void; onSelect?: (id: string) => void }) {
  return (
    <ul className="sr-only" aria-label={`${label}: points`}>
      {pins.map((p) => (
        <li key={p.id}>
          <button type="button" data-pin-id={p.id} onFocus={() => onFocusPin?.(p.id)} onBlur={() => onFocusPin?.(null)} onClick={() => onSelect?.(p.id)}>
            {pinName(p)}
          </button>
        </li>
      ))}
    </ul>
  );
}
