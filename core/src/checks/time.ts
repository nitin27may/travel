// Small time helpers shared by the day checks. All clock values are local "HH:MM" strings.
export function toMin(hhmm: unknown): number | null {
  if (typeof hhmm !== "string") return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function fmtMin(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? (m > 0 ? `${h} h ${m}` : `${h} h`) : `${m} min`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** ISO weekday, 1 = Monday .. 7 = Sunday */
export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

/** UTC offset of a zone in minutes at a given instant */
export function zoneOffsetMin(zone: string, at: Date): number {
  const part = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Two zone names are equivalent for a trip when they have the same offset in January and in July of `year`. */
export function sameOffsets(a: string, b: string, year: number): boolean {
  if (a === b) return true;
  return [0, 6].every((month) => {
    const at = new Date(Date.UTC(year, month, 15, 12));
    return zoneOffsetMin(a, at) === zoneOffsetMin(b, at);
  });
}
