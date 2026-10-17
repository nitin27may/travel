import type { Badge as BadgeData } from '@/lib/entities/types';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/** A pill with text always present; the leading glyph's shape adds a second, colour-independent cue. */
export function BadgePill({ badge }: { badge: BadgeData }) {
  return (
    <span className="badge" data-tone={badge.tone} data-value={badge.value} title={badge.title}>
      {badge.icon ? <Icon name={badge.icon as IconName} size={12} /> : null}
      {badge.text}
    </span>
  );
}

export function BadgeRow({ badges, className }: { badges: BadgeData[]; className?: string }) {
  if (!badges.length) return null;
  return (
    <ul className={`badge-row ${className ?? ''}`} aria-label="Details">
      {badges.map((b) => (
        <li key={`${b.tone}:${b.text}`}>
          <BadgePill badge={b} />
        </li>
      ))}
    </ul>
  );
}
