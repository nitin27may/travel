import type { Badge as BadgeData } from '@/lib/entities/types';
import { Chip } from './Chip';
import type { ChipKind } from './Chip';
import type { IconName } from './Icon';

/**
 * Maps a data badge to a chip kind (components 2.8). Tone stays in the data; the look comes from the chip table:
 * visited is the only ok (green) use, idea is dashed, unconfirmed and unverified are the dashed `--crit` honesty marker.
 */
function chipKind(b: BadgeData): ChipKind {
  if (b.tone === 'warn') return 'honest';
  if (b.tone === 'muted') return 'idea';
  if (b.tone === 'kind') return 'kind';
  if (b.tone === 'status') {
    if (b.value === 'visited') return 'ok';
    if (b.value === 'idea') return 'idea';
    return 'neutral';
  }
  return 'neutral';
}

/** A chip with text always present; the leading glyph's shape adds a second, colour-independent cue. */
export function BadgePill({ badge }: { badge: BadgeData }) {
  const kind = chipKind(badge);
  return (
    <span className="badge-wrap" data-tone={badge.tone} data-value={badge.value}>
      <Chip kind={kind} icon={kind === 'honest' ? 'warn' : ((badge.icon as IconName | undefined) ?? false)} title={badge.title}>
        {badge.text}
      </Chip>
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

