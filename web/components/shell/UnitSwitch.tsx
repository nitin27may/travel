'use client';

import { usePrefs } from '@/lib/format/prefs';

/** One switch for distance, elevation and temperature; individual units stay in the stored prefs. */
export function UnitSwitch() {
  const [prefs, setPrefs] = usePrefs();
  const imperial = prefs.distance === 'mi' && prefs.elevation === 'ft';
  const set = (mode: 'metric' | 'imperial') =>
    setPrefs(mode === 'metric' ? { distance: 'km', elevation: 'm', temperature: 'C' } : { distance: 'mi', elevation: 'ft', temperature: 'F' });
  return (
    <div className="unit-switch" role="group" aria-label="Units">
      <span>Units</span>
      <div className="seg" style={{ marginLeft: 0 }}>
        <button type="button" className="seg-btn" aria-pressed={!imperial} onClick={() => set('metric')}>
          km, m
        </button>
        <button type="button" className="seg-btn" aria-pressed={imperial} onClick={() => set('imperial')}>
          mi, ft
        </button>
      </div>
    </div>
  );
}
