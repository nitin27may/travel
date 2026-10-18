// The add box: predictive search at the end of every day and list (docs/v2/design/interactions.md §1).
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Place } from "../data/places";
import { parse, search, type Hit } from "../lib/search";
import { leg, fmtMin } from "../lib/geo";
import { useStore, type Target } from "../state/store";
import { Icon } from "../ui/Icon";
import { KindGlyph } from "./ItemCard";

const GROUP = { trip: "In this trip", near: "Near tonight's base", elsewhere: "Elsewhere" } as const;

export function AddBox({ target, base, anchor, kinds, placeholder = "Add a place, a time, or paste a link", onPicked, autoFocus }: {
  target: Target; base?: Place; anchor?: Place; kinds?: Place["kind"][]; placeholder?: string;
  onPicked?: (p: Place) => void; autoFocus?: boolean;
}) {
  const { s, add, place, move } = useStore();
  const [raw, setRaw] = useState("");
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const parsed = parse(raw);
  const url = raw.match(/https?:\/\/\S+/)?.[0];
  const inTrip = useMemo(() => new Set(Object.values(s.trip.items).map(x => x.placeId)), [s.trip.items]);
  const hits: Hit[] = useMemo(() => search(parsed.q, inTrip, base, Object.values(s.custom), kinds), [parsed.q, inTrip, base, s.custom, kinds]);
  const rows: ({ type: "hit"; hit: Hit } | { type: "custom" } | { type: "link" })[] = [
    ...(url ? [{ type: "link" as const }] : []),
    ...hits.map(hit => ({ type: "hit" as const, hit })),
    ...(parsed.q && !onPicked ? [{ type: "custom" as const }] : []),
  ];
  const to: Target = parsed.day && s.trip.days.some(d => d.n === parsed.day) ? { day: parsed.day } : target;

  function choose(k: number) {
    const r = rows[k]; if (!r) return;
    let p: Place;
    if (r.type === "hit") p = r.hit.place;
    else {
      const near = anchor ?? base ?? place("cortina")!;
      const name = r.type === "link" ? (url!.replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0]) : raw.replace(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b|\bday\s*\d+\b/gi, "").trim();
      p = { id: `c${Date.now()}`, name: name || "My place", kind: "sight", area: "My places", lng: near.lng + 0.012, lat: near.lat - 0.008, catalog: false, summary: r.type === "link" ? `From ${url}` : "Your own place. Drag its pin on the map to where it is." };
    }
    const existing = r.type === "hit" && r.hit.group === "trip" && !onPicked ? Object.values(s.trip.items).find(x => x.placeId === p.id) : undefined;
    if (onPicked) onPicked(p);
    else if (existing) move(existing.id, to, undefined, parsed.time);   // already planned: move it, never duplicate
    else add(p, to, { time: parsed.time });
    setRaw(""); setOpen(false); setI(0);
  }
  function key(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setI(x => Math.min(rows.length - 1, x + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(i); }
    else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
  }
  let lastGroup = "";
  return (
    <div className="addbox" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <label className="addbox-field">
        <Icon name="search" />
        <input ref={input} autoFocus={autoFocus} value={raw} placeholder={placeholder} aria-label={placeholder} aria-expanded={open && rows.length > 0} aria-controls="addbox-list" role="combobox" aria-autocomplete="list"
          onChange={e => { setRaw(e.target.value); setOpen(true); setI(0); }} onFocus={() => setOpen(true)} onKeyDown={key} />
        {(parsed.time || parsed.day) && <span className="chip act num">{parsed.time}{parsed.time && parsed.day ? " · " : ""}{parsed.day ? `Day ${parsed.day}` : ""}</span>}
      </label>
      <AnimatePresence>
        {open && rows.length > 0 && (
          <motion.ul id="addbox-list" role="listbox" className="addbox-list" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .14 }}>
            {rows.map((r, k) => {
              const head = r.type === "hit" && r.hit.group !== lastGroup ? (lastGroup = r.hit.group, GROUP[r.hit.group]) : null;
              return (
                <li key={k} role="presentation">
                  {head && <div className="label addbox-group">{head}</div>}
                  <button role="option" aria-selected={k === i} className={`addbox-row ${k === i ? "on" : ""}`} onMouseEnter={() => setI(k)} onMouseDown={e => e.preventDefault()} onClick={() => choose(k)}>
                    {r.type === "hit" ? <HitRow hit={r.hit} base={base} moving={r.hit.group === "trip" && !onPicked} /> :
                     r.type === "link" ? <><span className="glyph"><Icon name="link" /></span><span className="addbox-name">Add from link<small className="muted"> {url}</small></span></> :
                     <><span className="glyph"><Icon name="plus" /></span><span className="addbox-name">Add “{raw.trim()}” as my own place<small className="muted"> drop a pin, drag it into place</small></span></>}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function HitRow({ hit, base, moving }: { hit: Hit; base?: Place; moving?: boolean }) {
  const { s } = useStore();
  const p = hit.place;
  const l = base ? leg(base, p) : undefined;
  const young = s.trip.travellers.filter(t => t.age !== undefined && p.minAge && t.age < p.minAge);
  return (
    <>
      <span className="glyph"><KindGlyph kind={p.kind} /></span>
      <span className="addbox-name">{p.name}<small className="muted"> {p.area}{p.km ? ` · ${p.km} km` : ""}{p.gain && p.gain > 0 ? ` · ${p.gain} m` : ""}</small></span>
      <span className="addbox-meta">
        {young.length ? <span className="chip crit">{young[0].name} {young[0].age}: needs {p.minAge}+</span> : p.minAge ? <span className="chip ok">fits all</span> : null}
        {moving && <span className="chip act">move here</span>}
        {l && <span className="num muted">{l.mode === "drive" ? "≈ " : ""}{fmtMin(l.min)}</span>}
      </span>
    </>
  );
}
