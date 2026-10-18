// A published trip, readable by anyone. Days are Day 1..N; the season band says when the plan is true.
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ScreenProps } from ".";
import { KIND_ICON, KIND_LABEL, MONTH_NAMES, PUBLIC_TRIPS, getSelectedPublicTrip, type PubDay, type PublicTrip as PT } from "../data/public-trips";
import { Icon } from "../ui/Icon";
import "./discover.css";

const hm = (min: number) => min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
const fmtLong = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d; };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function PublicTrip({ phone, go }: ScreenProps) {
  const t = PUBLIC_TRIPS.find(x => x.id === getSelectedPublicTrip()) ?? PUBLIC_TRIPS[0];
  const [date, setDate] = useState("");
  const [closed, setClosed] = useState<Set<number>>(new Set());
  const month = date ? Number(date.slice(5, 7)) : 0;
  const endMonth = date ? addDays(date, t.nights).getUTCMonth() + 1 : 0;
  const out = !!date && !(t.season.months.includes(month) && t.season.months.includes(endMonth));
  const allOpen = closed.size === 0;
  const toggle = (n: number) => setClosed(c => { const x = new Set(c); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const copy = () => go("new");

  const datePanel = (
    <div className="pt-card">
      <h2 className="label">Pick your start date</h2>
      <input className="pt-date" type="date" aria-label="Start date" value={date} onChange={e => setDate(e.target.value)} />
      <div className="pt-preview num" aria-live="polite">
        {date ? <>
          <span><strong>Day 1</strong> = {fmtLong(addDays(date, 0))}</span>
          <span><strong>Day {t.days.length}</strong> = {fmtLong(addDays(date, t.days.length - 1))}</span>
        </> : <span className="muted">Choose a date to see the real calendar days.</span>}
      </div>
      <AnimatePresence initial={false}>
        {out && (
          <motion.div className="pt-warn" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: .2 }}>
            <Icon name="alert" size={16} /><span>These dates fall outside the season: {t.season.label}. Lifts, huts, roads and weather in this plan may not match. You can still copy it and adapt the days.</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="page publictrip">
      <div className="page-inner">
        <button className="btn ghost pt-back" onClick={() => go("discover")}><Icon name="chevron" size={14} className="pt-flip" /> Discover</button>
        <header className="pt-head">
          <div>
            <h1 className="sign pt-title">{t.title}</h1>
            <div className="pt-meta">
              <span className="muted">{t.region} · {t.country}</span>
              <span className="chip num">{t.nights} nights</span>
              {t.tripTypes.map(x => <span key={x} className="chip">{x}</span>)}
            </div>
            <div className="pt-meta muted">
              <span><Icon name="users" size={14} /> Published by {t.by}</span><span className="num">Copied {t.copies} times</span>
            </div>
            <p className="pt-summary">{t.summary}</p>
          </div>
        </header>
        <div className={`pt-hero tone-${t.tone}`} aria-hidden="true" />

        <div className="pt-layout">
          <div className="pt-main">
            <SeasonBand t={t} out={out} />
            {phone && datePanel}
            <section className="pt-days" aria-label="Day by day">
              <div className="pt-days-head">
                <h2 className="label" style={{ margin: 0 }}>Day by day · {t.days.length} days</h2>
                <button className="btn ghost" onClick={() => setClosed(allOpen ? new Set(t.days.map(d => d.n)) : new Set())}>{allOpen ? "Collapse all" : "Expand all"}</button>
              </div>
              {t.days.map(d => <Day key={d.n} d={d} open={!closed.has(d.n)} onToggle={() => toggle(d.n)} date={date ? fmtLong(addDays(date, d.n - 1)) : undefined} />)}
            </section>
          </div>

          {!phone && (
            <aside className="pt-side" aria-label="Use this trip">
              <div className="pt-card copy">
                <button className="btn primary" onClick={copy}><Icon name="plus" /> Copy to my trips</button>
                <p className="muted pt-fine">You get your own editable copy. Nothing changes for {t.by}.</p>
              </div>
              {datePanel}
              <Suits t={t} />
            </aside>
          )}
          {phone && <Suits t={t} />}
        </div>
        {phone && (
          <div className="pt-bar">
            <span className="pt-bar-meta muted">{t.nights} nights<br />{t.season.label}</span>
            <button className="btn primary" onClick={copy}><Icon name="plus" /> Copy to my trips</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SeasonBand({ t, out }: { t: PT; out: boolean }) {
  const w = t.season.weather;
  return (
    <section className={`pt-season ${out ? "out" : ""}`} aria-label="Season">
      <div className="pt-season-head">
        <Icon name={out ? "alert" : "sun"} />
        <div>
          <span className="label">This plan is valid for</span>
          <div className="pt-valid">{t.season.label}</div>
          <p>{t.season.why}</p>
          <p className="muted small" style={{ marginTop: 6 }}>{t.season.months.map(m => MONTH_NAMES[m]).join(", ")}. Outside these months the plan can still be copied, but check every day.</p>
        </div>
      </div>
      <div className="pt-wx">
        <div><span className="label">Temperature</span><span className="num">{w.tempC}</span></div>
        <div><span className="label">Rain</span><span>{w.rain}</span></div>
        <div><span className="label">Daylight</span><span className="num">{w.daylight}</span></div>
      </div>
      <ul className="pt-wx-notes">{w.notes.map(n => <li key={n}>{n}</li>)}</ul>
    </section>
  );
}

function Day({ d, open, onToggle, date }: { d: PubDay; open: boolean; onToggle: () => void; date?: string }) {
  return (
    <div className="pt-day">
      <button className="pt-day-head" aria-expanded={open} onClick={onToggle}>
        <span className="pt-dn">Day {d.n}</span>
        <span className="pt-dt">{d.title}<small>{d.base}{date ? ` · ${date}` : ""}</small></span>
        <span className="pt-drive num"><Icon name="car" size={14} /> {d.driveMin ? hm(d.driveMin) : "no driving"}</span>
        <Icon name={open ? "down" : "chevron"} size={16} className="pt-chev" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul className="pt-stops" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .2 }} style={{ overflow: "hidden" }}>
            {d.stops.map(s => (
              <li key={s.name} className="pt-stop">
                <Icon name={KIND_ICON[s.kind]} size={16} />
                <div><div className="pt-stop-name">{s.name} <span className="label pt-stop-kind">{KIND_LABEL[s.kind]}</span></div>{s.note && <div className="pt-stop-note">{s.note}</div>}</div>
                <span className="pt-stop-dur num">{hm(s.durationMin)}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Suits({ t }: { t: PT }) {
  return (
    <div className="pt-card">
      <h2 className="label">Who it suits</h2>
      <ul className="pt-suits">
        <li><Icon name="users" size={14} /> Written for {t.group}</li>
        <li><Icon name="check" size={14} /> Youngest child: age {t.ageFit}+</li>
        <li><Icon name="peak" size={14} /> Effort: {cap(t.effort)}</li>
        <li><Icon name="car" size={14} /> Driving about {hm(t.driveAvgMin)} a day on average</li>
      </ul>
    </div>
  );
}
