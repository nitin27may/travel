// The words the page is served with (spec 5.2): the server renders the bar's line with core `party.ts`; the browser keeps those words until
// the logic chunk (`partyLogic.ts`) has something else to say. Only ProfileBar's `typeof window === 'undefined'` branch calls this, which
// the client build removes, so core `party.ts` stays out of the trip page's start chunk (budget: it is about 1.7 KB gzipped).
import type { Pace, Profile } from '@travel/core/schedule/types.ts';
import { DEFAULT_CHILD_AGE, partyLine } from '@travel/core/trips/party.ts';

export const serverBarWords = (p: Pick<Profile, 'party' | 'youngest' | 'adults'>, pace: Pace, short: boolean): string =>
  partyLine({ adults: p.adults, children: p.party === 'family' ? [p.youngest ?? DEFAULT_CHILD_AGE] : [] }, pace, short);
