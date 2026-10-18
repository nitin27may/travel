// Small date helpers shared by the Trips list and table views.
const TODAY = new Date("2026-10-17T12:00:00Z");
export const daysUntil = (iso: string) => Math.round((new Date(iso + "T12:00:00Z").getTime() - TODAY.getTime()) / 86400000);
export const fmtDate = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
export const relDays = (n: number) => n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 ? (n > 60 ? `in ${Math.round(n / 30.4)} months` : `in ${n} days`) : `${-n} days ago`;
export const dateRange = (start?: string, end?: string) => !start ? "Dates open" : start === end || !end ? fmtDate(start, { day: "numeric", month: "short", year: "numeric" }) : `${fmtDate(start)} – ${fmtDate(end, { day: "numeric", month: "short", year: "numeric" })}`;
