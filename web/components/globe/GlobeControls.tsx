'use client';

import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import type { GlobePrefs } from '@/lib/globe/prefs';
import type { StyleKey } from '@/lib/map/maplibre/styles';

interface Props {
  prefs: GlobePrefs;
  /** Natural features (rivers, ranges, plains, deltas, seas): on unless the link says `nf=0`. */
  natural: boolean;
  onNatural(on: boolean): void;
  /** The style actually drawn (auto resolves to relief or dark). */
  style: StyleKey;
  reducedMotion: boolean;
  onChange(next: Partial<GlobePrefs>): void;
  /** Immersive mode: hide every control but the attribution (spec 3.4). */
  onHide?(): void;
}

const SEGMENTS = [
  { value: 'relief', label: 'Relief' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/** The control card body (components 7.2): style, 3D terrain with the relief slider, auto-spin. Used on the card and in the phone sheet. */
export function GlobeControls({ prefs, natural, onNatural, style, reducedMotion, onChange, onHide }: Props) {
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
      <Switch checked={natural} onCheckedChange={onNatural} note="Rivers, seas, ranges and plains, in search and on tap">Natural features</Switch>
      <Switch checked={prefs.spin && !reducedMotion} disabled={reducedMotion} note={reducedMotion ? 'Off: reduced motion' : undefined} onCheckedChange={(spin) => onChange({ spin })}>Auto-spin</Switch>
      {onHide ? <button type="button" className="globe-ctl-hide" onClick={onHide}>Hide controls <kbd>.</kbd></button> : null}
    </div>
  );
}
