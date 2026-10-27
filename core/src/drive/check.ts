// The rules of the drive data files a Zod schema cannot hold (driving-time-model.md 5.7 "Validator"). Pure: the area registry comes in
// as a set of ids. load.ts and core/bin/drive-calibrate.ts call it; `--check` fails on any line it returns.
import type { DriveData } from "./model.ts";
import { profileKey } from "./model.ts";

const dupes = (xs: readonly string[]): string[] => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))].sort();

export function driveDataProblems(data: DriveData, registryAreas: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const keys = data.profiles.map((r) => profileKey(r.cc, r.sub));
  for (const d of dupes(keys)) out.push(`countries.json: ${d} has more than one row`);
  const countries = new Set(data.profiles.filter((r) => r.sub === null).map((r) => r.cc));
  for (const r of data.profiles) {
    const k = profileKey(r.cc, r.sub);
    if (r.sub !== null && !countries.has(r.cc)) out.push(`countries.json: ${k} has no country row ${r.cc}`);
    if (r.borderDefaultMin[r.cc] !== undefined) out.push(`countries.json: ${k} names its own country as a neighbour`);
    if (r.legalSource.read > r.read) out.push(`countries.json: ${k} cites a source read after the row's own read date`);
  }

  for (const d of dupes(data.areas.map((r) => r.area))) out.push(`areas.json: ${d} has more than one row`);
  for (const r of data.areas) {
    if (!registryAreas.has(r.area)) out.push(`areas.json: ${r.area} is not an area of the locations store`);
    const cc = r.area.slice(0, 2);
    if (!countries.has(cc)) out.push(`areas.json: ${r.area} is in ${cc}, which has no row in countries.json`);
  }

  for (const d of dupes(data.crossings.map((r) => r.id))) out.push(`crossings.json: ${d} has more than one row`);
  for (const r of data.crossings) {
    for (const a of [r.from, r.to]) if (!registryAreas.has(a)) out.push(`crossings.json: ${r.id} names ${a}, which is not an area of the locations store`);
    if (r.from === r.to) out.push(`crossings.json: ${r.id} goes from an area to itself`);
  }

  for (const d of dupes(data.segments.map((r) => r.id))) out.push(`segments.json: ${d} has more than one row`);
  return out;
}
