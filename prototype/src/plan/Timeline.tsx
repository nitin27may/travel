// A day as a timeline: time down the left, a rail with stops as nodes and travel as rail segments,
// free time and clashes between stops, sunrise/sunset where they fall, home base at both ends.
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import type { Place } from "../data/places";
import type { Item } from "../data/trip";
import { fmtMin, type Leg } from "../lib/geo";
import { clock, hm, type Slot } from "../lib/schedule";
import { useStore } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { KindGlyph, KIND_LABEL } from "./ItemCard";

export function Row({ time, sub, node, children, kind = "stop", style, className = "", refEl, ...rest }: {
  time?: ReactNode; sub?: ReactNode; node?: ReactNode; children: ReactNode; kind?: "stop" | "leg" | "anchor" | "mark"; style?: React.CSSProperties; className?: string; refEl?: (el: HTMLElement | null) => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div ref={refEl} className={`dt-row dtr-${kind} ${className}`} style={style} {...rest}>
      <div className="dt-time num">{time}{sub && <small>{sub}</small>}</div>
      <div className="dt-rail">{node}</div>
      <div className="dt-body">{children}</div>
    </div>
  );
}

export function LegRail({ l, free, late, fixedAt }: { l?: Leg; free?: number; late?: number; fixedAt?: string }) {
  if (!l && !free && !late) return null;
  const h = l ? Math.min(64, 20 + l.min * 0.35) : 18;
  return (
    <Row kind="leg" style={{ minHeight: h }} className={l?.mode === "walk" ? "walk" : "drive"}>
      <span className="dt-leg">
        {l && <><Icon name={l.mode === "drive" ? "car" : "walk"} size={13} /><span className="num">{l.mode === "drive" ? "≈ " : ""}{fmtMin(l.min)} · {l.km} km</span></>}
        {free ? <span className="chip num">free {fmtMin(free)}</span> : null}
        {late ? <span className="chip crit num"><Icon name="alert" size={12} />arrives {fmtMin(late)} after {fixedAt}</span> : null}
      </span>
    </Row>
  );
}

export function StopRow({ slot, index, lane, dragging, overlay }: { slot: Slot; index: number; lane?: string; dragging?: boolean; overlay?: boolean }) {
  const { s, select, setTime } = useStore();
  const { item, place } = slot;
  const sortable = useSortable({ id: item.id, disabled: overlay });
  const sel = s.selected === item.id;
  const res = item.ticket ? s.trip.reservations.find(r => r.id === item.ticket) : undefined;
  const who = item.who?.length ? s.trip.travellers.filter(t => item.who!.includes(t.id)) : s.trip.travellers;
  const blocked = who.filter(t => place.minAge !== undefined && t.age !== undefined && t.age < place.minAge);
  const partial = item.who?.length && item.who.length < s.trip.travellers.length;
  const [editTime, setEditTime] = useState(false);
  const dur = slot.end - slot.start;
  const h = Math.max(54, Math.min(150, 40 + dur * 0.28));      // semi-proportional: long stops look long
  const style = overlay ? undefined : { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition, minHeight: h };
  return (
    <Row refEl={overlay ? undefined : sortable.setNodeRef} style={overlay ? { minHeight: 54 } : style}
      className={`${sel ? "sel" : ""} ${sortable.isDragging || dragging ? "ghosted" : ""} ${overlay ? "lifted" : ""} ${place.catalog === false ? "custom" : ""}`}
      time={editTime ? undefined : <button className={`dt-clock ${slot.fixed ? "fixed" : "flow"}`} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setEditTime(true); }} aria-label={`Start ${clock(slot.start)}${slot.fixed ? "" : ", estimated"}. Change time`}>{slot.fixed ? "" : "~"}{clock(slot.start)}</button>}
      sub={editTime ? <input type="time" className="time-input num" autoFocus defaultValue={item.time ?? clock(slot.start)} onPointerDown={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        onBlur={e => { setEditTime(false); if (e.target.value && e.target.value !== item.time) setTime(item.id, e.target.value); }} /> : <span>{clock(slot.end)}</span>}
      node={<><span className={`dt-node ${lane === "B" ? "lane-b" : ""}`}>{index}</span><span className="dt-span" /></>}
      data-item={item.id} {...(overlay ? {} : sortable.attributes)} {...(overlay ? {} : sortable.listeners)}
      onClick={() => select(item.id)} aria-label={`${place.name}, ${clock(slot.start)} to ${clock(slot.end)}. Press space to pick up and move.`}>
      <div className="dt-stop">
        <div className="dt-title"><span className="dt-glyph"><KindGlyph kind={place.kind} /></span><span className="name">{place.name}</span>
          {res && <span className={`chip ${res.status === "booked" ? "ok" : res.status === "held" ? "act" : "warn"}`}><Icon name="ticket" size={12} />{res.status === "to_book" ? "to book" : res.status}</span>}
          {place.catalog === false && <span className="chip">my place</span>}
        </div>
        <div className="dt-meta num">
          <span>{KIND_LABEL[place.kind]}</span>
          {place.km ? <span>{place.km} km{place.gain ? ` · ${place.gain > 0 ? "↑" : "↓"}${Math.abs(place.gain)} m` : ""}</span> : null}
          <span>{fmtMin(dur)}</span>
        </div>
        {item.note && <div className="dt-note">{item.note}</div>}
        {(blocked.length > 0 || partial) && (
          <div className="dt-who">
            {who.map(t => { const no = blocked.includes(t); return <Avatar key={t.id} initials={t.initials} tone={no ? "crit" : "ok"} title={no ? `${t.name} is ${t.age}; needs ${place.minAge}+` : t.name} />; })}
            <span className={blocked.length ? "crit-text" : "muted"}>{blocked.length ? `${blocked.map(t => t.name).join(", ")}: needs ${place.minAge}+` : `only ${who.map(t => t.name).join(" and ")}`}</span>
          </div>
        )}
      </div>
    </Row>
  );
}

