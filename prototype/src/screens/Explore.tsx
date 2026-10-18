// S06 Explore: the lens is distance from an origin; typed queries become chips; persona chips set bundles;
// zero results always offer one-tap loosening. Cards and pins are synced.
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import type { ScreenProps } from ".";
import { PLACE, PLACES, type Kind, type Place } from "../data/places";
import { leg, fmtMin, km } from "../lib/geo";
import { norm } from "../lib/search";
import { MapView, type Pin } from "../map/MapView";
import { useStore, type Target } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { KindGlyph, KIND_LABEL } from "../plan/ItemCard";
import { openPlacePage } from "./PlacePage";
import "./explore.css";

type Filters = { kinds: Kind[]; maxKm?: number; maxDrive?: number; kidsFit?: boolean; minGain?: number; text: string };
const EMPTY: Filters = { kinds: [], text: "" };
const ORIGINS = [
  { id: "cortina", label: "Cortina (tonight)" },
  { id: "ortisei", label: "Ortisei base" },
  { id: "san-candido", label: "San Candido base" },
  { id: "whitby", label: "Whitby (home)" },
];
const WHITBY: Place = { id: "whitby", name: "Whitby, ON", kind: "town", area: "Durham", lng: -78.94, lat: 43.88 };
const BROWSABLE: Kind[] = ["lake", "trail", "viewpoint", "lift", "hut", "activity", "sight"];
const PERSONAS: { id: string; label: string; f: Partial<Filters> }[] = [
  { id: "family", label: "Family 10+", f: { kidsFit: true, maxKm: 10 } },
  { id: "hard", label: "Big hike days", f: { kinds: ["trail"], minGain: 600 } },
  { id: "lakes", label: "Lakes", f: { kinds: ["lake"] } },
  { id: "views", label: "Lifts and views", f: { kinds: ["lift", "viewpoint"] } },
  { id: "short", label: "Short and easy", f: { maxKm: 5, maxDrive: 45 } },
];
const KIND_WORDS: Record<string, Kind> = { lake: "lake", lakes: "lake", trail: "trail", trails: "trail", hike: "trail", hikes: "trail", hut: "hut", huts: "hut", rifugio: "hut", lift: "lift", lifts: "lift", viewpoint: "viewpoint", view: "viewpoint", views: "viewpoint", activity: "activity", sight: "sight", museum: "sight" };

/** "lakes for kids under 8 km within 45 min" → kinds, kidsFit, maxKm, maxDrive, leftover text */
function parseQuery(raw: string): Filters {
  let s = ` ${raw.toLowerCase()} `;
  const f: Filters = { kinds: [], text: "" };
  const mk = s.match(/(?:under|below|<|max)\s*(\d+(?:\.\d+)?)\s*km/); if (mk) { f.maxKm = Number(mk[1]); s = s.replace(mk[0], " "); }
  const md = s.match(/(?:within|under|<)\s*(\d+)\s*(?:min|mins|minutes)/); if (md) { f.maxDrive = Number(md[1]); s = s.replace(md[0], " "); }
  const mh = s.match(/(?:within|under|<)\s*(\d+)\s*(?:h|hr|hrs|hours?)\b/); if (mh) { f.maxDrive = Number(mh[1]) * 60; s = s.replace(mh[0], " "); }
  if (/\b(kids?|family|children|child)\b/.test(s)) { f.kidsFit = true; s = s.replace(/\b(for )?(kids?|family|children|child)\b/g, " "); }
  for (const [w, k] of Object.entries(KIND_WORDS)) if (new RegExp(`\\b${w}\\b`).test(s)) { if (!f.kinds.includes(k)) f.kinds.push(k); s = s.replace(new RegExp(`\\b${w}\\b`, "g"), " "); }
  f.text = norm(s.replace(/\b(for|with|near|and|the|a)\b/g, " "));
  return f;
}
const merge = (a: Filters, b: Partial<Filters>): Filters => ({ ...a, ...b, kinds: [...new Set([...(a.kinds), ...(b.kinds ?? [])])] });

