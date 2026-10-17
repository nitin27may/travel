export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const KID_LABELS: Record<string, string> = {
  'strong-kid': 'Great for kids',
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
