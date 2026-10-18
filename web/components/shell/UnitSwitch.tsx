'use client';

import { Segmented } from '@/components/ui/Segmented';
import { usePrefs } from '@/lib/format/prefs';

/** One switch for distance, elevation and temperature; individual units stay in the stored prefs. */
export function UnitSwitch() {
  const [prefs, setPrefs] = usePrefs();
  const imperial = prefs.distance === 'mi' && prefs.elevation === 'ft';
  const mode = imperial ? 'imperial' : 'metric';
  return (
    <div className="unit-switch">
      <span id="unit-label">Units</span>
      <Segmented
        label="Units"
        size="xs"
        value={mode}
        onChange={(m) => setPrefs(m === 'metric' ? { distance: 'km', elevation: 'm', temperature: 'C' } : { distance: 'mi', elevation: 'ft', temperature: 'F' })}
        segments={[
          { value: 'metric', label: 'km, m' },
          { value: 'imperial', label: 'mi, ft' },
        ]}
      />
    </div>
  );
}
