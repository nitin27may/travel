import { isWebUrl } from "./normalize.ts";

export interface Notes { licence_note: string; terms_note: string }

const RATINGS = "Ratings, review counts and ranks from this site are never stored (relevance rule); read for facts only.";
const HOSTS: [RegExp, Notes][] = [
  [/(^|\.)(wikipedia|wikidata|wikimedia)\.org$/, { licence_note: "Wikipedia text is CC BY-SA 4.0, Wikidata is CC0; Commons files carry their own licence.", terms_note: "Identify the client with a User-Agent and keep requests sequential." }],
  [/(^|\.)(openstreetmap\.org|overpass-api\.de)$/, { licence_note: "OpenStreetMap data is ODbL 1.0; attribution required.", terms_note: "Public servers: sequential requests, identified client." }],
  [/(^|\.)open-meteo\.com$/, { licence_note: "Open-Meteo data is CC BY 4.0; attribution required.", terms_note: "Free API is for non-commercial use." }],
  [/(^|\.)(alltrails\.com|tripadvisor\.[a-z.]+|komoot\.[a-z.]+|google\.[a-z.]+)$/, { licence_note: "Publisher's copyright; facts only, no copied text, photos or maps.", terms_note: RATINGS }],
];
const DEFAULT: Notes = {
  licence_note: "Publisher's copyright; we record facts and short quotes only, no copied text, photos or maps.",
  terms_note: "No terms review recorded yet.",
};
const LOCAL: Notes = { licence_note: "Our own file in this repository.", terms_note: "Not a web source; there is no link to check." };

export function notesFor(url: string): Notes {
  if (!isWebUrl(url)) return LOCAL;
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return DEFAULT;
  }
  for (const [re, n] of HOSTS) if (re.test(host)) return n;
  return DEFAULT;
}
