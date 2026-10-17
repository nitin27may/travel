// Sun times, a port of the NOAA-style function in legacy/*/sun-times.py and dark-times.py (fractional year,
// equation of time, declination, hour angle), plus solar azimuth and elevation. Results are minutes after local
// midnight in the IANA zone given; the offset is read per date with Intl, so daylight saving is handled.
import { zoneOffsetMin } from "../checks/time.ts";

export const ZENITH = { sunrise: 90.833, civil: 96, nautical: 102, astronomical: 108 } as const;

/** a crossing of one zenith angle: both times in minutes after local midnight, or why there is none */
export type SunEvent =
  | { kind: "normal"; rise: number; set: number }
  | { kind: "never-sets" } // the sun stays above this angle all day (midnight sun, or no darkness for a twilight angle)
  | { kind: "never-rises" }; // the sun stays below this angle all day (polar night)

export interface SunDay {
  sunrise: SunEvent;
  civil: SunEvent;
  nautical: SunEvent;
  astronomical: SunEvent;
}

const rad = Math.PI / 180;

function dayOfYear(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}

/** equation of time (minutes) and declination (radians) for a date; the same fit as the Python scripts (365-day year) */
export function solarTerms(iso: string): { eqtime: number; decl: number } {
  const g = ((2 * Math.PI) / 365.0) * (dayOfYear(iso) - 1);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { eqtime, decl };
}

/** UTC offset in minutes of an IANA zone on a local date (read near local solar noon) */
export function offsetOn(zone: string, iso: string, lon: number): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const instant = new Date(Date.UTC(y, m - 1, d, 12) - Math.round(lon * 4) * 60000);
  return zoneOffsetMin(zone, instant);
}

/** lon is positive EAST. Times are minutes after local midnight, not wrapped (they may fall outside 0..1440). */
export function solarEvent(lat: number, lon: number, iso: string, zenithDeg: number, tzOffsetMin: number): SunEvent {
  const { eqtime, decl } = solarTerms(iso);
  const z = zenithDeg * rad;
  const la = lat * rad;
  const cosHa = Math.cos(z) / (Math.cos(la) * Math.cos(decl)) - Math.tan(la) * Math.tan(decl);
  if (cosHa < -1) return { kind: "never-sets" };
  if (cosHa > 1) return { kind: "never-rises" };
  const ha = Math.acos(cosHa) / rad;
  // NOAA: longitude positive east. (The Norway and Iceland scripts feed it west-positive values and are off by
  // 8 minutes per degree of longitude; the Patagonia table used the east-positive convention.)
  return { kind: "normal", rise: 720 - 4 * (lon + ha) - eqtime + tzOffsetMin, set: 720 - 4 * (lon - ha) - eqtime + tzOffsetMin };
}

export function sunDay(lat: number, lon: number, iso: string, zone: string): SunDay {
  const off = offsetOn(zone, iso, lon);
  return {
    sunrise: solarEvent(lat, lon, iso, ZENITH.sunrise, off),
    civil: solarEvent(lat, lon, iso, ZENITH.civil, off),
    nautical: solarEvent(lat, lon, iso, ZENITH.nautical, off),
    astronomical: solarEvent(lat, lon, iso, ZENITH.astronomical, off),
  };
}

/** "HH:MM", rounded to the minute and wrapped into one day */
export function fmtClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Sun position at a local time (minutes after midnight in `zone`): azimuth in degrees clockwise from north, elevation above the horizon. */
export function sunPosition(lat: number, lon: number, iso: string, localMin: number, zone: string): { azimuth: number; elevation: number } {
  const { eqtime, decl } = solarTerms(iso);
  const off = offsetOn(zone, iso, lon);
  const tst = localMin + eqtime + 4 * lon - off; // true solar time, minutes
  const ha = (tst / 4 - 180) * rad;
  const la = lat * rad;
  const cosZ = Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const elevation = 90 - zen / rad;
  const sinZ = Math.sin(zen);
  let azimuth: number;
  if (sinZ < 1e-9) azimuth = 180;
  else {
    const c = (Math.sin(la) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(la) * sinZ);
    const a = Math.acos(Math.max(-1, Math.min(1, c))) / rad; // angle from south
    azimuth = ha > 0 ? (a + 180) % 360 : (540 - a) % 360;
  }
  return { azimuth, elevation };
}

export interface SunTimes {
  sunrise: string;
  sunset: string;
}

/** sunrise and sunset ("HH:MM") for an ISO date at a place, or null when the sun never rises or never sets that day */
export function sunFor(lat: number, lon: number, iso: string, zone: string): SunTimes | null {
  const e = solarEvent(lat, lon, iso, ZENITH.sunrise, offsetOn(zone, iso, lon));
  if (e.kind !== "normal") return null;
  return { sunrise: fmtClock(e.rise), sunset: fmtClock(e.set) };
}
