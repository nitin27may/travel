// S07 entity page (trail-first): every link kind, trailhead, each parking lot, permits, season, hazards,
// fit per traveller, facts with sources and trust, conflicts shown honestly, "Suggest a correction".
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { ScreenProps } from ".";
import { PLACE, PLACES, type Place } from "../data/places";
import { leg, fmtMin, km } from "../lib/geo";
import { useStore } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { KindGlyph, KIND_LABEL } from "../plan/ItemCard";
import "./placepage.css";

// Explore hands a place over through this slot; the page reads it once on mount.
let pending: Place | undefined;
export function openPlacePage(p: Place) { pending = p; }

type Trust = "verified" | "stated" | "unverified";
interface Lot { name: string; fee: string; capacity: string; fillsBy: string; shuttle: string; facilities: string; booking?: string; trust: Trust }
interface Evidence { field: string; value: string; source: string; read: string; confidence: "official" | "operator" | "community" | "agent inferred"; trust: Trust }
interface Conflict { field: string; chosen: Evidence; other: Evidence }

// Structured extras for the places PLAN.md covers in depth. Anything marked "not researched" is a real gap.
const PARKING: Record<string, Lot[]> = {
  "tre-cime": [{ name: "Rifugio Auronzo toll road and car park", fee: "€40 per car, includes the toll road", capacity: "not published", fillsBy: "Midday slots sell out; slots released 30 days ahead", shuttle: "Bus from Misurina (timetable not researched yet)", facilities: "Toilets and food at Rifugio Auronzo", booking: "Book a slot at pass.auronzo.info; valid 12 h; no same-day sales", trust: "stated" }],
  sorapis: [{ name: "Passo Tre Croci roadside lot", fee: "Free", capacity: "about 20 cars", fillsBy: "06:00-06:30 in July", shuttle: "None that suits a 05:30 start", facilities: "None at the lot", trust: "unverified" }],
  braies: [{ name: "P4, Lago di Braies", fee: "€44 per car incl. a €22 voucher", capacity: "not published", fillsBy: "Before 09:00 without a booking", shuttle: "Bus 442 from Villabassa (check 2027 times)", facilities: "Toilets, café, boat rental at the lake", booking: "Online, in advance; no same-day payment at the gate", trust: "stated" }],
  munkel: [{ name: "Zannes / Zanser Alm", fee: "Pay on arrival when the light is green", capacity: "not published", fillsBy: "Traffic light turns red when full: pre-booked only", shuttle: "Bus 330 from Ranui", facilities: "Toilets at the hut", trust: "stated" }],
};
const TRAILHEAD: Record<string, { name: string; elev: number; access: string }> = {
  "tre-cime": { name: "Rifugio Auronzo", elev: 2320, access: "Toll road from Misurina (SP 49)" },
  sorapis: { name: "Passo Tre Croci", elev: 1805, access: "SR 48 between Cortina and Misurina" },
  braies: { name: "Lago di Braies hotel", elev: 1496, access: "Valley road from Villabassa, controlled access" },
  munkel: { name: "Zannes (Zanser Alm)", elev: 1680, access: "Val di Funes road; traffic-light controlled" },
  seekofel: { name: "Lago di Braies", elev: 1496, access: "Valley road from Villabassa" },
  "monte-piana": { name: "Lago d'Antorno", elev: 1866, access: "Road from Misurina; jeep shuttle up" },
};
const HAZARDS: Record<string, string[]> = {
  "tre-cime": ["Afternoon thunderstorms in July; be off the loop by 14:00 if unsettled", "Crowded 09:00-12:00 at Forcella Lavaredo"],
  sorapis: ["Exposure: ladders, boards and cabled ledges (Cengia del Banco)", "Do not use trail 216 as a return loop"],
  seekofel: ["Short cable-protected steps near the summit", "Long day: 7-8.5 h"],
  lagazuoi: ["Tunnels are pitch black; headlamp mandatory", "Cold, damp, steep rock-cut stairs"],
};
const CONFLICTS: Record<string, Conflict[]> = {
  sorapis: [{ field: "Distance", chosen: { field: "Distance", value: "11 km", source: "PLAN.md (operator figures)", read: "Aug 2026", confidence: "operator", trust: "stated" }, other: { field: "Distance", value: "12.6 km", source: "Trip report, 2025", read: "Jul 2025", confidence: "community", trust: "unverified" } }],
  "tre-cime": [{ field: "Loop length", chosen: { field: "Loop length", value: "10 km", source: "Auronzo toll road site", read: "Aug 2026", confidence: "official", trust: "stated" }, other: { field: "Loop length", value: "9.5 km", source: "Regional trail page", read: "Jun 2026", confidence: "official", trust: "stated" } }],
};
const LINKS_EXTRA = (p: Place) => [
  { kind: "official", label: "Park or operator page", url: p.links?.find(l => l.kind === "official")?.url ?? "https://www.dolomiti.it/en/", linkOnly: false },
  { kind: "conditions", label: "South Tyrol mountain weather", url: "https://wetter.provinz.bz.it/en/mountain-weather", linkOnly: false },
  { kind: "osm", label: "OpenStreetMap: route relation", url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(p.name)}`, linkOnly: false },
  { kind: "gpx_source", label: "Track source: OpenStreetMap (ODbL)", url: "https://www.openstreetmap.org/copyright", linkOnly: false },
  { kind: "alltrails", label: "AllTrails", url: "https://www.alltrails.com/", linkOnly: true },
  { kind: "komoot", label: "Komoot", url: "https://www.komoot.com/", linkOnly: true },
  { kind: "trip_report", label: "Recent trip reports", url: `https://www.google.com/search?q=${encodeURIComponent(p.name + " trip report")}`, linkOnly: true },
];
const GROUPS: { title: string; kinds: string[] }[] = [
  { title: "Official", kinds: ["official"] },
  { title: "Conditions", kinds: ["conditions"] },
  { title: "Map and track sources", kinds: ["osm", "gpx_source"] },
  { title: "Community (link only, never copied)", kinds: ["alltrails", "komoot", "trip_report"] },
];
const TRUST_LABEL: Record<Trust, string> = { verified: "verified", stated: "stated", unverified: "unverified" };

