// Public pages say who a plan suits, never who travelled. The household's party (how many, how old, adults and a child)
// is private. These are explicit rewrite rules, applied at the adapter boundary through publicOrigin, which scrubOrigin,
// undatedSentences and undatedTitle all call. A sentence that still reads like a party description afterwards is dropped.

type Rule = [RegExp, string | ((...m: string[]) => string)];

/** Ordered: the specific phrases first, the general ones after. */
const REWRITES: Rule[] = [
  // trip titles: "Patagonia with kids 11+" names a party; the age goes in the "Ages 11+" chip instead
  [/^Patagonia with (?:kids|children|family)\b.*$/i, 'Argentine Patagonia'],
  [/\s+with (?:kids|children|a child|toddlers|teens)(?:\s+\d+\+?)?\s*$/i, ''],
  // the Rockies standfirst
  [/an adults' hike, a family hike and a shorter option for a child around 6\b/, 'a longer hike, a family hike and a shorter option. The family version suits children from about 6'],
  // split days: "one adult ... while the other adult and the child ..." becomes two groups
  [/\bone adult (walks|climbs)\b/g, (_m, v) => `the stronger walkers ${v === 'walks' ? 'walk' : 'climb'}`],
  [/\bone adult(?! \d)/g, 'the stronger walkers'],
  [/\bthe other adult and the child\b/g, 'the others'],
  [/\bthe other adult\b/g, 'the others'],
  [/\bboth adults want\b/g, 'the group wants'],
  [/\bthat adult is\b/g, 'that walker is'],
  [/\bsolo adult\b/g, 'solo walker'],
  [/\b(?:\d+|two|three|four) adults plus (?:\d+|two|three|four) children\b/gi, 'children'],
  // the child, as a person in the party
  [/\bkeep the child (within|close)\b/g, 'keep children $1'],
  [/\bIf the child is\b/g, 'If anyone is'],
  [/\bif the child's ceiling\b/gi, "if the youngest walker's ceiling"],
  [/\bsized for the child\b/g, 'sized for young walkers'],
  [/\bA \d+-year-old pays the child fare\b/g, 'The child fare applies from age 6'],
  [/\b[Ww]hether a \d+-year-old counts( toward four)?\b/g, (_m, t) => `Whether a young child counts${t ? ' toward the four' : ''}`],
  [/\ba \d+-year-old\b/g, 'a young child'],
  [/\bthe family's (?=\d)/g, 'the '],
  [/\bThe whole family's alpine larch walk\b/g, 'A family-friendly alpine larch walk'],
  [/\ba family of \d+\b/gi, 'a small group'],
  [/\bfamily of \d+\b/gi, 'small group'],
];

/** What must not survive the rules: a sentence matching any of these describes the party and is dropped whole. */
export const PARTY_LEAK =
  /\b(?:a|the) child around \d|\bthe child(?:'s)?\b(?! (?:fare|rate|price|ticket))|\b\d+-year-old|\bfamily of \d|\b(?:\d+|two|three|four) adults? (?:plus|and) (?:\d+|two|three|four) (?:children|kids)|\bwith (?:kids|children) \d+\+?|\bthe other adult\b|\bboth adults\b|\bone adult(?! \d)|\bour (?:kids?|child(?:ren)?|daughter|son|family)\b|\bwe(?:'re| are| were| have) (?:travell|bring|with)/i;

const SENTENCES = /(?:[^.!?]|[.!?](?!\s|$))+[.!?]*\s*/g;

/** The text with every party description rewritten as a suitability statement, or dropped when no rule fits. */
export function publicParty(text: string): string {
  let out = text;
  for (const [re, to] of REWRITES) out = out.replace(re, to as string);
  if (!PARTY_LEAK.test(out)) return out;
  const kept = (out.match(SENTENCES) ?? [out]).filter((s) => !PARTY_LEAK.test(s));
  return kept.join('').trim();
}

/** True when the text still describes who travelled. Used by tests over every published string. */
export const describesParty = (text: string): boolean => PARTY_LEAK.test(text);

/** "Patagonia with kids 11+" says who went; the age it was built around becomes "Suits ages 11 and up." */
export function suitabilityFromTitle(rawTitle: string): string {
  const m = /\bwith (?:kids|children)\s+(\d+)\+/i.exec(rawTitle);
  return m ? `Suits ages ${m[1]} and up.` : '';
}
