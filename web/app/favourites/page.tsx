import { permanentRedirect } from 'next/navigation';

/**
 * `/favourites/` is the old address of the Favourites list (visitor spec 3, amended by navigation-and-mine.md): it lives in Mine now. A
 * permanent redirect (308), so a bookmark and a search result land on the tab (design review P5: one stable address, a smooth open).
 */
export default function Favourites(): never {
  permanentRedirect('/mine/?show=favourites');
}