export function Explore({ phone, theme, go }: ScreenProps) {
  const { s, add } = useStore();
  const [origin, setOrigin] = useState("cortina");
  const [raw, setRaw] = useState("");
  const [chips, setChips] = useState<Filters>(EMPTY);
  const [hover, setHover] = useState<string>();
  const [addOpen, setAddOpen] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);
  const youngest = Math.min(...s.trip.travellers.map(t => t.age ?? 99));
  const base = origin === "whitby" ? WHITBY : PLACE[origin];
  const inTrip = useMemo(() => new Set(Object.values(s.trip.items).map(i => i.placeId)), [s.trip.items]);

  const typed = parseQuery(raw);
  const f: Filters = { ...merge(chips, typed), maxKm: typed.maxKm ?? chips.maxKm, maxDrive: typed.maxDrive ?? chips.maxDrive, kidsFit: typed.kidsFit || chips.kidsFit, minGain: chips.minGain, text: typed.text };

  const all = useMemo(() => PLACES.filter(p => BROWSABLE.includes(p.kind)).map(p => ({ p, l: leg(base, p), d: km(base, p) })), [base]);
  const pass = (x: (typeof all)[number], g: Filters) =>
    (!g.kinds.length || g.kinds.includes(x.p.kind)) &&
    (g.maxKm === undefined || (x.p.km ?? 0) <= g.maxKm) &&
    (g.maxDrive === undefined || x.l.min <= g.maxDrive) &&
    (!g.kidsFit || !x.p.minAge || x.p.minAge <= youngest) &&
    (g.minGain === undefined || (x.p.gain ?? 0) >= g.minGain) &&
    (!g.text || [x.p.name, ...(x.p.aka ?? []), x.p.area].some(n => norm(n).includes(g.text)));
  const results = all.filter(x => pass(x, f)).sort((a, b) => a.l.min - b.l.min);

  // one chip per active filter, each removable
  const active: { key: string; label: string; drop: Partial<Filters> }[] = [
    ...f.kinds.map(k => ({ key: `k-${k}`, label: KIND_LABEL[k].toLowerCase(), drop: { kinds: f.kinds.filter(x => x !== k) } })),
    ...(f.maxKm !== undefined ? [{ key: "km", label: `≤ ${f.maxKm} km`, drop: { maxKm: undefined } }] : []),
    ...(f.maxDrive !== undefined ? [{ key: "drive", label: `≤ ${fmtMin(f.maxDrive)} drive`, drop: { maxDrive: undefined } }] : []),
    ...(f.kidsFit ? [{ key: "kids", label: `fits ages ${youngest}+`, drop: { kidsFit: false } }] : []),
    ...(f.minGain !== undefined ? [{ key: "gain", label: `≥ ${f.minGain} m climb`, drop: { minGain: undefined } }] : []),
    ...(f.text ? [{ key: "text", label: `“${f.text}”`, drop: { text: "" } }] : []),
  ];
  const removeChip = (drop: Partial<Filters>) => { setChips({ ...f, ...drop }); setRaw(""); };
  const loosen = active.map(a => ({ ...a, more: all.filter(x => pass(x, { ...f, ...a.drop } as Filters)).length - results.length })).filter(a => a.more > 0).sort((a, b) => b.more - a.more).slice(0, 3);

  const kindCounts = BROWSABLE.map(k => ({ k, n: all.filter(x => pass(x, { ...f, kinds: [k] })).length }));
  const reason = (p: Place, l: ReturnType<typeof leg>) => {
    const bits: string[] = [];
    if (f.kinds.includes(p.kind)) bits.push(`matches ${KIND_LABEL[p.kind].toLowerCase()}`);
    if (!p.minAge || p.minAge <= youngest) bits.push("fits the family"); else bits.push(`needs ${p.minAge}+`);
    bits.push(`≈ ${fmtMin(l.min)} from ${base.name.replace(/, ON$/, "")}`);
    if (p.km) bits.push(`${p.km} km${f.maxKm ? ` within ${f.maxKm} km` : ""}`);
    return bits.join(" · ");
  };

  const pins: Pin[] = [
    ...(origin !== "whitby" ? [{ id: "origin", place: base, label: "", kind: "base" as const }] : []),
    ...results.slice(0, 30).map((x, i) => ({ id: `ex-${x.p.id}`, itemId: x.p.id, place: x.p, label: String(i + 1), kind: "stop" as const, dim: hover ? hover !== x.p.id : i >= 8 })),
  ];
  const doAdd = (p: Place, to: Target) => { add(p, to); setAddOpen(undefined); };

  const filterBar = (
    <div className="ex-bar">
      <div className="ex-top">
        <label className="ex-origin"><Icon name="pin" /><span className="sr">From</span>
          <select value={origin} onChange={e => setOrigin(e.target.value)} aria-label="Measure distance from">
            {ORIGINS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select></label>
        <label className="addbox-field ex-search"><Icon name="search" />
          <input value={raw} onChange={e => setRaw(e.target.value)} placeholder="Try: lakes for kids under 8 km within 45 min" aria-label="Search places" /></label>
      </div>
      <div className="ex-personas" role="group" aria-label="Quick starts">
        {PERSONAS.map(p => <button key={p.id} className="chip ex-persona" onClick={() => { setChips(merge(EMPTY, p.f)); setRaw(""); }}>{p.label}</button>)}
      </div>
      <div className="ex-chips" aria-live="polite">
        <AnimatePresence initial={false}>
          {active.map(a => (
            <motion.button key={a.key} layout className="chip act ex-chip" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .9 }} transition={{ type: "spring", stiffness: 520, damping: 40 }}
              onClick={() => removeChip(a.drop)} aria-label={`Remove filter ${a.label}`}>{a.label}<Icon name="x" size={12} /></motion.button>
          ))}
        </AnimatePresence>
        {active.length > 0 && <button className="btn ghost small" onClick={() => { setChips(EMPTY); setRaw(""); }}>Clear</button>}
        <span className="ex-count num muted">{results.length} place{results.length === 1 ? "" : "s"} · sorted by drive ≈</span>
      </div>
      <div className="ex-kinds">
        {kindCounts.map(({ k, n }) => (
          <button key={k} className={`ex-kind ${f.kinds.includes(k) ? "on" : ""}`} disabled={!n && !f.kinds.includes(k)}
            onClick={() => setChips({ ...f, kinds: f.kinds.includes(k) ? f.kinds.filter(x => x !== k) : [...f.kinds, k] })}>
            <KindGlyph kind={k} />{KIND_LABEL[k]}<span className="num">{n}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const list = (
    <div className="ex-list" ref={listRef}>
      {origin === "whitby" && (
        <div className="ex-banner"><Icon name="alert" />
          <div><b>The prototype catalog only covers the Dolomites.</b> From Whitby the nearest place here is {Math.round(Math.min(...all.map(x => x.d))).toLocaleString()} km away. In the app this lens lists day trips within your radius from home.
            <div className="ex-banner-actions"><button className="btn" onClick={() => setOrigin("cortina")}>Measure from Cortina</button><button className="btn ghost">Request research for Durham region</button></div></div>
        </div>
      )}
      {results.length === 0 && origin !== "whitby" && (
        <div className="ex-rescue">
          <h3>Nothing matches all {active.length} filter{active.length === 1 ? "" : "s"}.</h3>
          <p className="muted">Loosen one and see what appears:</p>
          <div className="ex-rescue-btns">
            {loosen.map(l => <button key={l.key} className="btn" onClick={() => removeChip(l.drop)}>Drop {l.label} <span className="num muted">+{l.more}</span></button>)}
            {!loosen.length && <button className="btn" onClick={() => { setChips(EMPTY); setRaw(""); }}>Clear all filters</button>}
          </div>
        </div>
      )}
      <div className="ex-cards">
        <AnimatePresence initial={false}>
          {(origin === "whitby" ? [] : results).map(({ p, l }, i) => {
            const there = inTrip.has(p.id);
            return (
              <motion.article key={p.id} id={`ex-card-${p.id}`} layout className={`ex-card ${hover === p.id ? "hot" : ""}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }} transition={{ type: "spring", stiffness: 520, damping: 40 }}
                onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(undefined)}>
                <div className="ex-card-head">
                  <span className="badge">{i + 1}</span>
                  <button className="ex-name" onClick={() => { openPlacePage(p); go("place"); }}>{p.name}</button>
                  <span className="num ex-drive">≈ {fmtMin(l.min)}</span>
                </div>
                <div className="card-meta"><span className="muted">{KIND_LABEL[p.kind]} · {p.area}</span>
                  {p.km ? <span className="num muted">{p.km} km{p.gain ? ` · ${p.gain > 0 ? "↑" : "↓"}${Math.abs(p.gain)} m` : ""}</span> : null}
                  {p.hours ? <span className="num muted">{p.hours}</span> : null}
                  {p.booking && <span className="chip warn"><Icon name="ticket" size={12} />book ahead</span>}
                </div>
                <p className="ex-reason"><span className="label">Why</span> {reason(p, l)}</p>
                <div className="ex-card-foot">
                  <div className="fit">{s.trip.travellers.map(t => { const no = !!p.minAge && t.age !== undefined && t.age < p.minAge; return <Avatar key={t.id} initials={t.initials} tone={no ? "crit" : "ok"} title={no ? `${t.name} is ${t.age}; needs ${p.minAge}+` : `${t.name} fits`} />; })}</div>
                  {there ? <span className="chip ok"><Icon name="check" size={12} />in this trip</span> :
                    <div className="ex-add">
                      <button className="btn primary" onClick={() => doAdd(p, { list: "ideas" })}><Icon name="plus" />Add to Ideas</button>
                      <button className="btn" aria-label="Add to a day" aria-expanded={addOpen === p.id} onClick={() => setAddOpen(addOpen === p.id ? undefined : p.id)}><Icon name="down" /></button>
                      <AnimatePresence>{addOpen === p.id && (
                        <motion.div className="ex-add-menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          {s.trip.days.map(d => <button key={d.n} className="addbox-row" onClick={() => doAdd(p, { day: d.n })}><span className="sign">Day {d.n}</span><span className="muted small">{d.title}</span></button>)}
                        </motion.div>)}</AnimatePresence>
                    </div>}
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );

  const map = (
    <div className="ex-map">
      <MapView theme={theme} plans={[]} pins={pins} selectedItem={hover} compact={phone}
        onPick={pin => { if (pin.itemId) { setHover(pin.itemId); document.getElementById(`ex-card-${pin.itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); } }}
        onPinDrag={() => undefined} onAddHere={() => undefined} />
      <div className="ex-map-note num">Distances ≈ estimated from {base.name}</div>
    </div>
  );

  return (
    <div className={`explore ${phone ? "phone" : ""}`}>
      <div className="ex-left">{filterBar}{phone && map}{list}</div>
      {!phone && map}
    </div>
  );
}
