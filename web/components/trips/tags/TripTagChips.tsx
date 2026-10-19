import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import type { TripListRow } from '@/components/trips/types';
import { tagChips } from './chips';

/**
 * The tag chips of a trip card, each a link to the Trips list filtered by it (backlog 3.2). Two rows: the suitability chips (at most
 * two, "Kids from 6" and "Hike effort: moderate", suitability-display 3.3) and the where, length and activity tags. They sit in the card
 * footer, above the stretched link, so a tap on a chip opens the list and a tap elsewhere opens the plan.
 */
export function TripTagChips({ row }: { row: TripListRow }) {
  const { suit, tags } = tagChips(row);
  if (!suit.length && !tags.length) return null;
  return (
    <div className="trip-tags">
      {suit.length ? (
        <ul className="trip-tag-row" aria-label="Who it suits">
          {suit.map((c) => (
            <li key={c.key}>
              <a className="chip chip-neutral tag-link" href={c.href} title={c.aria}>
                <Icon name={c.icon as IconName} size={13} />
                {c.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {tags.length ? (
        <ul className="trip-tag-row" aria-label="Tags">
          {tags.map((c) => (
            <li key={c.key}>
              <a className="chip chip-neutral tag-link" href={c.href} title={c.aria}>
                {c.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

