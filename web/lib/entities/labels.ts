export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const KID_LABELS: Record<string, string> = {
  'strong-kid': 'Strong kids only',
  yes: 'Kid friendly',
  no: 'Not for young kids',
  unknown: 'Not assessed',
};

export const STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  shortlisted: 'Shortlisted',
  planned: 'Planned',
  visited: 'Visited',
  dropped: 'Dropped',
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
