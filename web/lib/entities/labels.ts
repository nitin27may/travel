export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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

export const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Saved Instagram post',
  official: 'Official site',
  wikidata: 'Wikidata',
  web: 'Web page',
};

export function sourceLabel(type: string): string {
  return SOURCE_LABELS[type] ?? cap(type);
}

/** Tag kinds in the order the UI shows them: style first, then activity, feature, audience, the rest. */
export const TAG_KIND_ORDER = ['style', 'activity', 'feature', 'audience', 'free'];
export const TAG_KIND_LABELS: Record<string, string> = { style: 'Style', activity: 'Activity', feature: 'Feature', audience: 'Audience', free: 'Other' };
/** The glyph for a kid-fit value; strong-kid has its own shape so the cue is not colour or text alone. */
export const KID_ICONS: Record<string, 'user' | 'bolt'> = { yes: 'user', 'strong-kid': 'bolt' };
