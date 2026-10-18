// Trip-wide place search: type, see where each result is (map preview pin), what it is, how far it is
// from tonight's base and who it suits, then add it to the day in view, any other day, or Ideas.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Place } from "../data/places";
import { fmtMin, leg } from "../lib/geo";
import { search } from "../lib/search";
import { containerOf, useStore, type DayPlan } from "../state/store";
import { Icon } from "../ui/Icon";
import { KindGlyph, KIND_LABEL } from "./ItemCard";

export function PlaceSearch({ plans, onPreview, onJumpDay }: { plans: DayPlan[]; onPreview: (p?: Place) => void; onJumpDay: (n: number) => void }) {
  const { s, add, move, select, toast } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const focus = s.focusDay ?? 1;
  const plan = plans.find(p => p.n === focus);
  const base = plan?.end ?? plan?.start;
  const inTrip = useMemo(() => new Set(Object.values(s.trip.items).map(x => x.placeId)), [s.trip.items]);
  const hits = useMemo(() => search(q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), inTrip, base, Object.values(s.custom)), [q, inTrip, base, s.custom]);
  const cur = hits[i]?.place;
  useEffect(() => { onPreview(open ? cur : undefined); }, [cur, open]);
  useEffect(() => {
    const k = (e: globalThis.KeyboardEvent) => {
      if (e.key === "/" && !(e.target as HTMLElement)?.closest?.("input,textarea,select")) { e.preventDefault(); input.current?.focus(); setOpen(true); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);

  const itemFor = (p: Place) => Object.values(s.trip.items).find(x => x.placeId === p.id);
  const plannedDay = (p: Place) => { const it = itemFor(p); const c = it && containerOf(s.trip, it.id); return c && "day" in c ? c.day : undefined; };
  function put(p: Place, to: { day: number } | { list: string }) {
    const it = itemFor(p);
    const where = it && containerOf(s.trip, it.id);
    if (it && where && JSON.stringify(where) === JSON.stringify(to)) {
      // already there: show it, change nothing
      if ("day" in to) onJumpDay(to.day); select(it.id); toast(`${p.name} is already on ${"day" in to ? `Day ${to.day}` : "that list"}`);
    } else if (it) move(it.id, to); else add(p, to);
    setQ(""); setOpen(false); onPreview(undefined);
  }
  function key(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setI(x => Math.min(hits.length - 1, x + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
    else if (e.key === "Enter" && cur) { e.preventDefault(); put(cur, e.shiftKey ? { list: "ideas" } : { day: focus }); }
    else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
  }
  return (
    <div className="psearch" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); onPreview(undefined); } }}>
      <label className="psearch-field">
        <Icon name="search" size={18} />
        <input ref={input} value={q} placeholder="Search places, trails, huts, lakes…" aria-label="Search places" role="combobox" aria-expanded={open && hits.length > 0} aria-controls="psearch-list"
          onChange={e => { setQ(e.target.value); setOpen(true); setI(0); }} onFocus={() => setOpen(true)} onKeyDown={key} />
        <kbd className="num">/</kbd>
      </label>
      <AnimatePresence>
        {open && q.trim() && (
          <motion.div className="psearch-pop" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .14 }}>
            {hits.length === 0 ? <div className="psearch-empty muted">Nothing in the catalog matches “{q}”. Add it as your own place from any day's add box, or drop a pin on the map.</div> : (
              <>
                <ul id="psearch-list" role="listbox" className="psearch-list">
                  {hits.map((h, k) => {
                    const p = h.place; const l = base ? leg(base, p) : undefined; const d = plannedDay(p);
                    const young = s.trip.travellers.filter(t => t.age !== undefined && p.minAge && t.age < p.minAge);
                    return (
                      <li key={p.id} role="option" aria-selected={k === i} className={`psearch-row ${k === i ? "on" : ""}`} onMouseEnter={() => setI(k)} onMouseDown={e => e.preventDefault()} onClick={() => put(p, { day: focus })}>
                        <span className="glyph"><KindGlyph kind={p.kind} /></span>
                        <span className="psearch-name"><b>{p.name}</b><small className="muted">{KIND_LABEL[p.kind]} · {p.area}{p.km ? ` · ${p.km} km` : ""}{p.gain && p.gain > 0 ? ` · ↑${p.gain} m` : ""}</small></span>
                        <span className="psearch-meta">
                          {d ? <span className="chip act">Day {d}</span> : null}
                          {young.length ? <span className="chip crit">{young[0].name} {young[0].age}: {p.minAge}+</span> : null}
                          {l && <span className="num muted">{l.mode === "drive" ? "≈ " : ""}{fmtMin(l.min)}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {cur && (
                  <div className="psearch-preview">
                    <div className="label">{KIND_LABEL[cur.kind]} · {cur.area}</div>
                    <h3>{cur.name}</h3>
                    {cur.summary && <p>{cur.summary}</p>}
                    <div className="psearch-facts num">
                      {cur.km ? <span>{cur.km} km</span> : null}{cur.gain ? <span>↑{Math.abs(cur.gain)} m</span> : null}
                      {cur.hours ? <span>{cur.hours}</span> : cur.durationMin ? <span>{fmtMin(cur.durationMin)}</span> : null}
                      {cur.minAge ? <span>{cur.minAge}+</span> : null}
                    </div>
                    {cur.parking && <p className="small"><Icon name="parking" size={12} /> {cur.parking}</p>}
                    {cur.booking && <p className="small"><Icon name="ticket" size={12} /> {cur.booking}</p>}
                    <div className="psearch-actions">
                      <button className="btn primary" onMouseDown={e => e.preventDefault()} onClick={() => put(cur, { day: focus })}>{plannedDay(cur) === focus ? <>Show on Day {focus}</> : <><Icon name="plus" /> {plannedDay(cur) ? "Move" : "Add"} to Day {focus}</>}</button>
                      <select aria-label="Add to another day" value="" onMouseDown={e => e.stopPropagation()} onChange={e => { const v = e.target.value; if (v) put(cur, v === "ideas" ? { list: "ideas" } : { day: Number(v) }); }}>
                        <option value="">Other day…</option>
                        <option value="ideas">Ideas</option>
                        {s.trip.days.map(d => <option key={d.n} value={d.n}>Day {d.n}</option>)}
                      </select>
                      {plannedDay(cur) && plannedDay(cur) !== focus && <button className="btn ghost" onMouseDown={e => e.preventDefault()} onClick={() => { onJumpDay(plannedDay(cur)!); setOpen(false); }}>Go to Day {plannedDay(cur)}</button>}
                    </div>
                    <p className="muted small">Enter adds to Day {focus} · Shift+Enter adds to Ideas</p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
