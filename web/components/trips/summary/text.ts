// The Summary tab's words and card list (spec 3.5, W2), pure so the page and the tests read one definition. The numbers come from
// core's tripSummary (via lib/public/summary.ts); nothing here counts or invents a fact.
import type { ExportBooking } from '@travel/core/export/types.ts';
import { datedPhrase } from '../tabs/bookingGroups';
import { sectionsLabel } from '../tabs/photoGroups';
import type { TripSummary } from '@travel/core/trips/summary.ts';

/** The Photos tab is drawn from this many licensed photos (owner Q307, recommended: yes); fewer stay at the foot of the page. */
export const PHOTOS_TAB_MIN = 6;

/** Which tabs the Summary may link into (a card whose tab is not drawn is a plain card, never a dead link). */
export interface LinkTabs {
  stops: boolean;
  bookings: boolean;
  photos: boolean;
}

export interface CountCard {
  key: 'bases' | 'trails' | 'sights' | 'activities' | 'bookings' | 'photos' | 'nights';
  value: string;
  sub: string | null;
  /** A real link (`?view=all#trails`); null for a card that leads nowhere. */
  href: string | null;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const km = (n: number): string => String(Math.round(n * 10) / 10);
/** The card has room for one clause: the rule up to its first semicolon, without a lead word the booking's name already says ("(lottery)" then "lottery: ..."). */
function ruleBrief(name: string, rule: string): string {
  const first = rule.split(';')[0].trim();
  const m = /^([a-z][a-z -]{1,24}):\s+/i.exec(first);
  return m && name.toLowerCase().includes(m[1].toLowerCase()) ? first.slice(m[0].length) : first;
}
const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * The count cards in the order of W2: bases, trails, sights, activities, bookings, photos. A card with nothing to count is not drawn;
 * a total carries its coverage ("known for 27 of 33"). An overview trip has no days to count: its nights and its photos only.
 */
export function countCards(s: TripSummary, link: LinkTabs, groups = 0): CountCard[] {
  const out: CountCard[] = [];
  const c = s.counts;
  if (!s.flags.days) {
    if (s.nights !== null && s.nights > 0) out.push({ key: 'nights', value: plural(s.nights, 'night', 'nights'), sub: null, href: null });
  } else if (s.flags.counts) {
    if (c.stays > 0) out.push({ key: 'bases', value: plural(c.stays, 'base', 'bases'), sub: [plural(c.stays, 'stay', 'stays'), s.nights ? plural(s.nights, 'night', 'nights') : ''].filter(Boolean).join(', ') || null, href: '#trip-shape' });
    if (c.trails.count > 0) {
      const known = c.trails.kmKnown < c.trails.count ? `, known for ${c.trails.kmKnown} of ${c.trails.count}` : '';
      out.push({ key: 'trails', value: plural(c.trails.count, 'trail', 'trails'), sub: c.trails.kmKnown > 0 ? `${km(c.trails.km)} km, all versions${known}` : null, href: link.stops ? '?view=all#trails' : null });
    }
    if (c.sights > 0) out.push({ key: 'sights', value: plural(c.sights, 'sight', 'sights'), sub: 'in the plan', href: link.stops ? '?view=all#sights' : null });
    if (c.activities > 0) out.push({ key: 'activities', value: plural(c.activities, 'activity', 'activities'), sub: 'in the plan', href: link.stops ? '?view=all#activities' : null });
  }
  if (s.flags.bookings) {
    const b = c.bookings;
    const sub = b.dated === 0 ? datedPhrase(0) : b.earliest ? `earliest: ${b.earliest.name}, ${lower(ruleBrief(b.earliest.name, b.earliest.rule))}` : null;
    out.push({ key: 'bookings', value: `${b.count} to book ahead`, sub, href: link.bookings ? '?view=bookings' : null });
  }
  if (c.photos > 0) out.push({ key: 'photos', value: plural(c.photos, 'photo', 'photos'), sub: groups > 0 ? sectionsLabel(groups) : null, href: link.photos ? '?view=photos' : null });
  return out;
}

/** "Day 11", "Days 3 and 10", "Days 4, 8 and 12" as the parts a link list can render; the day numbers are the links. */
export function dayWords(days: readonly number[]): { lead: string; days: { n: number; sep: string }[] } {
  const lead = days.length === 1 ? 'Day' : 'Days';
  return { lead, days: days.map((n, i) => ({ n, sep: i === days.length - 1 ? '' : i === days.length - 2 ? ' and ' : ', ' })) };
}

/**
 * A booking line stays at rest when its name or its note states a closure, a mandatory rule or a hazard (principles P2: safety is never behind a disclosure). The
 * data has no safety flag on a booking yet (UXB-C will add one from the capture record), so this reads the words of the NAME and the note: the
 * Moraine Lake road ban is in the name ("Moraine Lake Road private vehicle ban") and its note says nothing alarming. The unit test pins the
 * Rockies' two safety lines at rest.
 */
export const SAFETY_NOTE = /\b(?:closed|closure|closed to|mandatory|ban|banned|prohibited|not allowed|no private (?:cars|vehicles)|private vehicles? (?:ban|banned)|bear|avalanche|danger|hazard|unsafe|group[- ]of[- ]\w+)\b/i;
export const KNOW_AT_REST = 3;

export interface KnowLine {
  name: string;
  text: string;
}

/** "Know before you go": each booking's note (else its window), three at rest, every safety line at rest, the rest behind a disclosure. */
export function knowBeforeYouGo(bookings: readonly ExportBooking[]): { atRest: KnowLine[]; more: KnowLine[] } {
  const lines = bookings.flatMap((b) => {
    const text = b.note?.trim() || b.rule || '';
    return text ? [{ name: b.name, text }] : [];
  });
  const atRest: KnowLine[] = [];
  const more: KnowLine[] = [];
  for (const l of lines) (atRest.length < KNOW_AT_REST || SAFETY_NOTE.test(`${l.name} ${l.text}`) ? atRest : more).push(l);
  return { atRest, more };
}

/**
 * The highlights drawn at rest: at most `max`, in the model's order (the gallery's own section order, so Moraine Lake comes first), those with
 * a photo before those without (a card with a photo says more than a glyph and "No licensed photo yet"). Never re-sorted into day order.
 */
export function highlightsAtRest<T extends { photoUrl: string | null }>(all: readonly T[], max: number): T[] {
  return all.map((h, i) => ({ h, i, has: h.photoUrl ? 0 : 1 })).sort((a, b) => a.has - b.has || a.i - b.i).slice(0, max).map((x) => x.h);
}
