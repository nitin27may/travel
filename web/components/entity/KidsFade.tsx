/**
 * Marks a place card whose "Kids from N" is advice, not a rule, with the ages it is a stretch for. While the Kids filter holds an age,
 * `filters.css` fades the cards marked for that age to 60% (suitability-display 5). The card stays in the list: a rule hides, advice fades.
 * Rendered in the card footer; hidden, so it adds nothing to read. A card with a rule, or with no age at all, gets no marker.
 */
export function KidsFade({ kidsFrom, basis }: { kidsFrom: number | null; basis: 'rule' | 'advice' | null }) {
  if (kidsFrom === null || basis !== 'advice' || kidsFrom < 1) return null;
  const ages = Array.from({ length: Math.min(kidsFrom, 18) }, (_, i) => i).join(' ');
  return <span hidden data-fade={ages} />;
}
