// Predictive search over the local catalog: diacritics removed, prefix > word-prefix > trigram, ranked
// "already in this trip" first, then by drive time from tonight's base. Runs in well under a frame.
import { PLACES, type Place } from "../data/places";
import { km } from "./geo";

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim();
const tri = (s: string) => { const t = new Set<string>(); const x = `  ${s} `; for (let i = 0; i < x.length - 2; i++) t.add(x.slice(i, i + 3)); return t; };

function score(q: string, p: Place): number {
  const names = [p.name, ...(p.aka ?? []), p.area].map(norm);
  let best = 0;
  for (const n of names) {
    if (n.startsWith(q)) best = Math.max(best, 100 - n.length * 0.2);
    else if (n.split(" ").some(w => w.startsWith(q))) best = Math.max(best, 80 - n.length * 0.2);
    else if (n.includes(q)) best = Math.max(best, 60);
    else if (q.length >= 3) {
      const a = tri(q), b = tri(n); let hit = 0; a.forEach(g => b.has(g) && hit++);
      const sim = hit / a.size; if (sim > 0.45) best = Math.max(best, 40 * sim);
    }
  }
  return best;
}

export interface Hit { place: Place; group: "trip" | "near" | "elsewhere"; distKm?: number; score: number }
export interface Parsed { q: string; time?: string; day?: number }

/** "9:30 seceda day 12" → time 09:30, day 12, query "seceda" */
export function parse(raw: string): Parsed {
  let s = raw; let time: string | undefined; let day: number | undefined;
  const t = s.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/); if (t) { time = `${t[1].padStart(2, "0")}:${t[2]}`; s = s.replace(t[0], " "); }
  const d = s.match(/\bday\s*(\d{1,2})\b/i); if (d) { day = Number(d[1]); s = s.replace(d[0], " "); }
  return { q: norm(s), time, day };
}

export function search(q: string, inTrip: Set<string>, base?: Place, extra: Place[] = [], kinds?: Place["kind"][]): Hit[] {
  if (!q) return [];
  const all = [...PLACES, ...extra].filter(p => !kinds || kinds.includes(p.kind));
  const hits: Hit[] = [];
  for (const p of all) {
    const s = score(q, p); if (s <= 0) continue;
    const distKm = base ? km(base, p) : undefined;
    const group = inTrip.has(p.id) ? "trip" : distKm !== undefined && distKm < 45 ? "near" : "elsewhere";
    hits.push({ place: p, group, distKm, score: s - (distKm ?? 0) * 0.15 });
  }
  const order = { trip: 0, near: 1, elsewhere: 2 };
  return hits.sort((a, b) => order[a.group] - order[b.group] || b.score - a.score).slice(0, 8);
}
