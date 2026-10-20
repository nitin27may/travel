import type { MapSpec } from '../types';

type Flag = NonNullable<MapSpec['hideBasemapLabels']>[number];

// OpenFreeMap names the place layers `label_*` (liberty, positron) and `place_*` (dark); both are matched.
const RULES: Record<Flag, RegExp> = {
  towns: /^(label|place)_(town|city)/,
  regions: /^(label|place)_state$/,
  countries: /^(label|place)_country/,
};

/** Below this zoom the state and province names are too many to read, on a map that asked to thin its labels (4.6, C6). */
export const ADMIN_LABEL_MIN_ZOOM = 5;

/** True for the state and province name layers of both basemap styles. */
export const isStateLabel = (layerId: string, sourceLayer: string): boolean => sourceLayer === 'place' && RULES.regions.test(layerId);

/** True when a symbol layer is a basemap place name the page asked to hide (spec.hideBasemapLabels). */
export function hideBasemapLabel(layerId: string, sourceLayer: string, flags: MapSpec['hideBasemapLabels']): boolean {
  if (!flags?.length || sourceLayer !== 'place') return false;
  return flags.some((f) => RULES[f].test(layerId));
}
