import type { DropLog } from './dateless';

// Public pages say who a plan suits, never who travelled. The household's party (how many, how old, adults and a child)
// is private. These are explicit rewrite rules, applied at the adapter boundary through publicOrigin, which scrubOrigin,
// undatedSentences and undatedTitle all call. A sentence that still reads like a party description afterwards is dropped,
// and every dropped sentence is reported to the build's DropLog (backlog 2.43).
//
// The leak patterns work on party context, not on a bare phrase: "A 300-year-old church" and "Bring the child carrier" are
// not the household, so they stay. A child's age is 0 to 17; anything older is a building, a tree or a tradition.

type Rule = [RegExp, string | ((...m: string[]) => string)];

/** A child's age in "N-year-old": 1 to 17, so "300-year-old" and "40-year-old" never match. */
const KID_AGE = String.raw`(?:1[0-7]|[1-9])`;
/** Things that are N years old and are not a person ("a 12-year-old tradition"). */
const THING = String.raw`(?:church|chapel|cathedral|tree|building|house|hut|bridge|town|village|tradition|wine|cheese|rule|record|school|hotel|lodge|inn|castle|fort|mill|barn|cabin|trail|road|route|mine|dam|tunnel|forest|glacier|ruin|ruins|monastery|temple|shrine|festival|company|business|brand|boat|ship|vessel)`;
/** What follows "the child" when it is a fare, a carrier or an age condition: a rule, not a traveller. */
const CHILD_RULE_AFTER = String.raw`(?: (?:fare|fares|rate|rates|price|prices|ticket|tickets|carrier|carriers|seat|seats|harness|harnesses|size|sizes|pass|passes|menu|portion|portions|discount|helmet|helmets|bike|bikes|trailer|trailers)\b| is (?:under|over|younger|older|below|above|aged|less|at least|\d))`;

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
  [/\bIf the child is\b(?! (?:under|over|younger|older|below|above|aged|less|at least|\d))/g, 'If anyone is'],
  [/\bif the child's ceiling\b/gi, "if the youngest walker's ceiling"],
  [/\bsized for the child\b/g, 'sized for young walkers'],
  // a fare rule keeps the source's own age
  [new RegExp(String.raw`\bA (\d+)-year-old pays the child fare\b`, 'g'), (_m, n) => `The child fare applies from age ${n}`],
  [new RegExp(String.raw`\b[Ww]hether a ${KID_AGE}-year-old counts( toward four)?\b`, 'g'), (_m, t) => `Whether a young child counts${t ? ' toward the four' : ''}`],
  [new RegExp(String.raw`\ba ${KID_AGE}-year-old\b(?! ${THING}\b)`, 'gi'), 'a young child'],
  [/\bthe family's (?=\d)/g, 'the '],
  [/\bThe whole family's alpine larch walk\b/g, 'A family-friendly alpine larch walk'],
  [/\ba family of \d+\b/gi, 'a small group'],
  [/\bfamily of \d+\b/gi, 'small group'],
];

/**
 * What must not survive the rules: a sentence matching any of these describes the party and is dropped whole.
 * Each alternative needs party context, so a building's age or a "child carrier" never trips it.
 */
export const PARTY_LEAK = new RegExp(
  [
    String.raw`\b(?:a|the) child around \d`,
    String.raw`\bthe child(?:'s)?\b(?!${CHILD_RULE_AFTER})`,
    String.raw`\b${KID_AGE}-year-old\b(?! ${THING}\b)`,
    String.raw`\bfamily of \d`,
    String.raw`\b(?:\d+|two|three|four) adults? (?:plus|and) (?:\d+|two|three|four|a|one) (?:children|kids|child|kid)\b`,
    // first-person household: "my wife", "with my kids" (3.26)
    String.raw`\bmy (?:wife|husband|partner|spouse|son|daughter|kids?|child(?:ren)?|family|girlfriend|boyfriend|toddler|baby)\b`,
    // a bare age after the youngest, or the youngest in the past tense: "The youngest, 7, was tired"
    String.raw`\b(?:the )?(?:youngest|eldest|little one)\b,?\s*(?:aged |is |was |\()?\d{1,2}\b(?!\s*(?:km|m\b|min|h\b|kg|cm))`,
    String.raw`\bthe (?:youngest|eldest|little one) (?:was|were|got|had|liked|loved|fell|needed|wanted|slept)\b`,
    String.raw`\bwith (?:kids|children) \d+\+?`,
    String.raw`\bthe other adult\b`,
    String.raw`\bboth adults\b`,
    String.raw`\bone adult(?! \d)`,
    String.raw`\bour (?:kids?|child(?:ren)?|daughter|son|family)\b`,
    String.raw`\bwe(?:'re| are| were| have) (?:travell|bring|with)`,
  ].join('|'),
  'i',
);

const SENTENCES = /(?:[^.!?]|[.!?](?!\s|$))+[.!?]*\s*/g;

const capitalise = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Applies one rule, keeping the case of the first letter: a rewrite of a capitalised phrase is capitalised. */
function apply(text: string, [re, to]: Rule): string {
  return text.replace(re, (...args: unknown[]) => {
    const hasGroups = typeof args[args.length - 1] === 'object';
    const rest = args.slice(0, hasGroups ? -1 : undefined);
    const whole = String(rest[0]);
    const groups = rest.slice(1, -2).map((g) => (g === undefined ? '' : String(g)));
    let out = typeof to === 'function' ? to(whole, ...groups) : to.replace(/\$(\d)/g, (_x, d: string) => groups[Number(d) - 1] ?? '');
    if (/^[A-Z]/.test(whole) && /^[a-z]/.test(out)) out = capitalise(out);
    return out;
  });
}

/**
 * The text with every party description rewritten as a suitability statement, or dropped when no rule fits. Every sentence
 * that is dropped goes to `log` (with `where`) so the build report lists it for a person to rewrite.
 */
export function publicParty(text: string, where = 'public text', log?: DropLog): string {
  let out = text;
  for (const rule of REWRITES) out = apply(out, rule);
  if (!PARTY_LEAK.test(out)) return out;
  const kept: string[] = [];
  for (const s of out.match(SENTENCES) ?? [out]) {
    if (PARTY_LEAK.test(s)) log?.add(where, s.trim(), 'describes the household party; no rewrite rule fits, so the sentence is dropped');
    else kept.push(s);
  }
  return kept.join('').trim();
}

/** True when the text still describes who travelled. Used by tests over every published string. */
export const describesParty = (text: string): boolean => PARTY_LEAK.test(text);

/** "Patagonia with kids 11+" says who went; the age it was built around becomes "Suits ages 11 and up." */
export function suitabilityFromTitle(rawTitle: string): string {
  const m = /\bwith (?:kids|children)\s+(\d+)\+/i.exec(rawTitle);
  return m ? `Suits ages ${m[1]} and up.` : '';
}
