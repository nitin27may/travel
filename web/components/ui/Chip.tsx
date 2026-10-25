import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { ReactNode } from 'react';
import { cx } from './cx';

/** Every chip kind in components 2.8. Hue is never the only signal: each carries text, and most an icon. */
export type ChipKind =
  | 'neutral'
  | 'kind'
  | 'active'
  | 'toBook'
  | 'caution'
  | 'urgent'
  | 'held'
  | 'ok'
  | 'idea'
  | 'honest'
  | 'notice'
  | 'trip';

const DEFAULT_ICON: Partial<Record<ChipKind, IconName>> = {
  toBook: 'ticket',
  caution: 'warn',
  urgent: 'clock',
  held: 'clock',
  ok: 'check',
  honest: 'warn',
  notice: 'info',
};

export const IDENTITY_KEYS = ['blue', 'orange', 'rose', 'teal', 'sky', 'yellow', 'vermillion', 'none'] as const;
export type IdentityKey = (typeof IDENTITY_KEYS)[number];

/** Trip identity mark: 10 px square beside a name, always with the `--line-2` keyline (tokens 4). */
export function IdentitySquare({ identity = 'none', className }: { identity?: IdentityKey; className?: string }) {
  return <i className={cx('sq', className)} style={{ ['--tc' as string]: `var(--id-${identity})` }} aria-hidden="true" />;
}

interface ChipProps {
  kind?: ChipKind;
  /** Override the default icon, or pass `false` for none. */
  icon?: IconName | false;
  children: ReactNode;
  /** Trip chips: the identity colour key, or a photo URL for the 20 px ring. */
  identity?: IdentityKey;
  photo?: string;
  /** Removable chip: shows an x and calls this. */
  onRemove?: () => void;
  removeLabel?: string;
  title?: string;
  className?: string;
  /** The text wraps (a season label) instead of staying on one line; never truncated. */
  wrap?: boolean;
}

export function Chip({ kind = 'neutral', icon, children, identity, photo, onRemove, removeLabel, title, className, wrap }: ChipProps) {
  const glyph = icon === false ? null : (icon ?? DEFAULT_ICON[kind]);
  return (
    <span className={cx('chip', `chip-${kind}`, wrap && 'chip-wrap', className)} data-kind={kind} title={title}>
      {kind === 'trip' && photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative 20 px ring photo
        <img className="chip-photo" src={photo} alt="" style={{ ['--tc' as string]: `var(--id-${identity ?? 'none'})` }} />
      ) : kind === 'trip' ? (
        <IdentitySquare identity={identity} />
      ) : glyph ? (
        <Icon name={glyph} size={13} />
      ) : null}
      {children}
      {onRemove ? (
        <button type="button" className="chip-x" aria-label={removeLabel ?? 'Remove'} onClick={onRemove}>
          <Icon name="close" size={12} />
        </button>
      ) : null}
    </span>
  );
}
