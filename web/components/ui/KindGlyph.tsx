import { Icon, kindIcon } from './Icon';
import type { IconName } from './Icon';
import { cx } from './cx';

/** The fifteen research kinds plus area and scenic drive (components 3.1); anything else falls back to a pin. */
export const KIND_LABELS: Record<string, string> = {
  trail: 'Trail',
  trailhead: 'Trailhead',
  parking: 'Parking',
  viewpoint: 'Viewpoint',
  lake: 'Lake',
  waterfall: 'Waterfall',
  sight: 'Sight',
  town: 'Town',
  adventure: 'Adventure',
  lift: 'Lift',
  hut: 'Hut',
  stay: 'Stay',
  eatery: 'Eatery',
  swim_spot: 'Swim spot',
  event: 'Event',
  area: 'Area',
  scenic_drive: 'Scenic drive',
};

interface Props {
  kind?: string;
  /** A glyph chosen by the caller (descriptors give an icon, not a kind). */
  icon?: IconName;
  /** sm 26 (rows), md 44 (booking cards), lg 56 (empty states). */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Ink glyph on a `--well` disc. Decorative; the kind is named in text next to it. */
export function KindGlyph({ kind = 'place', icon, size = 'sm', className }: Props) {
  const px = size === 'sm' ? 15 : size === 'md' ? 20 : 30;
  return (
    <span className={cx('kind-glyph', `kind-glyph-${size}`, className)} aria-hidden="true">
      <Icon name={icon ?? kindIcon(kind)} size={px} />
    </span>
  );
}
