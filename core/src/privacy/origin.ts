import { publicParty } from './party.ts';
import type { DropLog } from './dateless.ts';
import { HOME_TOWN, PUBLIC_START_CITY, nearHome } from './home.ts';

// The household's home town is household data. Public output names the trip's public starting city instead. The home point and the
// town pattern live in ./home.ts (the one baselined exception while the repo is private).
export { PUBLIC_START_CITY, nearHome } from './home.ts';

/**
 * The text with the household party rewritten and the home town replaced by the public starting city, keeping the case
 * ("Whitby" or "whitby"). With a `log`, every sentence the party scrub drops is reported under `where`.
 */
export function publicOrigin(text: string, where?: string, log?: DropLog): string {
  const replaced = publicParty(text, where, log).replace(HOME_TOWN, (m) => (m === m.toLowerCase() ? PUBLIC_START_CITY.name.toLowerCase() : PUBLIC_START_CITY.name));
  return dropSelfLegs(replaced, where, log);
}

/** "Whitby to Toronto" reads "Toronto to Toronto" once the home town is replaced. The leg says nothing, so the whole sentence goes (3.26). */
const SELF_LEG = new RegExp(String.raw`\b${PUBLIC_START_CITY.name}\s*(?:to|-|–|→|->|and back to|and back)\s*${PUBLIC_START_CITY.name}\b`, 'i');
const SENTENCES = /(?:[^.!?]|[.!?](?!\s|$))+[.!?]*\s*/g;

function dropSelfLegs(text: string, where?: string, log?: DropLog): string {
  if (!SELF_LEG.test(text)) return text;
  const kept: string[] = [];
  for (const s of text.match(SENTENCES) ?? [text]) {
    if (SELF_LEG.test(s)) log?.add(where ?? 'public text', s.trim(), 'a leg from the home town to the public start city reads as a trip from a city to itself; the sentence is dropped');
    else kept.push(s);
  }
  return kept.join('').trim();
}

/** Scrubs a built value in place: every string, and any {lat, lon} point near home (moved to the public starting city). */
export function scrubOrigin<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      value[i] = typeof v === 'string' ? publicOrigin(v) : scrubOrigin(v);
    });
  } else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.lat === 'number' && typeof o.lon === 'number' && nearHome(o.lat, o.lon)) {
      o.lat = PUBLIC_START_CITY.lat;
      o.lon = PUBLIC_START_CITY.lon;
    }
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string') o[k] = publicOrigin(v);
      else if (v && typeof v === 'object') scrubOrigin(v);
    }
  }
  return value;
}
