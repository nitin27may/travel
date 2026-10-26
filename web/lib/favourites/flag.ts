/**
 * The `favourites` flag (FAV-1): on unless `NEXT_PUBLIC_FAVOURITES=0`. Off renders no heart, no badge and no pill, and Mine's tab shows a
 * notice. It lives here, not in `lib/capabilities.ts`: that object is in every page's start chunk, and one more property cost the trip
 * page about 35 B of its start JS headroom (D11). Only the lazy modules read it, so the pages pay nothing for the flag.
 */
export const FAVOURITES_ON: boolean = process.env.NEXT_PUBLIC_FAVOURITES !== '0';
