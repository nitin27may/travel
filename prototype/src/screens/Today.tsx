// Today mode (S18) and the evening Tomorrow briefing (S19). Simulated clock: Thu 15 Jul 2027, 09:42, day 3.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { ScreenProps } from ".";
import { sunFor } from "../../../core/src/sun/index.ts";
import { dayDate, fmtDay } from "../data/trip";
import { fmtMin } from "../lib/geo";
import { planDay, useStore } from "../state/store";
import { Icon } from "../ui/Icon";
import "./today.css";

const NOW = 9 * 60 + 42;                 // 09:42 local, simulated
const DAY = 3;
const toMin = (t?: string) => { if (!t) return undefined; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hhmm = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
const spring = { type: "spring" as const, stiffness: 520, damping: 40 };

export function Today({ go, phone }: ScreenProps) {
  const { s, place } = useStore();
  const [delay, setDelay] = useState(0);
  const [planB, setPlanB] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [sun, setSun] = useState(false);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [tab, setTab] = useState<"today" | "tomorrow">("today");

  // Sunlight theme: set while on, restore whatever was there before when leaving.
  useEffect(() => {
    const r = document.documentElement;
    if (!sun) return;
    const prev = r.getAttribute("data-theme");
    r.setAttribute("data-theme", "sun");
    return () => { if (prev === null) r.removeAttribute("data-theme"); else r.setAttribute("data-theme", prev); };
  }, [sun]);

  const plan = planDay(s.trip, DAY, place);
  const iso = dayDate(s.trip.start, DAY).toISOString().slice(0, 10);
  const lastPlace = plan.stops[plan.stops.length - 1]?.place ?? plan.start;
  const sunT = lastPlace ? sunFor(lastPlace.lat, lastPlace.lng, iso, s.trip.zone) : null;
  const sunset = toMin(sunT?.sunset);
  const misurina = place("misurina")!;

  // the day's rows: leave the hotel, each stop (Plan B swaps the afternoon spur), back to base
  const rows = useMemo(() => {
    const out: { id: string; name: string; time: number; dur: number; sub?: string; ticket?: string; placeId?: string; swapped?: boolean }[] = [];
    let legIdx = 0;
    for (const x of plan.stops) {
      const lg = plan.legs[legIdx++];
      const t = toMin(x.item.time) ?? NOW;
      if (out.length === 0 && plan.start && lg) out.push({ id: "leave", name: `Leave ${plan.start.name.replace(/^Example hotel, /, "")}`, time: t - lg.min - 15, dur: lg.min, sub: `Drive ≈ ${fmtMin(lg.min)} · ${lg.km} km to the toll gate, 15 min queue buffer` });
      const swap = planB && x.place.id === "cadini";
      out.push({ id: x.item.id, name: swap ? misurina.name : x.place.name, time: t, dur: (swap ? 45 : x.place.durationMin) ?? 60, sub: swap ? "Plan B: flat lakeside walk, 10 min from a car park" : x.item.note, ticket: x.item.ticket, placeId: swap ? misurina.id : x.place.id, swapped: swap });
    }
    if (plan.end) { const last = out[out.length - 1]; out.push({ id: "home", name: `Back to ${plan.end.name.replace(/^Example hotel, /, "")}`, time: last.time + last.dur + (plan.legs[plan.legs.length - 1]?.min ?? 30), dur: 0, sub: "Dinner in San Candido" }); }
    return out;
  }, [plan, planB, misurina]);

  // shift everything not yet started by the delay
  const shifted = rows.map(r => ({ ...r, at: r.time + (r.time >= NOW - 5 ? delay : 0) }));
  const next = shifted.find(r => !done[r.id] && r.at + r.dur >= NOW) ?? shifted[0];
  const tre = shifted.find(r => r.placeId === "tre-cime");
  const conflicts: string[] = [];
  if (tre && tre.at > 11 * 60 + 30) conflicts.push(`Toll slot 11:00 lets you in until 11:30; you'd arrive ${hhmm(tre.at)}. Call the gate or rebook a later slot.`);
  const end = shifted[shifted.length - 1];
  if (sunset && end && end.at > sunset - 30) conflicts.push(`Back after ${hhmm(end.at)}, within 30 min of sunset (${sunT?.sunset}). Pack headlamps or drop the afternoon stop.`);
  const leaveRow = shifted.find(r => r.id === "leave");
  const leaveIn = leaveRow ? leaveRow.at - NOW : 0;
  const nextPlace = next?.placeId ? place(next.placeId) : undefined;
  const dest = nextPlace ?? place("tre-cime")!;
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
  const amaps = `https://maps.apple.com/?daddr=${dest.lat},${dest.lng}`;
  const tickets = s.trip.reservations.filter(r => r.id === "r-auronzo" || r.id === "r-car");

  return (
    <div className="page today-page">
      <div className="page-inner today">
        <header className="today-head">
          <div>
            <div className="label">Today · Day {DAY} of 14</div>
            <h1 className="sign page-title">{fmtDay(dayDate(s.trip.start, DAY))}</h1>
            <div className="num muted today-clock">09:42 · {plan.end?.name.replace(/^Example hotel, /, "")} · sunrise {sunFor(46.73, 12.28, iso, s.trip.zone)?.sunrise} · sunset {sunT?.sunset}</div>
          </div>
          <div className="today-tools">
            <span className="chip ok" title="Everything for today is on this phone"><Icon name="check" size={12} />Offline ready · last synced 07:12</span>
            <button className={`btn ${sun ? "primary" : ""}`} aria-pressed={sun} onClick={() => setSun(v => !v)}><Icon name="sun" />Sunlight</button>
          </div>
        </header>

        <div className="today-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "today"} className={tab === "today" ? "on" : ""} onClick={() => setTab("today")}>Today</button>
          <button role="tab" aria-selected={tab === "tomorrow"} className={tab === "tomorrow" ? "on" : ""} onClick={() => setTab("tomorrow")}>Tomorrow briefing</button>
        </div>

        <AnimatePresence mode="wait">
          {tab === "today" ? (
            <motion.div key="today" className="today-grid" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
              <section className="next-card" aria-label="Next stop">
                <div className="label">Next</div>
                <h2 className="next-name">{next?.id === "leave" ? place("tre-cime")!.name : next?.name}</h2>
                {leaveRow && next?.id === "leave" ? (
                  <div className="leave">
                    <span className="sign leave-time">Leave by {hhmm(leaveRow.at)}</span>
                    <span className="num muted">{leaveIn > 0 ? `in ${fmtMin(leaveIn)}` : leaveIn === 0 ? "now" : `${fmtMin(-leaveIn)} ago`} · {leaveRow.sub}</span>
                  </div>
                ) : <div className="leave"><span className="sign leave-time">{hhmm(next.at)}</span></div>}
                <div className="next-actions">
                  <a className="btn primary big" href={gmaps} target="_blank" rel="noreferrer"><Icon name="nav" />Navigate</a>
                  <a className="btn big" href={amaps} target="_blank" rel="noreferrer">Apple Maps</a>
                </div>
                <p className="muted small">Parking: {place("tre-cime")!.parking}</p>
              </section>

              <section className="panelbox late" aria-label="Running late">
                <div className="row-between"><span className="label">Running late?</span>{delay > 0 && <button className="btn ghost small" onClick={() => setDelay(0)}>On time</button>}</div>
                <div className="late-btns">
                  {[15, 30, 45, 60].map(d => <button key={d} className={`btn ${delay === d ? "primary" : ""}`} aria-pressed={delay === d} onClick={() => setDelay(d)}>+{d} min</button>)}
                </div>
                <AnimatePresence>
                  {conflicts.map(c => (
                    <motion.p key={c} className="conflict" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <Icon name="alert" size={14} />{c}
                    </motion.p>
                  ))}
                </AnimatePresence>
                {delay > 0 && conflicts.length === 0 && <p className="muted small">Everything still fits. Later times below have moved by {delay} min.</p>}
              </section>

              <section className="timeline" aria-label="Today's timeline">
                <div className="label">The day</div>
                <ol>
                  {shifted.map(r => {
                    const state = done[r.id] ? "done" : r.id === next?.id ? "current" : r.at < NOW ? "past" : "later";
                    return (
                      <motion.li key={r.id} layout className={`tl ${state} ${r.swapped ? "swapped" : ""}`} transition={spring}>
                        <button className="tl-check" aria-label={done[r.id] ? `Mark ${r.name} not done` : `Mark ${r.name} done`} onClick={() => setDone(d => ({ ...d, [r.id]: !d[r.id] }))}>
                          {done[r.id] ? <Icon name="check" size={14} /> : null}
                        </button>
                        <span className="num tl-time">{hhmm(r.at)}{delay > 0 && r.at !== r.time ? <s className="muted">{hhmm(r.time)}</s> : null}</span>
                        <span className="tl-body"><b>{r.name}</b>{r.ticket && <span className="chip ok"><Icon name="ticket" size={11} />ticket</span>}{r.swapped && <span className="chip act">Plan B</span>}{r.sub && <small className="muted">{r.sub}</small>}</span>
                      </motion.li>
                    );
                  })}
                </ol>
              </section>

              <section className="panelbox weather" aria-label="Weather">
                <div className="row-between"><span className="label">Weather · sample forecast</span><span className="muted small">Not live in the prototype</span></div>
                <div className="wx-hours num">
                  {[["09", "Clear", "14°"], ["11", "Clear", "17°"], ["13", "Cloud", "18°"], ["15", "Storm", "15°"], ["17", "Rain", "12°"]].map(([h, i, t]) => (
                    <div key={h} className={h >= "15" ? "wx bad" : "wx"}><span>{h}:00</span><span aria-hidden="true" className="wx-ico">{i}</span><span>{t}</span></div>
                  ))}
                </div>
                <p className="small"><b>Rule for today:</b> if thunderstorm risk is 50% or more after 14:00, swap the Cadini spur (exposed, ends at a drop-off) for the Lago di Misurina shore walk.</p>
                <p className="small crit-text">Storm risk after 14:00: 60%.</p>
                <label className="switch"><input type="checkbox" checked={planB} onChange={e => setPlanB(e.target.checked)} /><span>Use Plan B this afternoon</span></label>
              </section>

              <section className="wallet" aria-label="Tickets for today">
                <div className="label">Tickets for today</div>
                {tickets.map(t => (
                  <div key={t.id} className="wcard">
                    <div className="wcard-top"><Icon name={t.kind === "car" ? "car" : "ticket"} /><b>{t.title}</b></div>
                    <div className="wcard-code num">{t.id === "r-auronzo" ? "AUR-0715-1100" : t.code}</div>
                    <div className="muted small">{t.id === "r-auronzo" ? "Thu 15 Jul, slot 11:00 · valid 12 h · show at the gate (sample code)" : t.when}</div>
                  </div>
                ))}
              </section>

              <section className="panelbox qnote" aria-label="Quick note">
                <div className="label">Quick note on this stop</div>
                <form onSubmit={e => { e.preventDefault(); if (note.trim()) { setNotes(n => [note.trim(), ...n]); setNote(""); } }} className="qnote-row">
                  <input id="today-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Locatelli: hot chocolate was worth it" aria-label="Quick note" />
                  <button className="btn" type="submit">Save</button>
                </form>
                {notes.map((n, k) => <p key={k} className="small"><Icon name="edit" size={12} /> {n} <span className="muted">· saved offline, syncs later</span></p>)}
              </section>
            </motion.div>
          ) : (
            <Tomorrow key="tom" />
          )}
        </AnimatePresence>
        {!phone && <p className="muted small center">Today opens by itself on travel days. <button className="btn ghost small" onClick={() => go("plan")}>Back to the plan</button></p>}
      </div>
    </div>
  );
}

function Tomorrow() {
  const { s, place } = useStore();
  const n = DAY + 1;
  const p = planDay(s.trip, n, place);
  const iso = dayDate(s.trip.start, n).toISOString().slice(0, 10);
  const sunT = sunFor(46.69, 12.08, iso, s.trip.zone);
  const first = p.stops[0];
  const t0 = toMin(first?.item.time) ?? 7 * 60;
  const leave = t0 - (p.legs[0]?.min ?? 30) - 10;
  return (
    <motion.div className="today-grid" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
      <section className="next-card">
        <div className="label">Tomorrow · {fmtDay(dayDate(s.trip.start, n))}</div>
        <h2 className="next-name">{s.trip.days[n - 1].title}</h2>
        <div className="leave"><span className="sign leave-time">Alarm {hhmm(leave - 45)} · leave {hhmm(leave)}</span><span className="num muted">Sunrise {sunT?.sunrise} · sunset {sunT?.sunset}</span></div>
      </section>
      <section className="panelbox">
        <div className="label">Split day</div>
        {p.stops.map(x => (
          <p key={x.item.id} className="split-row"><span className={`badge ${x.item.variant === "B" ? "lane-b" : ""}`}>{x.item.variant ?? "•"}</span>
            <span><b>{x.place.name}</b> <span className="num muted">{x.item.time}</span><br /><small className="muted">{(x.item.who ?? []).map(id => s.trip.travellers.find(t => t.id === id)?.name).join(" and ") || "Everyone"}{x.place.km ? ` · ${x.place.km} km` : ""}{x.place.gain ? ` · ${x.place.gain} m` : ""}</small></span></p>
        ))}
      </section>
      <section className="panelbox">
        <div className="label">Day bag</div>
        <ul className="bag">
          {["Headlamp (start before light on the Seekofel)", "Rain shell and warm layer for 2,810 m", "Lunch and 2 L water each; no hut on the ridge", "Bike team: ID for the Lienz train, cash for the bike drop (€7)"].map(x => <li key={x}><label><input type="checkbox" /> {x}</label></li>)}
        </ul>
      </section>
      <section className="panelbox">
        <div className="label">Tonight</div>
        <ul className="bag">
          <li>Book Braies P4 parking again for the Seekofel start (no same-day sales)</li>
          <li>Charge phones and the GPS; the trip is downloaded</li>
          <li>Sample forecast: settled until 15:00, storms likely after. Seekofel team off the summit by 13:00.</li>
        </ul>
      </section>
    </motion.div>
  );
}
