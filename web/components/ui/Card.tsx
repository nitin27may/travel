import type { ReactNode } from 'react';
import { EntityImage } from './EntityImage';
import type { IconName } from './Icon';
import { cx } from './cx';
import type { IdentityKey } from './Chip';

export type CardVariant = 'trip' | 'publicTrip' | 'place' | 'trail';

interface CardProps {
  variant?: CardVariant;
  /** The heading content. Pass a link with class `card-open` to make the whole card one link (the stretched-link rule). */
  title: ReactNode;
  /** Mono 12.5 meta: one line, truncated. */
  meta?: ReactNode;
  photo?: string | null;
  /** Focus point of the photo, 0 to 100. */
  focus?: { x: number; y: number };
  /** Trip identity: a 4 px bar under the photo with a keyline. Public trips, places and trails use `--line-2`. */
  identity?: IdentityKey;
  /** Glyph and label when there is no photo. */
  fallbackIcon?: IconName;
  fallbackLabel?: string;
  chips?: ReactNode;
  /** Serif 16, three lines at most. */
  summary?: ReactNode;
  footer?: ReactNode;
  selected?: boolean;
  /** Done trips desaturate the photo; ideas get a dashed border. */
  done?: boolean;
  idea?: boolean;
  /** Skeleton cards keep their shape. */
  busy?: boolean;
  className?: string;
  /** Extra attributes for list state hooks. */
  'data-entity-id'?: string;
  'data-focused'?: true;
  'data-past'?: true;
}

/** Trip, public trip, place and trail card (components 3.1). Photo 16:10, then title, meta, chips, summary and footer. */
export function Card({ variant = 'place', title, meta, photo, focus, identity, fallbackIcon = 'pin', fallbackLabel, chips, summary, footer, selected, done, idea, className, ...data }: CardProps) {
  const bar = variant === 'trip' ? (identity ?? 'none') : 'none';
  return (
    <article className={cx('card', `card-${variant}`, className)} data-selected={selected || undefined} data-done={done || undefined} data-idea={idea || undefined} {...data}>
      <div className="card-media" style={{ ['--tc' as string]: `var(--id-${bar})` }}>
        <EntityImage src={photo ?? null} width={560} fallbackIcon={fallbackIcon} fallbackLabel={fallbackLabel} focus={focus} />
      </div>
      <div className="card-body">
        <h3 className="card-title">{title}</h3>
        {meta ? <p className="card-sub">{meta}</p> : null}
        {chips}
        {summary ? <p className="card-note">{summary}</p> : null}
        {footer ? <div className="card-foot">{footer}</div> : null}
      </div>
    </article>
  );
}
