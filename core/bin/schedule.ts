#!/usr/bin/env node
// Prints a scheduled day as a table: the review tool for authored overrides (trip-timeline spec 2.10).
//   node core/bin/schedule.ts --input core/test/fixtures/schedule/rockies-day5.json --day 5 --profile family-6 --pace standard --split
//   node core/bin/schedule.ts --input <scheduleInput.json> --day 5 --profile adults --pace relaxed --json
// The input is one ScheduleDayInput or an array of them (data/schedules README, web/lib/public/timeline.ts).
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fmtHM } from "../src/schedule/rules.ts";
import { scheduleDay } from "../src/schedule/schedule.ts";
import type { DayTimeline, Pace, Profile, ScheduleDayInput, TimelineEntry } from "../src/schedule/types.ts";

const USAGE = `Usage: node core/bin/schedule.ts --input <file.json> [--day N] [--profile adults|family-<age>] [--pace relaxed|standard|full]
                                [--variant A|B|C] [--split] [--adults 1] [--json]
Prints time, confidence, lane, kind, title, duration and source for each entry of one day.
`;

const CONF: Record<string, string> = { fixed: "FIXED", anchored: "SUN", suggested: "sugg" };

export function renderTable(t: DayTimeline): string {
  const rows = t.entries.map((e: TimelineEntry) => [
    e.kind === "sun" ? `about ${e.time.anchor?.range[0] ?? e.start}` : e.start,
    `${CONF[e.time.confidence]}${e.time.pinned ? "*" : ""}`,
    e.lane,
    e.sub ? `${e.kind} ${e.sub}` : e.kind,
    e.title + (e.leg && e.leg.basis !== "routed" ? " ~" : ""),
    e.durationMin ? fmtHM(e.durationMin) : "",
    e.time.source,
  ]);
  const head = ["time", "conf", "lane", "kind", "entry", "duration", "source"];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (r: string[]) => r.map((c, i) => String(c).padEnd(widths[i]!)).join("  ").trimEnd();
  const out = [`Day ${t.day}  ${t.variant.label} (${t.variant.reason})  ${t.span.start} to ${t.span.end}, ${fmtHM(t.span.minutes)}`, line(head), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(line)];
  for (const n of t.notes) out.push(`note: ${n.text}`);
  for (const w of t.warnings) out.push(`warn ${w.code}${w.lane !== "all" ? ` [${w.lane}]` : ""}: ${w.message}`);
  out.push("* pinned   ~ estimated leg");
  return out.join("\n");
}

function main(): void {
  const { values } = parseArgs({
    options: { input: { type: "string" }, day: { type: "string" }, profile: { type: "string" }, pace: { type: "string" }, variant: { type: "string" }, split: { type: "boolean" }, adults: { type: "string" }, json: { type: "boolean" }, help: { type: "boolean" } },
  });
  if (values.help || !values.input) {
    process.stdout.write(USAGE);
    process.exit(values.help ? 0 : 2);
  }
  const doc = JSON.parse(readFileSync(values.input, "utf8")) as ScheduleDayInput | ScheduleDayInput[];
  const days = Array.isArray(doc) ? doc : [doc];
  const n = values.day ? Number(values.day) : days[0]!.day;
  const day = days.find((d) => d.day === n);
  if (!day) {
    process.stderr.write(`no day ${n} in the input\n`);
    process.exit(2);
  }
  const party = values.profile ?? "adults";
  const mm = /^family-(\d{1,2})$/.exec(party);
  const profile: Profile = {
    party: mm ? "family" : "adults",
    youngest: mm ? Number(mm[1]) : null,
    pace: (["relaxed", "standard", "full"].includes(values.pace ?? "") ? values.pace : "standard") as Pace,
    adults: values.adults === "1" ? 1 : 2,
    walkKm: null,
    split: !!values.split,
  };
  const t = scheduleDay(day, profile, { variant: values.variant ?? null });
  process.stdout.write(`${values.json ? JSON.stringify(t, null, 2) : renderTable(t)}\n`);
}

main();
