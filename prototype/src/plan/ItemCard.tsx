import { useSortable } from "@dnd-kit/sortable";
import { motion } from "motion/react";
import { useState } from "react";
import type { Kind, Place } from "../data/places";
import type { Item } from "../data/trip";
import { fmtMin, type Leg } from "../lib/geo";
import { useStore } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { useEdge } from "./drop";
import { DragHandle } from "./Timeline";

const KIND_ICON: Record<Kind, string> = { town: "home", stay: "bed", lake: "layers", trail: "peak", viewpoint: "compass", lift: "flag", hut: "home", activity: "star", pass: "nav", sight: "flag", airport: "plane", parking: "parking" };
export const KindGlyph = ({ kind }: { kind: Kind }) => <Icon name={KIND_ICON[kind]} />;
export const KIND_LABEL: Record<Kind, string> = { town: "Town", stay: "Stay", lake: "Lake", trail: "Trail", viewpoint: "Viewpoint", lift: "Lift", hut: "Hut", activity: "Activity", pass: "Pass", sight: "Sight", airport: "Airport", parking: "Parking" };

export function LegRow({ l }: { l: Leg }) {
  return (
    <div className="legrow" aria-label={`${l.mode === "drive" ? "Drive" : "Walk"} about ${fmtMin(l.min)}, ${l.km} km`}>
      <span className="legline" />
      <Icon name={l.mode === "drive" ? "car" : "walk"} size={14} />
      <span className="num">{l.mode === "drive" ? "≈ " : ""}{fmtMin(l.min)} · {l.km} km</span>
    </div>
  );
}

export function ItemCard({ item, place, index, dragging, overlay }: { item: Item; place: Place; index?: number; dragging?: boolean; overlay?: boolean }) {
  const { s, select, setTime } = useStore();
  const sortable = useSortable({ id: item.id, disabled: overlay });
  const edge = useEdge(item.id);
  const sel = s.selected === item.id;
  const res = item.ticket ? s.trip.reservations.find(r => r.id === item.ticket) : undefined;
  const who = item.who?.length ? s.trip.travellers.filter(t => item.who!.includes(t.id)) : s.trip.travellers;
  const [editTime, setEditTime] = useState(false);
  return (
    <div ref={overlay ? undefined : sortable.setNodeRef} className={`card ${sel ? "sel" : ""} ${sortable.isDragging || dragging ? "ghosted" : ""} ${overlay ? "lifted" : ""} ${place.catalog === false ? "custom" : ""} ${edge ? `drop-${edge}` : ""}`}
      data-item={item.id} onClick={() => select(item.id)}>
      <div className="card-row">
        {index !== undefined ? <span className={`badge ${item.variant === "B" ? "lane-b" : ""}`}>{item.variant ? item.variant : index}</span> : <span className="badge hollow"><KindGlyph kind={place.kind} /></span>}
        <div className="card-main">
          <div className="card-title">
            <span className="name">{place.name}</span>
            {place.catalog === false && <span className="chip">my place</span>}
          </div>
          <div className="card-meta">
            {editTime ? (
              <input type="time" className="time-input num" autoFocus defaultValue={item.time} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}
                onBlur={e => { setEditTime(false); if (e.target.value !== (item.time ?? "")) setTime(item.id, e.target.value || undefined); }} />
            ) : (
              <button className="time num" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setEditTime(true); }}>{item.time ?? "add time"}</button>
            )}
            <span className="muted">{KIND_LABEL[place.kind]}</span>
            {place.km ? <span className="num muted">{place.km} km{place.gain ? ` · ${place.gain > 0 ? "↑" : "↓"}${Math.abs(place.gain)} m` : ""}</span> : null}
            {place.durationMin ? <span className="num muted">{fmtMin(place.durationMin)}</span> : null}
            {res && <span className={`chip ${res.status === "booked" ? "ok" : res.status === "held" ? "act" : "warn"}`}><Icon name="ticket" size={12} />{res.status === "booked" ? "booked" : res.status === "held" ? "held" : "to book"}</span>}
          </div>
          {item.note && <div className="card-note">{item.note}</div>}
        </div>
        <div className="fit" aria-label="Who is going">
          {who.map(t => {
            const no = place.minAge !== undefined && t.age !== undefined && t.age < place.minAge;
            return <Avatar key={t.id} initials={t.initials} tone={no ? "crit" : "ok"} title={no ? `${t.name} is ${t.age}; needs ${place.minAge}+` : `${t.name} fits`} />;
          })}
        </div>
        <DragHandle name={place.name} overlay={overlay} sortable={sortable} />
      </div>
    </div>
  );
}

export function MotionShell({ id, children, enabled }: { id: string; children: React.ReactNode; enabled: boolean }) {
  return (
    <motion.div layout={enabled ? "position" : false} initial={{ opacity: 0, scale: .96, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .96, height: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 40 }} data-shell={id}>
      {children}
    </motion.div>
  );
}
