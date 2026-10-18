import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { cx } from './cx';

interface Props {
  glyph?: IconName;
  /** Says what is missing ("No stays yet"), never "No data". */
  title: ReactNode;
  /** One line on why. */
  why?: ReactNode;
  /** The primary verb that does the thing. */
  action?: ReactNode;
  secondary?: ReactNode;
  className?: string;
  /** Heading level for the title; the list pages use h2. */
  as?: 'h2' | 'h3' | 'h4';
}

/** Illustration-free empty state (components 6.1): kind glyph on a `--well` disc, title, why, one action. */
export function EmptyState({ glyph = 'search', title, why, action, secondary, className, as: Heading = 'h2' }: Props) {
  return (
    <div className={cx('empty', className)} role="status">
      <span className="empty-glyph" aria-hidden="true">
        <Icon name={glyph} size={32} />
      </span>
      <Heading>{title}</Heading>
      {why ? <p className="empty-why">{why}</p> : null}
      {action || secondary ? (
        <div className="empty-actions">
          {action}
          {secondary}
        </div>
      ) : null}
    </div>
  );
}
