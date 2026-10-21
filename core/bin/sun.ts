#!/usr/bin/env node
// Sun and darkness times for a place and date(s). Longitude is positive EAST (Reykjavik is -21.94, Bergen 5.32).
//   node core/bin/sun.ts --lat 64.15 --lon -21.94 --zone Atlantic/Reykjavik --date 2027-09-08
//   node core/bin/sun.ts --lat 51.18 --lon -115.57 --zone America/Edmonton --date 2029-09-08 --date 2029-09-15 --json
// The reference for every sunrise, sunset, twilight and darkness time in the trip plans (see research/audits/sun-audit-2026-10-18.md).
import { fmtClock, sunDay, type SunEvent } from "../src/sun/index.ts";

const USAGE = `Usage: node core/bin/sun.ts --lat <deg> --lon <deg east> --zone <IANA> --date <YYYY-MM-DD> [--date ...] [--json]

Prints sunrise, sunset, civil/nautical/astronomical dawn and dusk (sun 6/12/18 degrees below the horizon), day length and
darkness length. Longitude is positive EAST. Times are local clock time in the zone, with that date's UTC offset
(daylight saving included). A missing dawn/dusk pair means that twilight lasts all night (no darkness of that kind).
`;

export interface SunReport {
  date: string;
  sunrise: string | null;
  sunset: string | null;
  civilDawn: string | null;
  civilDusk: string | null;
  nauticalDawn: string | null;
  nauticalDusk: string | null;
  astronomicalDawn: string | null;
  astronomicalDusk: string | null;
  dayLengthMin: number;
  darknessMin: number; // time with the sun more than 18 degrees below the horizon
  sunState: string; // normal | never sets (midnight sun) | never rises (polar night)
  astronomicalState: string;
}

const state = (e: SunEvent): string => (e.kind === "normal" ? "normal" : e.kind === "never-sets" ? "never sets" : "never rises");

/** minutes between a dusk (set) and the next dawn (rise) */
const night = (e: SunEvent): number => (e.kind === "normal" ? (((e.rise - e.set) % 1440) + 1440) % 1440 : e.kind === "never-sets" ? 0 : 1440);

export function report(lat: number, lon: number, zone: string, date: string): SunReport {
  const d = sunDay(lat, lon, date, zone);
  const rise = (e: SunEvent): string | null => (e.kind === "normal" ? fmtClock(e.rise) : null);
  const set = (e: SunEvent): string | null => (e.kind === "normal" ? fmtClock(e.set) : null);
  const s = d.sunrise;
  return {
    date,
    sunrise: rise(s),
    sunset: set(s),
    civilDawn: rise(d.civil),
    civilDusk: set(d.civil),
    nauticalDawn: rise(d.nautical),
    nauticalDusk: set(d.nautical),
    astronomicalDawn: rise(d.astronomical),
    astronomicalDusk: set(d.astronomical),
    dayLengthMin: s.kind === "normal" ? Math.round(s.set - s.rise) : s.kind === "never-sets" ? 1440 : 0,
    darknessMin: Math.round(night(d.astronomical)),
    sunState: state(s),
    astronomicalState: state(d.astronomical),
  };
}

const hm = (min: number): string => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;

function main(argv: string[]): number {
  if (argv.includes("--help") || argv.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }
  const values = (name: string): string[] => argv.flatMap((a, i) => (a === name && argv[i + 1] !== undefined ? [argv[i + 1] as string] : []));
  const one = (name: string): string | undefined => values(name)[0];
  const lat = Number(one("--lat"));
  const lon = Number(one("--lon"));
  const zone = one("--zone");
  const dates = values("--date");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !zone || dates.length === 0 || dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
    process.stderr.write(USAGE);
    return 2;
  }
  const reports = dates.map((d) => report(lat, lon, zone, d));
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
    return 0;
  }
  for (const r of reports) {
    const o = [`${r.date}  lat ${lat}  lon ${lon} (east+)  ${zone}`];
    if (r.sunState !== "normal") o.push(`  sun: ${r.sunState}`);
    else o.push(`  sunrise ${r.sunrise}   sunset ${r.sunset}   day ${hm(r.dayLengthMin)}`);
    o.push(`  civil        dawn ${r.civilDawn ?? "-"}   dusk ${r.civilDusk ?? "-"}${r.civilDawn ? "" : "   (no civil night)"}`);
    o.push(`  nautical     dawn ${r.nauticalDawn ?? "-"}   dusk ${r.nauticalDusk ?? "-"}${r.nauticalDawn ? "" : "   (no nautical night)"}`);
    o.push(`  astronomical dawn ${r.astronomicalDawn ?? "-"}   dusk ${r.astronomicalDusk ?? "-"}   darkness ${hm(r.darknessMin)}${r.astronomicalDawn ? "" : "   (no astronomical night)"}`);
    process.stdout.write(`${o.join("\n")}\n`);
  }
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