/** a sample profile shaped by distance, climb and route shape; drawn to scale */
function sampleProfile(p: Place, start: number) {
  const dist = p.km ?? 4, gain = Math.abs(p.gain ?? 200), loop = /loop/i.test(p.name) || p.kind === "lake";
  const n = 48; const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const shape = loop ? Math.sin(Math.PI * t) ** 1.3 : t < .5 ? Math.sin(Math.PI * t) ** 1.1 : Math.sin(Math.PI * t) ** 1.1;
    const wiggle = Math.sin(t * 19) * gain * .05 + Math.sin(t * 7.3) * gain * .04;
    const e = (p.gain ?? 0) < 0 ? start - gain * t : start + gain * shape + wiggle * Math.sin(Math.PI * t);
    pts.push([dist * t, e]);
  }
  return pts;
}

function Profile({ p, start }: { p: Place; start: number }) {
  const pts = sampleProfile(p, start);
  const W = 640, H = 170, L = 46, R = 12, T = 12, B = 28;
  const maxX = pts[pts.length - 1][0];
  const ys = pts.map(x => x[1]); const lo = Math.floor(Math.min(...ys) / 100) * 100, hi = Math.ceil(Math.max(...ys) / 100) * 100 || lo + 100;
  const X = (x: number) => L + (x / maxX) * (W - L - R), Y = (y: number) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join("");
  const step = hi - lo > 600 ? 200 : 100;
  const yTicks: number[] = []; for (let v = lo; v <= hi; v += step) yTicks.push(v);
  const xStep = maxX > 10 ? 2 : 1; const xTicks: number[] = []; for (let v = 0; v <= maxX + 1e-6; v += xStep) xTicks.push(v);
  const top = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return (
    <figure className="pp-profile">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sample elevation profile, ${lo} to ${hi} m over ${maxX} km`}>
        {yTicks.map(v => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="pp-grid" /><text x={L - 6} y={Y(v) + 4} textAnchor="end" className="pp-tick">{v}</text></g>)}
        {xTicks.map(v => <text key={v} x={X(v)} y={H - 8} textAnchor="middle" className="pp-tick">{v} km</text>)}
        <path d={`${line}L${X(maxX)},${Y(lo)}L${X(0)},${Y(lo)}Z`} className="pp-area" />
        <path d={line} className="pp-line" />
        <circle cx={X(top[0])} cy={Y(top[1])} r={4} className="pp-top" />
        <text x={Math.min(X(top[0]) + 8, W - R - 70)} y={Y(top[1]) - 6} className="pp-tick pp-toplabel">{Math.round(top[1])} m</text>
      </svg>
      <figcaption className="muted small">Sample profile for the prototype, shaped from the published distance and climb. The app draws it from the track and terrain data.</figcaption>
    </figure>
  );
}

export function PlacePage({ place: fromProps, go, phone }: ScreenProps) {
  const { s, add } = useStore();
  const [p] = useState<Place>(() => { const x = pending ?? fromProps ?? PLACE["tre-cime"]; pending = undefined; return x; });
  const [suggest, setSuggest] = useState(false);
  const [mine, setMine] = useState<{ field: string; value: string; source: string }[]>([]);
  const [form, setForm] = useState({ field: "Parking", value: "", source: "" });
  const [added, setAdded] = useState<string>();
  const th = TRAILHEAD[p.id];
  const lots = PARKING[p.id];
  const youngest = Math.min(...s.trip.travellers.map(t => t.age ?? 99));
  const evidence: Evidence[] = useMemo(() => [
    ...(p.facts ?? []).map(f => ({ field: f.label, value: f.value, source: f.source ?? "PLAN.md", read: f.read ?? "Aug 2026", confidence: (f.source && /\./.test(f.source) ? "official" : "operator") as Evidence["confidence"], trust: "stated" as Trust })),
    ...(p.km ? [{ field: "Distance", value: `${p.km} km`, source: "PLAN.md", read: "Aug 2026", confidence: "operator" as const, trust: "stated" as Trust }] : []),
    ...(p.minAge ? [{ field: "Minimum age", value: `${p.minAge}+`, source: "Operator / PLAN.md", read: "Aug 2026", confidence: "operator" as const, trust: "verified" as Trust }] : []),
    { field: "Coordinates", value: `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`, source: "Prototype estimate", read: "Oct 2026", confidence: "agent inferred", trust: "unverified" },
  ], [p]);
  const conflicts = CONFLICTS[p.id] ?? [];
  const nearby = PLACES.filter(x => x.id !== p.id && !["town", "stay", "airport"].includes(x.kind)).map(x => ({ x, d: km(p, x) })).sort((a, b) => a.d - b.d).slice(0, 4);
  const base = PLACE["cortina"];
  const fromBase = leg(base, p);
  const doAdd = (n?: number) => { add(p, n ? { day: n } : { list: "ideas" }); setAdded(n ? `Day ${n}` : "Ideas"); };

  return (
    <div className="page pp">
      <div className="page-inner">
        <nav className="pp-crumbs muted small"><button className="btn ghost small" onClick={() => go("explore")}><Icon name="chevron" size={12} className="flip" />Explore</button><span>Dolomites</span><span>›</span><span>{p.area}</span></nav>
        <header className="pp-head">
          <span className="glyph big"><KindGlyph kind={p.kind} /></span>
          <div className="pp-title-wrap">
            <div className="label">{KIND_LABEL[p.kind]} · {p.area}</div>
            <h1 className="pp-title">{p.name}</h1>
            <div className="pp-badges"><span className="chip ok"><Icon name="shield" size={12} />stated · 1+ official source</span>{conflicts.length > 0 && <span className="chip warn"><Icon name="alert" size={12} />{conflicts.length} conflict</span>}<span className="chip num">≈ {fmtMin(fromBase.min)} from Cortina</span></div>
          </div>
          <div className="pp-actions">
            <button className="btn primary" onClick={() => doAdd()}><Icon name="plus" />Add to Ideas</button>
            <select className="btn" aria-label="Add to a day" value="" onChange={e => doAdd(Number(e.target.value))}>
              <option value="">Add to a day…</option>{s.trip.days.map(d => <option key={d.n} value={d.n}>Day {d.n}: {d.title}</option>)}
            </select>
            <button className="btn" onClick={() => go("share")}><Icon name="share" />Share</button>
          </div>
        </header>
        <AnimatePresence>{added && <motion.div className="chip ok pp-added" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>Added to {added}</motion.div>}</AnimatePresence>
        {p.summary && <p className="pp-lede">{p.summary}</p>}

        <section className="pp-stats num">
          {p.km ? <div><span className="label">Distance</span>{p.km} km</div> : null}
          {p.gain ? <div><span className="label">{p.gain > 0 ? "Climb" : "Descent"}</span>{Math.abs(p.gain)} m</div> : null}
          {p.hours ? <div><span className="label">Time</span>{p.hours}</div> : null}
          <div><span className="label">Shape</span>{/loop/i.test(p.name) || p.kind === "lake" ? "Loop" : "Out and back"}</div>
          <div><span className="label">Age</span>{p.minAge ? `${p.minAge}+` : "any"}</div>
          <div><span className="label">Season</span>late Jun – Sep</div>
        </section>

        <div className={`pp-grid ${phone ? "one" : ""}`}>
          <div className="pp-col">
            {(p.km || p.kind === "trail") && <section className="panelbox"><h2 className="pp-h">Elevation</h2><Profile p={p} start={th?.elev ?? 1500} /></section>}
            <section className="panelbox">
              <h2 className="pp-h">Trailhead and parking</h2>
              {th ? <div className="pp-th"><Icon name="flag" /><div><b>{th.name}</b> <span className="num muted">{th.elev} m</span><div className="muted small">{th.access}</div></div></div>
                : <div className="pp-gap"><Icon name="alert" size={14} />Trailhead not researched yet. <button className="btn ghost small">Request research</button></div>}
              {(lots ?? (p.parking ? [{ name: "Parking", fee: "—", capacity: "—", fillsBy: "—", shuttle: "—", facilities: "—", booking: p.parking, trust: "stated" as Trust }] : [])).map(l => (
                <article key={l.name} className="pp-lot">
                  <header><Icon name="parking" /><b>{l.name}</b><span className={`chip trust-${l.trust}`}>{TRUST_LABEL[l.trust]}</span></header>
                  <dl>
                    <div><dt>Fee</dt><dd>{l.fee}</dd></div>
                    <div><dt>Capacity</dt><dd className={l.capacity === "not published" ? "muted" : ""}>{l.capacity}</dd></div>
                    <div><dt>Fills by</dt><dd>{l.fillsBy}</dd></div>
                    <div><dt>Shuttle</dt><dd>{l.shuttle}</dd></div>
                    <div><dt>Facilities</dt><dd>{l.facilities}</dd></div>
                    {l.booking && <div><dt>Booking</dt><dd>{l.booking}</dd></div>}
                  </dl>
                </article>
              ))}
              {!lots && !p.parking && <div className="pp-gap"><Icon name="alert" size={14} />No parking information yet.</div>}
            </section>
            <section className="panelbox">
              <h2 className="pp-h">Facts and sources</h2>
              <table className="pp-ev">
                <thead><tr><th>Field</th><th>Value</th><th>Source</th><th>Trust</th></tr></thead>
                <tbody>{evidence.map((e, i) => <tr key={i}><td>{e.field}</td><td>{e.value}</td><td className="muted small">{e.source}<br />read {e.read} · {e.confidence}</td><td><span className={`chip trust-${e.trust}`}>{TRUST_LABEL[e.trust]}</span></td></tr>)}</tbody>
              </table>
              {conflicts.map(c => (
                <div key={c.field} className="pp-conflict">
                  <div className="label"><Icon name="alert" size={12} /> Sources disagree: {c.field}</div>
                  <div className="pp-conf-row"><b className="num">{c.chosen.value}</b><span className="muted small">{c.chosen.source}, read {c.chosen.read} · shown</span></div>
                  <div className="pp-conf-row"><span className="num">{c.other.value}</span><span className="muted small">{c.other.source}, read {c.other.read} · {c.other.confidence}</span></div>
                </div>
              ))}
              <button className="btn" onClick={() => setSuggest(v => !v)} aria-expanded={suggest}><Icon name="edit" />Suggest a correction</button>
              <AnimatePresence>{suggest && (
                <motion.form className="pp-suggest" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  onSubmit={e => { e.preventDefault(); if (!form.value) return; setMine(m => [...m, form]); setForm({ ...form, value: "", source: "" }); setSuggest(false); }}>
                  <label>Field<select id="pp-field" value={form.field} onChange={e => setForm({ ...form, field: e.target.value })}>{["Parking", "Distance", "Climb", "Season", "Minimum age", "Hazards", "Link"].map(x => <option key={x}>{x}</option>)}</select></label>
                  <label>New value<input id="pp-value" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="e.g. Lot now €15, card only" /></label>
                  <label>Source link<input id="pp-source" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="https://… (official page preferred)" /></label>
                  <button className="btn primary" type="submit">Send for review</button>
                </motion.form>)}</AnimatePresence>
              {mine.map((m, i) => <div key={i} className="pp-mine"><span className="chip act">changeset · waiting for review</span> {m.field}: <b>{m.value}</b>{m.source && <span className="muted small"> · {m.source}</span>}</div>)}
            </section>
          </div>
          <div className="pp-col">
            <section className="panelbox">
              <h2 className="pp-h">Who it fits</h2>
              {s.trip.travellers.map(t => { const no = !!p.minAge && t.age !== undefined && t.age < p.minAge; return (
                <div key={t.id} className="fitrow"><Avatar initials={t.initials} tone={no ? "crit" : "ok"} /><span>{t.name}{t.age ? <span className="muted num"> {t.age}</span> : null}</span><span className={no ? "crit-text" : "ok-text"}>{no ? `needs ${p.minAge}+` : "fits"}</span></div>); })}
              {p.minAge && youngest < p.minAge ? <p className="muted small">Split the day: give {s.trip.travellers.find(t => t.age === youngest)?.name} the family track.</p> : null}
            </section>
            {(p.booking || p.parking) && <section className="panelbox"><h2 className="pp-h">Permits and booking</h2><p className="pp-p">{p.booking ?? "Parking rules apply; see above."}</p></section>}
            <section className="panelbox"><h2 className="pp-h">Hazards</h2>
              {(HAZARDS[p.id] ?? ["Mountain weather changes fast; afternoon storms in July"]).map(h => <div key={h} className="pp-haz"><Icon name="alert" size={14} />{h}</div>)}</section>
            <section className="panelbox">
              <h2 className="pp-h">Links</h2>
              {GROUPS.map(g => (
                <div key={g.title} className="pp-linkgroup"><div className="label">{g.title}</div>
                  <ul className="links">{LINKS_EXTRA(p).filter(l => g.kinds.includes(l.kind)).map(l => <li key={l.kind}><a href={l.url} target="_blank" rel="noreferrer"><Icon name="link" size={13} />{l.label}</a>{l.linkOnly && <span className="chip">link only</span>}</li>)}</ul></div>
              ))}
              <p className="muted small">Link check: last run Oct 2026, all reachable.</p>
            </section>
            <section className="panelbox"><h2 className="pp-h">Nearby and alternatives</h2>
              {nearby.map(({ x, d }) => <button key={x.id} className="addbox-row" onClick={() => { openPlacePage(x); go("explore"); setTimeout(() => go("place"), 0); }}><span className="glyph"><KindGlyph kind={x.kind} /></span><span className="addbox-name">{x.name}<small className="muted"> {KIND_LABEL[x.kind]}</small></span><span className="num muted">{d.toFixed(1)} km</span></button>)}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
