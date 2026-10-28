// The model one public trip's page embeds, for `/t/<id>/` (STEP2-M, STEP2-T1): its days, timeline inputs, addables, sections, route and
// gallery. One trip a call (P8), cached by the catalogue revision (the adapter keeps it for the page view); null for an unknown trip or an
// adapter with no such endpoint. Beside the trip-edit code, not in lib/client/data.ts: that module is in the start chunk of every list and
// trip page, and an export there would cost them bytes with the flag off (STEP2-T1F). Same adapter choice as data.ts.
import type { TripPlanModel } from '@travel/core/schema/api/index.ts';
import { staticClient } from '@/lib/client/static';

export const tripPlanModel = (slug: string): Promise<TripPlanModel | null> =>
  process.env.NEXT_PUBLIC_DATA_ADAPTER === 'static' ? staticClient.tripPlanModel(slug) : import('@/lib/client/api').then((m) => m.apiClient.tripPlanModel(slug));
