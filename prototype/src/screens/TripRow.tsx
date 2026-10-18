// Compact list row for the Trips page: one line of facts, one readiness bar, one next action.
import type { ScreenProps } from ".";
import { PHASE_LABEL, type TripCard } from "../data/trips";
import { Icon } from "../ui/Icon";
import { dateRange } from "./tripsutil";

const STEPS = ["Plan", "Book", "Prepare", "Go"];

export function TripRow({ t, go }: { t: TripCard; go: ScreenProps["go"] }) {
  const cur = t.ready.findIndex(r => r < 1);
  const label = `Readiness: ${STEPS.map((s, i) => `${s} ${Math.round(t.ready[i] * 100)}%`).join(", ")}`;
  return (
    <button className={`trip-row ${t.mine ? "mine" : ""} ${t.phase === "done" ? "done" : ""}`} onClick={() => go("plan", t.id)}>
      <span className="tr-main">
        <span className="tr-title">{t.title}</span>
        <span className="tr-sub muted">{t.region} · {t.kind}</span>
      </span>
      <span className="tr-when num">{dateRange(t.start, t.end)}<small className="muted">{t.nights ? `${t.nights} nights` : t.nights === 0 ? "day trip" : ""}</small></span>
      <span className="chip tr-phase">{PHASE_LABEL[t.phase]}</span>
      <span className="tr-ready" role="img" aria-label={label} title={label}>
        {t.ready.map((r, i) => <span key={i} className={`tr-seg ${i === cur ? "cur" : ""}`}><span style={{ width: `${Math.round(r * 100)}%` }} /></span>)}
      </span>
      <span className="tr-next"><Icon name={t.phase === "done" ? "check" : "flag"} size={14} /><span>{t.next ?? "Nothing pending"}</span></span>
    </button>
  );
}