/** a lane of the day: legs and stops in time order, sunrise and sunset dropped where they fall */
export function Lane({ slots, activeId, sun, startNode, endNode, offset, until }: {
  slots: Slot[]; activeId?: string; sun?: { sunrise: string; sunset: string } | null;
  startNode?: ReactNode; endNode?: ReactNode; offset?: number; until?: number;
}) {
  const sr = hm(sun?.sunrise), ss = hm(sun?.sunset);
  const marks: { at: number; label: string; icon: string }[] = [];
  if (sr !== undefined && slots.length && slots[0].start < sr + 60) marks.push({ at: sr, label: `Sunrise ${sun!.sunrise}`, icon: "sunrise" });
  if (ss !== undefined && (until === undefined || ss < until)) marks.push({ at: ss, label: `Sunset ${sun!.sunset}`, icon: "sunset" });
  const placed = new Set<number>();
  const markAfter = (t: number, nextStart?: number) => marks.filter((m, k) => !placed.has(k) && m.at >= t && (nextStart === undefined || m.at < nextStart) && (placed.add(k), true));
  let n = 0;
  return (
    <div className="dt-lane">
      {startNode}
      {slots.map((x, k) => {
        const next = slots[k + 1];
        const before = k === 0 ? marks.filter((m, i) => !placed.has(i) && m.at < x.start && (placed.add(i), true)) : [];
        const after = markAfter(x.start, next?.start);
        return (
          <motion.div key={x.item.id} layout={!activeId ? "position" : false} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 520, damping: 40 }}>
            {before.map(m => <SunMark key={m.label} {...m} />)}
            <LegRail l={x.legIn} free={x.free} late={x.late} fixedAt={x.item.time} />
            <StopRow slot={x} index={++n + (offset ?? 0)} lane={x.item.variant} dragging={activeId === x.item.id} />
            {after.map(m => <SunMark key={m.label} {...m} />)}
          </motion.div>
        );
      })}
      {endNode}
    </div>
  );
}
export const SunMark = ({ label, icon }: { label: string; icon: string }) => (
  <Row kind="mark" node={<span className="dt-sun"><Icon name={icon} size={12} /></span>}><span className="muted num">{label}</span></Row>
);
export type { Item };
