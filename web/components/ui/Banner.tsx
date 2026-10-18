import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { cx } from './cx';

export type BannerKind = 'next' | 'urgent' | 'caution' | 'notice' | 'offline' | 'override';

const ICON: Record<BannerKind, IconName> = { next: 'clock', urgent: 'warn', caution: 'warn', notice: 'info', offline: 'wifiOff', override: 'user' };

interface Props {
  kind?: BannerKind;
  icon?: IconName | false;
  children: ReactNode;
  /** One button, right: "Bookings", "Request access". */
  action?: ReactNode;
  className?: string;
}

/**
 * Full-width banner (components 5.4): next action, urgent, caution, notice, offline (dashed) or override.
 * Dismissal is a snooze until the condition changes, so there is no plain close button here.
 */
export function Banner({ kind = 'notice', icon, children, action, className }: Props) {
  const glyph = icon === false ? null : (icon ?? ICON[kind]);
  return (
    <div className={cx('ban', `ban-${kind}`, className)} role={kind === 'urgent' ? 'alert' : 'status'}>
      {glyph ? <Icon name={glyph} size={16} /> : null}
      <span className="ban-text">{children}</span>
      {action ? <span className="ban-action">{action}</span> : null}
    </div>
  );
}
