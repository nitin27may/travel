// The place panel over the map (desktop) or as a sheet (phone): facts with sources, fit per person,
// parking and booking, links (link-only marked), and actions.
import { motion } from "motion/react";
import type { Place } from "../data/places";
import { useStore, containerOf, targetLabel } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { KindGlyph, KIND_LABEL } from "./ItemCard";
import { fmtMin } from "../lib/geo";

export function PlacePanel({ itemId, onClose, onOpenPage }: { itemId: string; onClose: () => void; onOpenPage?: (p: Place) => void }) {
  const { s, place, move, remove } = useStore();
  const item = s.trip.items[itemId]; if (!item) return null;
  const p = place(item.placeId); if (!p) return null;
  const where = containerOf(s.trip, itemId);
  const res = item.ticket ? s.trip.reservations.find(r => r.id === item.ticket) : s.trip.reservations.find(r => r.placeId === p.id);
  return (
    <motion.aside className="panel" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: .22, ease: [.2, .8, .2, 1] }} aria-label={`${p.name} details`}>
      <header className="panel-head">
        <span className="glyph big"><KindGlyph kind={p.kind} /></span>
        <div><div className="label">{KIND_LABEL[p.kind]} · {p.area}</div><h3 className="panel-title">{p.name}</h3></div>
        <button className="btn ghost" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </header>
      {p.summary && <p className="panel-summary">{p.summary}</p>}
      <div className="panel-stats num">
        {p.km ? <div><span className="label">Distance</span>{p.km} km</div> : null}
        {p.gain ? <div><span className="label">{p.gain > 0 ? "Climb" : "Descent"}</span>{Math.abs(p.gain)} m</div> : null}
        {p.hours ? <div><span className="label">Time</span>{p.hours}</div> : p.durationMin ? <div><span className="label">Time</span>{fmtMin(p.durationMin)}</div> : null}
        {p.minAge ? <div><span className="label">Age</span>{p.minAge}+</div> : null}
      </div>
      <div className="panel-sec">
        <span className="label">Who it fits</span>
        <div className="fitlist">
          {s.trip.travellers.map(t => {
            const no = p.minAge !== undefined && t.age !== undefined && t.age < p.minAge;
            return <div key={t.id} className="fitrow"><Avatar initials={t.initials} tone={no ? "crit" : "ok"} /><span>{t.name}{t.age ? <span className="muted num"> {t.age}</span> : null}</span><span className={no ? "crit-text" : "ok-text"}>{no ? `needs ${p.minAge}+` : "fits"}</span></div>;
          })}
        </div>
      </div>
      {p.parking && <div className="panel-sec"><span className="label"><Icon name="parking" size={12} /> Parking and access</span><p>{p.parking}</p></div>}
      {(p.booking || res) && (
        <div className="panel-sec"><span className="label"><Icon name="ticket" size={12} /> Booking</span>
          {res ? <p><span className={`chip ${res.status === "booked" ? "ok" : res.status === "held" ? "act" : "warn"}`}>{res.status === "to_book" ? "to book" : res.status}</span> {res.title}{res.opensAt ? <span className="muted"> · {res.opensAt}</span> : null}</p> : <p>{p.booking}</p>}
        </div>
      )}
      {p.facts && <div className="panel-sec"><span className="label">Facts and sources</span>
        <dl className="facts">{p.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}<small className="muted"> · {f.source}{f.read ? `, read ${f.read}` : ""}</small></dd></div>)}</dl></div>}
      {p.links && <div className="panel-sec"><span className="label">Links</span>
        <ul className="links">{p.links.map(l => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer"><Icon name="link" size={13} />{l.label}</a>{l.linkOnly && <span className="chip">link only</span>}</li>)}</ul></div>}
      {p.catalog === false && <p className="muted small">Your own place. Drag its pin on the map to correct where it is; the legs update as you drag.</p>}
      <footer className="panel-actions">
        <label className="muted small">Move to <select value={where ? JSON.stringify(where) : ""} onChange={e => move(itemId, JSON.parse(e.target.value))}>
          {s.trip.lists.map(l => <option key={l.id} value={JSON.stringify({ list: l.id })}>{l.name}</option>)}
          {s.trip.days.map(d => <option key={d.n} value={JSON.stringify({ day: d.n })}>Day {d.n}</option>)}
        </select></label>
        <span className="muted small">{where ? targetLabel(s.trip, where) : ""}</span>
        {onOpenPage && p.catalog !== false && <button className="btn" onClick={() => onOpenPage(p)}>Open page</button>}
        <button className="btn ghost danger" onClick={() => { remove(itemId); onClose(); }}>Remove</button>
      </footer>
    </motion.aside>
  );
}
