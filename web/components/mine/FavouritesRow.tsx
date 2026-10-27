'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { kindIcon } from '@/components/ui/Icon';
import { HeartGlyph } from '@/lib/favourites/glyph';
import { hrefOf, rowMeta, rowName } from '@/lib/favourites/panel';
import { MineThumb } from './MineThumb';
import type { FavItem } from '@travel/core/schema/favourites.ts';
import '@/lib/favourites/heart.css';

interface Props {
  item: FavItem;
  /** The row is collapsing (Remove, 200 ms). */
  collapsing?: boolean;
  /** The row came back through Undo: it expands in. */
  restored?: boolean;
  onRemove: (item: FavItem) => void;
}

/**
 * (The row link does not prefetch: 48 rows would be 48 page requests, and a page that has just been withdrawn answers 404.)
 * One Favourites row (mine-and-bar-spec 5.3): a thumbnail of the page's photo (looked up from the page's own small card file as the row
 * nears the screen, never stored in the snapshot, P8; the kind glyph stands in until it arrives and when there is none); the name, "Lake · Canada" under
 * it; the heart at the right, pressed, which removes the row with Undo. A page that is no longer listed keeps its name, reads "No longer
 * listed" and is not a link; its heart is a Remove button. A row is never removed silently (visitor spec 4.5).
 */
export function FavouritesRow({ item, collapsing, restored, onRemove }: Props) {
  const name = rowName(item);
  const gone = item.unlistedAt !== null;
  const glyph = <MineThumb space={item.space} slug={item.slug} off={gone} icon={gone ? 'warn' : item.space === 'trip' ? 'route' : kindIcon(item.kind ?? 'place')} area="glyph" />;
  return (
    <li className="frow" data-handle={`${item.space}:${item.slug}`} data-collapsing={collapsing || undefined} data-restored={restored || undefined}>
      <div className="frow-inner">
        {gone ? (
          <div className="frow-link" role="group" aria-label={`${name}, no longer listed`}>
            {glyph}
            <span className="frow-name">{name}</span>
            <span className="frow-meta">
              <span className="chip chip-idea">No longer listed</span>
            </span>
          </div>
        ) : (
          <Link className="frow-link" href={hrefOf(item)} prefetch={false}>
            {glyph}
            <span className="frow-name">{name}</span>
            <span className="frow-meta">{rowMeta(item)}</span>
          </Link>
        )}
        <div className="frow-act">
          {gone ? (
            <Button size="sm" aria-label={`Remove ${name}`} onClick={() => onRemove(item)}>
              Remove
            </Button>
          ) : (
            <button type="button" className="frow-heart fav-heart" aria-pressed="true" aria-label={`Favourite ${name}`} title="Favourite" onClick={() => onRemove(item)}>
              <span className="fav-glyph">
                <HeartGlyph />
              </span>
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
