import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { sunFor } from "../../../core/src/sun/index.ts";
import type { Place } from "../data/places";
import { dayDate, fmtDay } from "../data/trip";
import { leg } from "../lib/geo";
import { useStore, type DayPlan } from "../state/store";
import { Delta, DriveNum, Num } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { AddBox } from "./AddBox";
import { ItemCard, LegRow, MotionShell } from "./ItemCard";

export function DaySection({ plan, ids, activeId, collapsed, onToggle }: { plan: DayPlan; ids: string[]; activeId?: string; collapsed?: boolean; onToggle?: () => void }) {
  const { s, place, focus, setBase } = useStore();
  const day = s.trip.days.find(d => d.n === plan.n)!;
  const date = dayDate(s.trip.start, plan.n);
  const iso = date.toISOString().slice(0, 10);
  const sunAt = plan.end ?? plan.stops[plan.stops.length - 1]?.place ?? plan.start;
  const sun = sunAt ? sunFor(sunAt.lat, sunAt.lng, iso, s.trip.zone) : null;
  const { setNodeRef, isOver } = useDroppable({ id: `day:${plan.n}` });
  const [basePick, setBasePick] = useState(false);
  const [openDone, setOpenDone] = useState(true);
  const stops = ids.map(id => s.trip.items[id]).filter(Boolean).map(item => ({ item, place: place(item.placeId)! })).filter(x => x.place);
  // legs shown between cards follow the live (possibly dragged) order
  const routedPlaces = [plan.start, ...stops.filter(x => x.item.variant !== "B").map(x => x.place)];
  const legBefore = (k: number): ReturnType<typeof leg> | undefined => {
    const x = stops[k]; if (x.item.variant === "B") return undefined;
    const idx = stops.slice(0, k + 1).filter(y => y.item.variant !== "B").length; // position in routedPlaces
    const from = routedPlaces[idx - 1]; return from ? leg(from, x.place) : undefined;
  };
  const lastRouted = routedPlaces[routedPlaces.length - 1];
  const legHome = plan.end && lastRouted ? leg(lastRouted, plan.end) : undefined;
  const nightsSame = s.trip.days.filter(d => d.base && d.base === day.base).map(d => d.n);

  return (
    <section className={`day ${s.focusDay === plan.n ? "focus" : ""} ${isOver ? "over" : ""}`} id={`day-${plan.n}`} data-day={plan.n} ref={setNodeRef} aria-labelledby={`dh-${plan.n}`}>
      <header className="day-head" onClick={() => focus(plan.n)}>
        <button className="day-toggle" aria-expanded={!collapsed} aria-label={collapsed ? "Expand day" : "Collapse day"} onClick={e => { e.stopPropagation(); onToggle?.(); }}><Icon name={collapsed ? "chevron" : "down"} /></button>
        <div className="day-id"><span className="sign day-n">Day {plan.n}</span><span className="num muted">{fmtDay(date)}</span></div>
        <h2 id={`dh-${plan.n}`} className="day-title">{day.title}</h2>
        <div className="day-totals">
          {plan.driveMin > 0 && <span className="tot" title="Driving"><Icon name="car" size={14} /><DriveNum min={plan.driveMin} /><Delta value={plan.driveMin} /></span>}
          {plan.walkKm > 0 && <span className="tot" title="Walking"><Icon name="walk" size={14} /><Num value={plan.walkKm} format={v => `${v.toFixed(1)} km`} /></span>}
          {plan.gainM > 0 && <span className="tot" title="Climb"><Icon name="peak" size={14} /><Num value={plan.gainM} format={v => `${Math.round(v)} m`} /></span>}
          {sun && <span className="tot" title={`Sunrise ${sun.sunrise}, sunset ${sun.sunset}`}><Icon name="sunset" size={14} /><span className="num">{sun.sunset}</span></span>}
        </div>
      </header>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div className="day-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .22, ease: [.2, .8, .2, 1] }}
            style={{ overflow: "hidden" }} onAnimationComplete={def => { if ((def as { height?: unknown }).height === "auto") setOpenDone(true); }} onAnimationStart={() => setOpenDone(false)}
            data-open={openDone ? "1" : "0"}>
            {plan.warnings.length > 0 && <div className="warns">{plan.warnings.map(w => <span key={w} className={`chip ${w.includes("needs") ? "crit" : "warn"}`}><Icon name="alert" size={12} />{w}</span>)}</div>}
            {plan.start && <div className="endpoint num muted"><Icon name="home" size={14} /> From {plan.start.name}</div>}
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="items" role="list">
                <AnimatePresence initial={false}>
                  {stops.map((x, k) => {
                    const l = legBefore(k);
                    return (
                      <MotionShell key={x.item.id} id={x.item.id} enabled={!activeId}>
                        {l && <LegRow l={l} />}
                        <ItemCard item={x.item} place={x.place} index={k + 1} dragging={activeId === x.item.id} />
                      </MotionShell>
                    );
                  })}
                </AnimatePresence>
                {stops.length === 0 && <div className="empty-day">Nothing planned. Type below, or drag a place here from Ideas.</div>}
              </div>
            </SortableContext>
            {legHome && <LegRow l={legHome} />}
            <div className="sleep">
              <button className={`sleep-btn ${plan.end ? "" : "unset"}`} onClick={() => setBasePick(v => !v)} aria-expanded={basePick}>
                <Icon name="bed" />
                {plan.end ? <><span>Sleep: <b>{plan.end.name}</b></span>{nightsSame.length > 1 && <span className="muted num"> nights {nightsSame[0]}-{nightsSame[nightsSame.length - 1]}</span>}</> : plan.n <= s.trip.nights ? <span>Set where you sleep</span> : <span className="muted">Last day, no night</span>}
                <Icon name="edit" size={14} />
              </button>
              <AnimatePresence>
                {basePick && (
                  <motion.div className="base-pick" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <BasePicker plan={plan} onDone={() => setBasePick(false)} onPick={(p, through) => { setBase(plan.n, p.id, through); setBasePick(false); }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <AddBox target={{ day: plan.n }} base={plan.end ?? plan.start} anchor={stops[stops.length - 1]?.place ?? plan.end} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** choosing a base: stays and towns ranked by total drive time to the day's stops */
function BasePicker({ plan, onPick, onDone }: { plan: DayPlan; onPick: (p: Place, through?: number) => void; onDone: () => void }) {
  const { s, place } = useStore();
  const [run, setRun] = useState(1);
  const stops = plan.stops.map(x => x.place);
  const cands = ["hotel-san-candido", "hotel-cortina", "hotel-ortisei", "hotel-bolzano", "dobbiaco", "san-vito", "santa-cristina", "selva", "san-candido", "cortina", "ortisei"]
    .map(id => place(id)!).map(p => ({ p, cost: stops.reduce((a, x) => a + 2 * leg(p, x).min, 0) })).sort((a, b) => a.cost - b.cost).slice(0, 6);
  const max = s.trip.nights - plan.n + 1;
  return (
    <div className="base-picker">
      <div className="base-picker-head"><span className="label">Where you sleep after day {plan.n}</span>
        <label className="muted">for <select value={run} onChange={e => setRun(Number(e.target.value))}>{Array.from({ length: Math.min(max, 6) }, (_, k) => <option key={k} value={k + 1}>{k + 1} night{k ? "s" : ""}</option>)}</select></label>
        <button className="btn ghost" onClick={onDone} aria-label="Close"><Icon name="x" /></button></div>
      <ul>
        {cands.map(({ p, cost }) => (
          <li key={p.id}><button className="addbox-row" onClick={() => onPick(p, plan.n + run - 1)}>
            <span className="glyph"><Icon name={p.kind === "stay" ? "bed" : "home"} /></span>
            <span className="addbox-name">{p.name}<small className="muted"> {p.area}</small></span>
            <span className="addbox-meta num muted">{stops.length ? `≈ ${Math.round(cost)} min driving to today's stops` : ""}</span>
          </button></li>
        ))}
      </ul>
      <AddBox target={{ day: plan.n }} kinds={["stay", "town"]} placeholder="Search stays and towns" onPicked={p => onPick(p, plan.n + run - 1)} />
    </div>
  );
}
