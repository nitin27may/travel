import KIND_TYPE_LABELS from './kind-labels.json';

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * The visitor-facing label of a place kind (CONS-2): the label of the matching type in data/vocab/types.json ("Swim spot", "Scenic drive",
 * "Trailhead"), through kind-labels.json, the few words derived from it by `node web/scripts/kind-labels.mjs` (the client bundle must not
 * carry the 122 KB type tree; tests/entities/kind-labels.test.ts fails when the file drifts). A kind with no type of its own (trail, sight,
 * area, lift, eatery, ...) is its own name, capitalised: the types.json nodes of those are categories ("Lifts and cable cars"), not the
 * singular a card shows. The one helper for glyph rows, timeline stops and the specimen.
 */
export function kindLabel(kind: string): string {
  return (KIND_TYPE_LABELS as Record<string, string>)[kind] ?? cap(kind.replace(/_/g, ' '));
}

/** The kids options, easiest first. Each has a plain meaning that the filter menu shows under the name. */
export const KID_LABELS: Record<string, string> = {
  yes: 'Easy with kids',
  'strong-kid': 'Older or strong kids',
  no: 'Not for kids',
  unknown: 'Not checked yet',
};
export const KID_HINTS: Record<string, string> = {
  yes: 'Short and gentle; young children manage it',
  'strong-kid': 'Longer or steeper; for older or experienced children',
  no: 'Hazards or hard limits make it a poor fit for young kids',
  unknown: 'Nobody has assessed it yet; hidden when you pick another option',
};

/** Tag kinds in the order the UI shows them: style first, then activity, feature, audience, the rest. */
export const TAG_KIND_ORDER = ['style', 'activity', 'feature', 'audience', 'free'];
export const TAG_KIND_LABELS: Record<string, string> = { style: 'Style', activity: 'Activity', feature: 'Feature', audience: 'Audience', free: 'Other' };
/** The glyph for a kid-fit value; strong-kid has its own shape so the cue is not colour or text alone. */
export const KID_ICONS: Record<string, 'user' | 'bolt'> = { yes: 'user', 'strong-kid': 'bolt' };
