// The party bar's logic (UXB-2; spec trip-and-places-ux-fixes.md 5.2 to 5.4): which party the bar shows, its words, the landing rule and
// what `travel.party` and `travel.tripui` hold. ONE lazy chunk, because it pulls in core `party.ts`, which Turbopack does not tree-shake:
// the bar in the trip page's start chunk imports this only when it has something to say (a changed or shared plan, a kept party, the
// editor open). A first-time visitor on the plan's own settings never loads it; the server's words stay on screen. The editor and the
// sticky rail's words read from here too. Household data: everything goes through lib/storage/keys.ts and so safe.ts; nothing is sent.
import { parseTimelineUrl, serialiseTimelineUrl } from '@travel/core/schedule/profileCodec.ts';
import type { Pace, Profile } from '@travel/core/schedule/types.ts';
import {
  adultsText,
  cleanParty,
  DEFAULT_CHILD_AGE,
  landingFor,
  PACE_WORD,
  partyLine,
  partyOfProfile,
  partyShortText,
  profileForParty,
  type Landing,
  type Party,
} from '@travel/core/trips/party.ts';
import { readParty, readTripEntry, readTripUi, writeParty, writePartyOpen, writeTripEntry } from '@/lib/storage/keys';
import { parseTripUrl } from '../useTripUrl';

type Who = Pick<Profile, 'party' | 'youngest' | 'adults'>;

// ---- the words ------------------------------------------------------------------------------------------------------------

/** The party a profile implies when nothing richer is known: the adults, and one child of the youngest age (a link never carries the rest). */
export const partyFromProfile = (p: Who): Party => ({ adults: p.adults, children: p.party === 'family' ? [p.youngest ?? DEFAULT_CHILD_AGE] : [] });

/** Two profiles plan the same party. */
export const sameWho = (a: Who, b: Who): boolean => a.party === b.party && a.youngest === b.youngest && a.adults === b.adults;

/**
 * The party the bar shows: the worked-on or kept party while the profile still plans exactly as it does (so ages the link cannot carry
 * stay visible); otherwise the party the profile implies (a Back step, a shared link, the copy sheet changing the youngest).
 */
export function effectiveParty(work: Party | null, profile: Profile): Party {
  return work && sameWho(profileForParty(work, profile), profile) ? work : partyFromProfile(profile);
}

/** "Shared plan: family, youngest 6" (the link's own words; the adults only when the link says other than 2). */
export function sharedWords(p: Who): string {
  const { adults, youngest } = partyOfProfile(p);
  return `Shared plan: ${[youngest === null ? 'adults only' : `family, youngest ${youngest}`, adults === 2 ? '' : adultsText(adults)].filter(Boolean).join(', ')}`;
}

/** The collapsed bar's line, long (desktop) and short (phone): "2 adults · 1 child (10) · Standard pace". */
export function barWords(shared: boolean, party: Party, profile: Profile, pace: Pace, short: boolean): string {
  return shared ? `${sharedWords(profile)} · ${PACE_WORD[pace]}${short ? '' : ' pace'}` : partyLine(party, pace, short);
}

/** "2 adults, 1 child": the short form for the offer button. */
export const shortWords = partyShortText;

/** The profile fields a party plans as (what the editor and the offer write through `setProfile`). */
export const whoOf = (party: Party, profile: Profile): Who => {
  const w = profileForParty(party, profile);
  return { party: w.party, youngest: w.youngest, adults: w.adults };
};

// ---- the device -----------------------------------------------------------------------------------------------------------

export interface Arrival {
  land: Landing;
  /** The party kept on this device, when there is one. */
  device: Party | null;
  /** Show the kept party's full words: it is applied, or the link already plans exactly as it does. */
  useDevice: boolean;
  /** The query to write (a replace) to apply the kept party, or null. */
  timeline: string | null;
  /** The editor was left open on the last visit (not restored on a deep link to a day). */
  open: boolean;
}

/** Q295: reads the address bar and the device after hydration (the hook still holds the server's empty URL on its first pass). */
export function arrive(slug: string, defaults: Profile): Arrival {
  const device = readParty();
  const state = parseTimelineUrl(parseTripUrl(window.location.search, '').timeline, defaults);
  const land = landingFor({ query: window.location.search, device, defaults, urlProfile: state.profile, asWritten: readTripEntry(slug).asWritten });
  const apply = land.mode === 'device' && device && land.apply;
  return {
    land,
    device,
    useDevice: Boolean(apply) || Boolean(device && sameWho(profileForParty(device, state.profile), state.profile)),
    timeline: apply ? serialiseTimelineUrl({ ...state, profile: { ...state.profile, ...apply } }, defaults) : null,
    open: readTripUi().partyOpen && !window.location.hash,
  };
}

/** Keeps a party chosen in the editor (or the offered one) on this device. `kept` is false when the browser refused it. */
export function keep(next: Party, slug: string): { party: Party | null; kept: boolean } {
  const party = cleanParty(next);
  if (!party) return { party: null, kept: false };
  const kept = writeParty(party);
  writeTripEntry(slug, { asWritten: false });
  return { party, kept };
}

/** Plan as written (Reset): the kept party is not applied to this trip again until the party is edited. */
export const asWritten = (slug: string): boolean => writeTripEntry(slug, { asWritten: true });

/** Remembers whether the editor is open (one value for every trip). */
export const rememberOpen = (open: boolean): boolean => writePartyOpen(open);
