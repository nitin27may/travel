// Trip outline: days grouped under where you sleep, each with a mini timeline of its shape (drive vs
// stops between 05:00 and 22:00) and a warning dot; lists and the overview above. Every row is a drop target.
import { useDroppable } from "@dnd-kit/core";
import { dayDate } from "../data/trip";
import { fmtMin } from "../lib/geo";
import { timeline } from "../lib/schedule";
import { useStore, type DayPlan } from "../state/store";
import { Icon } from "../ui/Icon";

const town = (name?: string) => name?.replace(/^Example (hotel|guesthouse), /, "") ?? "";
const T0 = 5 * 60, T1 = 22 * 60;
const pct = (m: number) => `${Math.max(0, Math.min(100, ((m - T0) / (T1 - T0)) * 100))}%`;

export function Outline({ plans, lists, onJump }: { plans: DayPlan[]; lists: Record<string, string[]>; onJump: (id: string) => void }) {
  const { s } = useStore();
  const booked = s.trip.reservations.filter(r => r.status === "booked").length;
  const tasksDone = s.trip.tasks.filter(t => t.done).length;
  // group consecutive days by the night's base
  const groups: { base?: string; name: string; days: DayPlan[] }[] = [];
  for (const p of plans) {
    const key = p.end?.id ?? `none-${p.n}`;
    const last = groups[groups.length - 1];
    if (last && last.base === key) last.days.push(p);
    else groups.push({ base: key, name: p.end ? town(p.end.name) : p.n <= s.trip.nights ? "No stay yet" : "Home", days: [p] });
  }
  return (
    <nav className="outline" aria-label="Trip outline">
      <div className="ol-overview">
        <button className="ol-stat" onClick={() => onJump("overview")}><span className="num">{booked}/{s.trip.reservations.length}</span><span className="label">booked</span></button>
        <button className="ol-stat" onClick={() => onJump("overview")}><span className="num">{tasksDone}/{s.trip.tasks.length}</span><span className="label">tasks</span></button>
      </div>
      <div className="outline-group">
        <span className="label">Lists</span>
        {s.trip.lists.map(l => <OlList key={l.id} id={l.id} name={l.name} count={lists[`list:${l.id}`]?.length ?? 0} onJump={() => onJump("shelf")} />)}
      </div>
      <div className="outline-group">
        <span className="label">Days</span>
        {groups.map((g, k) => (
          <div key={k} className="ol-base-group">
            <div className={`ol-base-head ${g.base?.startsWith("none") && g.name !== "Home" ? "crit" : ""}`}>
              <Icon name={g.name === "Home" ? "plane" : "bed"} size={13} />
              <span>{g.name}</span>
              {g.days[0].n <= s.trip.nights && <span className="num muted">{g.days.length} night{g.days.length > 1 ? "s" : ""}</span>}
            </div>
            {g.days.map(p => <OlDay key={p.n} p={p} onJump={() => onJump(`day-${p.n}`)} />)}
          </div>
        ))}
      </div>
    </nav>
  );
}

function OlList({ id, name, count, onJump }: { id: string; name: string; count: number; onJump: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `ol-list:${id}` });
  return <button ref={setNodeRef} className={`ol-row ${isOver ? "over" : ""}`} onClick={onJump}><Icon name="list" size={14} /><span>{name}</span><span className="num muted">{count}</span></button>;
}

function OlDay({ p, onJump }: { p: DayPlan; onJump: () => void }) {
  const { s } = useStore();
  const { setNodeRef, isOver } = useDroppable({ id: `ol-day:${p.n}` });
  const d = dayDate(s.trip.start, p.n);
  const hasCrit = p.warnings.some(w => w.includes("needs") || w.includes("No stay"));
  const tl = timeline(p.stops.filter(x => x.item.variant !== "B"), p.start, p.end);
  const clash = tl.slots.some(x => x.late);
  return (
    <button ref={setNodeRef} className={`ol-day ${s.focusDay === p.n ? "focus" : ""} ${isOver ? "over" : ""}`} onClick={onJump}
      aria-label={`Day ${p.n}, ${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}${p.warnings.length ? `, ${p.warnings.length} warnings` : ""}`}>
      <span className="sign ol-n">{p.n}</span>
      <span className="ol-body">
        <span className="ol-date num">{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" })}</span>
        <span className="spark" aria-hidden="true">
          {tl.slots.map(x => (
            <span key={x.item.id}>
              {x.legIn && x.legIn.mode === "drive" && <i className="sp-drive" style={{ left: pct(x.start - x.legIn.min), width: `calc(${pct(x.start)} - ${pct(x.start - x.legIn.min)})` }} />}
              <i className={`sp-stop ${x.late ? "late" : ""}`} style={{ left: pct(x.start), width: `max(3px, calc(${pct(x.end)} - ${pct(x.start)}))` }} />
            </span>
          ))}
        </span>
      </span>
      <span className="ol-side">
        <span className="num muted">{p.driveMin ? fmtMin(p.driveMin) : ""}</span>
        {(p.warnings.length > 0 || clash) && <span className={`dot ${hasCrit || clash ? "crit" : "warn"}`} aria-hidden="true" />}
      </span>
    </button>
  );
}
