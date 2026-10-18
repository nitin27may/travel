'use client';

import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import type { GlobePrefs } from '@/lib/globe/prefs';
import type { StyleKey } from '@/lib/map/maplibre/styles';

interface Props {
  prefs: GlobePrefs;
  /** The style actually drawn (auto resolves to relief or dark). */
  style: StyleKey;
  reducedMotion: boolean;
  onChange(next: Partial<GlobePrefs>): void;
}

const SEGMENTS = [
  { value: 'relief', label: 'Relief' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/** The control card body (components 7.2): style, 3D terrain with the relief slider, auto-spin. Used on the card and in the phone sheet. */
export function GlobeControls({ prefs, style, reducedMotion, onChange }: Props) {
  return (
    <div className="globe-controls">
      <div className="globe-ctl-row">
        <span className="globe-ctl-label" id="globe-style-label">Style</span>
        <Segmented size="s" label="Map style" segments={[...SEGMENTS]} value={style} onChange={(v) => onChange({ style: v })} />
      </div>
      <Switch checked={prefs.terrain} onCheckedChange={(terrain) => onChange({ terrain })}>3D terrain</Switch>
      {prefs.terrain ? (
        <Slider label="Relief" value={prefs.exaggeration} min={0.5} max={2} step={0.1} format={(v) => `${v.toFixed(1)}×`} onValueChange={(exaggeration) => onChange({ exaggeration })} />
      ) : null}
      <Switch checked={prefs.spin && !reducedMotion} disabled={reducedMotion} note={reducedMotion ? 'Off: reduced motion' : undefined} onCheckedChange={(spin) => onChange({ spin })}>Auto-spin</Switch>
    </div>
  );
}
