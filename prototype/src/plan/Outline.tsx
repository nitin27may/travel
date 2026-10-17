import { useDroppable } from "@dnd-kit/core";
import { dayDate } from "../data/trip";
import { fmtMin } from "../lib/geo";
import { useStore, type DayPlan } from "../state/store";
import { Icon } from "../ui/Icon";

const town = (name?: string) => name?.replace(/^Example (hotel|guesthouse), /, "") ?? "";

export function Outline({ plans, lists, onJump }: { plans: DayPlan[]; lists: Record<string, string[]>; onJump: (id: string) => void }) {
  const { s } = useStore();
  const booked = s.trip.reservations.filter(r => r.status === "booked").length;
  const tasksDone = s.trip.tasks.filter(t => t.done).length;
  return (
    <nav className="outline" aria-label="Trip outline">
      <div className="outline-group">
        <span className="label">Overview</span>
        <button className="ol-row" onClick={() => onJump("overview")}><Icon name="ticket" size={14} /><span>Bookings</span><span className="num muted">{booked}/{s.trip.reservations.length}</span></button>
        <button className="ol-row" onClick={() => onJump("overview")}><Icon name="check" size={14} /><span>Tasks</span><span className="num muted">{tasksDone}/{s.trip.tasks.length}</span></button>
      </div>
      <div className="outline-group">
        <span className="label">Lists</span>
        {s.trip.lists.map(l => <OlList key={l.id} id={l.id} name={l.name} count={lists[`list:${l.id}`]?.length ?? 0} onJump={() => onJump(`list-${l.id}`)} />)}
      </div>
      <div className="outline-group">
        <span className="label">Days</span>
        {plans.map((p, k) => {
          const prev = plans[k - 1];
          const sameBase = prev && prev.end?.id === p.end?.id;
          return <OlDay key={p.n} p={p} sameBase={!!sameBase} onJump={() => onJump(`day-${p.n}`)} />;
        })}
      </div>
    </nav>
  );
}

function OlList({ id, name, count, onJump }: { id: string; name: string; count: number; onJump: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `ol-list:${id}` });
  return <button ref={setNodeRef} className={`ol-row ${isOver ? "over" : ""}`} onClick={onJump}><Icon name="list" size={14} /><span>{name}</span><span className="num muted">{count}</span></button>;
}
function OlDay({ p, sameBase, onJump }: { p: DayPlan; sameBase: boolean; onJump: () => void }) {
  const { s } = useStore();
  const { setNodeRef, isOver } = useDroppable({ id: `ol-day:${p.n}` });
  const d = dayDate(s.trip.start, p.n);
  const hasCrit = p.warnings.some(w => w.includes("needs") || w.includes("No stay"));
  return (
    <button ref={setNodeRef} className={`ol-day ${s.focusDay === p.n ? "focus" : ""} ${isOver ? "over" : ""}`} onClick={onJump} aria-label={`Day ${p.n}${p.warnings.length ? `, ${p.warnings.length} warnings` : ""}`}>
      <span className="sign ol-n">{p.n}</span>
      <span className="ol-body">
        <span className="ol-date num">{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" })}</span>
        <span className={`ol-base ${sameBase ? "same" : ""}`}>{p.end ? town(p.end.name) : p.n <= s.trip.nights ? <em className="crit-text">no stay</em> : "home"}</span>
      </span>
      <span className="ol-side">
        {p.driveMin > 0 && <span className="num muted">{fmtMin(p.driveMin)}</span>}
        {p.warnings.length > 0 && <span className={`dot ${hasCrit ? "crit" : "warn"}`} aria-hidden="true" />}
      </span>
    </button>
  );
}
