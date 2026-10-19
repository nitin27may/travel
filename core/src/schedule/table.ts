// A scheduled day as a plain-text table (the review tool for authored overrides; core/bin/schedule.ts prints it).
import { fmtHM } from "./rules.ts";
import type { DayTimeline, TimelineEntry } from "./types.ts";

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

