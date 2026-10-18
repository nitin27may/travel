import { placePageFamily } from '@/lib/map/family';
import { registerPageFamily } from '@/lib/map/registry';

/**
 * Map families by route (Google Maps Platform terms 3.2.3(e): one family per page). The list is always MapLibre.
 * A place page follows NEXT_PUBLIC_PLACE_MAP_FAMILY; its route map and its sidebar map are the same family.
 */
registerPageFamily('/places', 'maplibre');
registerPageFamily('/places/[slug]', placePageFamily());
