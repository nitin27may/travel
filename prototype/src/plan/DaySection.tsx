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
import { Lane, LegRail, Row, SunMark } from "./Timeline";
import { clock, hm, timeline, type Slot } from "../lib/schedule";
import type { Traveller } from "../data/trip";
import { Avatar } from "../ui/bits";
const short = (n: string) => n.replace(/^Example (hotel|guesthouse), /, "");

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
  const nightsSame = s.trip.days.filter(d => d.base && d.base === day.base).map(d => d.n);

  // timeline: lane A routes with the shared stops; lane B items get their own column on split days
  const tl = timeline(stops.filter(x => x.item.variant !== "B"), plan.start, plan.end);
  const tlB = timeline(stops.filter(x => x.item.variant === "B"), plan.start, plan.end);
  const slotOf = new Map([...tl.slots, ...tlB.slots].map(x => [x.item.id, x]));
  type G = { kind: "shared"; slots: Slot[]; offset: number } | { kind: "split"; offset: number; lanes: { id: string; slots: Slot[]; who: Traveller[] }[] };
  const groups: G[] = []; let count = 0;
  for (const x of stops) {
    const slot = slotOf.get(x.item.id); if (!slot) continue;
    if (!x.item.variant) {
      const last = groups[groups.length - 1];
      if (last?.kind === "shared") last.slots.push(slot); else groups.push({ kind: "shared", slots: [slot], offset: count });
      count++;
    } else {
      let last = groups[groups.length - 1];
      if (last?.kind !== "split") { last = { kind: "split", offset: count, lanes: [] }; groups.push(last); }
      const lane = (last as Extract<G, { kind: "split" }>).lanes;
      let l = lane.find(z => z.id === x.item.variant);
      if (!l) { l = { id: x.item.variant!, slots: [], who: s.trip.travellers.filter(t => !x.item.who?.length || x.item.who.includes(t.id)) }; lane.push(l); lane.sort((a, b) => a.id.localeCompare(b.id)); }
      l.slots.push(slot);
    }
  }
  for (const g of groups) if (g.kind === "split") count = g.offset + Math.max(...g.lanes.map(l => l.slots.length));
  const startRow = plan.start ? (
    <Row kind="anchor" time={tl.leave !== undefined ? clock(tl.leave) : ""} sub="leave" node={<span className="dt-home"><Icon name="home" size={13} /></span>}>
      <span className="dt-anchor">Leave <b>{short(plan.start.name)}</b></span>
    </Row>
  ) : null;
  const endRow = (
    <Row kind="anchor" className="dt-end" time={tl.back !== undefined && plan.end ? clock(tl.back) : ""} sub={plan.end ? "back" : undefined} node={<span className={`dt-home ${plan.end ? "glow" : "none"}`}><Icon name="bed" size={13} /></span>}>
      <div className="sleep">
        <button className={`sleep-btn ${plan.end ? "" : "unset"}`} onClick={() => setBasePick(v => !v)} aria-expanded={basePick}>
          {plan.end ? <><span>Sleep at <b>{short(plan.end.name)}</b></span>{nightsSame.length > 1 && <span className="muted num"> · nights {nightsSame[0]}–{nightsSame[nightsSame.length - 1]}</span>}</> : plan.n <= s.trip.nights ? <span>Set where you sleep</span> : <span className="muted">Last day · no night here</span>}
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
    </Row>
  );

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
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="dt" role="list">
                {groups.map((g, gi) => g.kind === "shared"
                  ? <Lane key={`g${gi}`} slots={g.slots} activeId={activeId} sun={gi === groups.length - 1 ? sun : null} offset={g.offset} until={tl.back}
                      startNode={gi === 0 ? startRow : undefined} />
                  : (
                    <div key={`g${gi}`} className="dt-split">
                      <div className="dt-split-head"><span className="label">Split day</span></div>
                      <div className="dt-split-cols">
                        {g.lanes.map(l => (
                          <div key={l.id} className={`dt-col lane-${l.id}`}>
                            <div className="dt-col-head">{l.who.map(t => <Avatar key={t.id} initials={t.initials} tone="ok" title={t.name} />)}<span>{l.who.map(t => t.name).join(" + ")}</span></div>
                            <Lane slots={l.slots} activeId={activeId} offset={g.offset} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                {groups.length === 0 && startRow}
                {stops.length === 0 && <div className="empty-day">Nothing planned. Type below, or drag a place here from Ideas.</div>}
                <LegRail l={tl.legHome} />
                {endRow}
                {sun && tl.back !== undefined && (hm(sun.sunset) ?? 0) >= tl.back && <SunMark label={`Sunset ${sun.sunset}`} icon="sunset" />}
              </div>
            </SortableContext>
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
