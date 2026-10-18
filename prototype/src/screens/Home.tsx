// S02 Home and trips list + S03 travel year. Trips grouped by phase with one next action each;
// the year view puts holidays, school breaks, trips and ideas on one timeline (Ontario, 2027).
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { TripsTable } from "./TripsTable";
import { TripRow } from "./TripRow";
import type { ScreenProps } from ".";
import { PHASE_LABEL, useMyTrips, type Phase, type TripCard } from "../data/trips";
import { Icon } from "../ui/Icon";
import "./home.css";

const TODAY = new Date("2026-10-17T12:00:00Z");
const daysUntil = (iso: string) => Math.round((new Date(iso + "T12:00:00Z").getTime() - TODAY.getTime()) / 86400000);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
const rel = (n: number) => n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 ? (n > 60 ? `in ${Math.round(n / 30.4)} months` : `in ${n} days`) : `${-n} days ago`;


export function Home({ phone, go }: ScreenProps) {
  const [tab, setTab] = useState<"trips" | "year">("trips");
  return (
    <div className="page home">
      <div className="page-inner">
        <header className="home-head">
          <h1 className="sign page-title">{tab === "trips" ? "Trips" : "2027"}</h1>
          <div className="seg" role="tablist" aria-label="View">
            <button role="tab" aria-selected={tab === "trips"} className={tab === "trips" ? "on" : ""} onClick={() => setTab("trips")}>Trips</button>
            <button role="tab" aria-selected={tab === "year"} className={tab === "year" ? "on" : ""} onClick={() => setTab("year")}>Year</button>
          </div>
          {!phone && <div className="home-actions">
            <button className="btn" onClick={() => go("new")}><Icon name="compass" /> Day trip from home</button>
            <button className="btn primary" onClick={() => go("new")}><Icon name="plus" /> Plan a trip</button>
          </div>}
        </header>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .18 }}>
            {tab === "trips" ? <TripsList phone={phone} go={go} /> : <Year phone={phone} go={go} />}
          </motion.div>
        </AnimatePresence>
        {phone && <button className="fab" aria-label="Plan a trip" onClick={() => go("new")}><Icon name="plus" size={22} /></button>}
      </div>
    </div>
  );
}


export type TripsView = "cards" | "list" | "table";
const readView = (): TripsView => { try { const v = localStorage.getItem("proto.tripsView"); return v === "list" || v === "table" ? v : "cards"; } catch { return "cards"; } };

function TripsList({ phone, go }: { phone: boolean; go: ScreenProps["go"] }) {
  const [view, setViewState] = useState<TripsView>(readView);
  const setView = (v: TripsView) => { setViewState(v); try { localStorage.setItem("proto.tripsView", v); } catch { /* storage blocked */ } };
  const [filter, setFilter] = useState<"all" | "plan" | "book" | "idea">("all");
  const [showPast, setShowPast] = useState(false);
  const all = useMyTrips();
  const live = all.filter(t => t.phase !== "done").filter(t => filter === "all" || t.phase === filter || (filter === "plan" && t.phase === "prepare"))
    .sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));
  const soon = live.filter(t => t.start && daysUntil(t.start) <= 60);
  const later = live.filter(t => t.start && daysUntil(t.start) > 60);
  const ideas = live.filter(t => !t.start);
  const past = all.filter(t => t.phase === "done");
  const needs = [
    { icon: "clock", text: "Patagonia: book the international flight and El Chaltén lodging", due: "2026-10-31", action: "Open bookings", to: "bookings" as const },
    { icon: "ticket", text: "Elora Gorge: tubing slot opens online", due: "2026-10-19", action: "Open booking", to: "bookings" as const },
    { icon: "check", text: "Algonquin: how did it go? 3 corrections waiting", due: "2026-10-17", action: "Review", to: "plan" as const },
  ];
  return (
    <div className="trips">
      <section className="needs" aria-label="Needs you this week">
        <span className="label">Needs you this week</span>
        <ul>
          {needs.map(n => (
            <li key={n.text} className="need">
              <Icon name={n.icon} />
              <span className="need-text">{n.text}<small className="muted num"> · {rel(daysUntil(n.due))}, {fmt(n.due, { weekday: "short", day: "numeric", month: "short" })}</small></span>
              <button className="btn" onClick={() => go(n.to)}>{n.action}</button>
            </li>
          ))}
        </ul>
      </section>
      <div className="view-bar">
        {view !== "table" ? <div className="filters" role="group" aria-label="Filter trips">
          {([["all", "All"], ["plan", "Planning"], ["book", "Booking"], ["idea", "Ideas"]] as const).map(([k, l]) => (
            <button key={k} className={`chip ${filter === k ? "act" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div> : <span />}
        <div className="seg view-seg" role="group" aria-label="Trips layout">
          {([["cards", "Cards", "layers"], ["list", "List", "list"], ["table", "Table", "cal"]] as const).map(([k, l, ic]) => (
            <button key={k} className={view === k ? "on" : ""} aria-pressed={view === k} onClick={() => setView(k)}><Icon name={ic} size={14} /> {l}</button>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} className="trips-view" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>
          {view === "table" ? <TripsTable trips={all} phone={phone} go={go} /> : <>
            <Group title="Going soon" trips={soon} phone={phone} go={go} view={view} />
            <Group title="Planned further out" trips={later} phone={phone} go={go} view={view} />
            <Group title="Ideas · no dates yet" trips={ideas} phone={phone} go={go} view={view} />
            {live.length === 0 && <p className="muted empty">No trips in this filter. <button className="linkish" onClick={() => setFilter("all")}>Show all</button></p>}
          </>}
        </motion.div>
      </AnimatePresence>
      {view !== "table" && <section className="past">
        <button className="past-toggle" aria-expanded={showPast} onClick={() => setShowPast(v => !v)}>
          <Icon name={showPast ? "down" : "chevron"} /> <span className="label">Past</span> <span className="num muted">{past.length}</span>
        </button>
        <AnimatePresence initial={false}>
          {showPast && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .22 }} style={{ overflow: "hidden" }}>
            {view === "cards" ? <div className="cards">{past.map(t => <Card key={t.id} t={t} go={go} />)}</div> : <div className="rows">{past.map(t => <TripRow key={t.id} t={t} go={go} />)}</div>}
          </motion.div>}
        </AnimatePresence>
      </section>}
    </div>
  );
}

function Group({ title, trips, phone, go, view = "cards" }: { title: string; trips: TripCard[]; phone: boolean; go: ScreenProps["go"]; view?: TripsView }) {
  if (!trips.length) return null;
  return (
    <section className="group">
      <h2 className="label group-title">{title}</h2>
      {view === "list" ? <div className="rows">{trips.map(t => <TripRow key={t.id} t={t} go={go} />)}</div> : <div className={`cards ${phone ? "one" : ""}`}>
        <AnimatePresence initial={false}>{trips.map(t => <Card key={t.id} t={t} go={go} />)}</AnimatePresence>
      </div>}
    </section>
  );
}

function Card({ t, go }: { t: TripCard; go: ScreenProps["go"] }) {
  const n = t.start ? daysUntil(t.start) : undefined;
  const steps = ["Plan", "Book", "Prepare", "Go"];
  const cur = t.ready.findIndex(r => r < 1);
  return (
    <motion.button layout="position" className={`trip-card ${t.mine ? "mine" : ""} ${t.phase === "done" ? "done" : ""}`} onClick={() => go("plan", t.id)}
      initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 520, damping: 40 }}>
      <div className={`tc-hero tone-${t.tone}`} aria-hidden="true">
        <span className="tc-phase chip">{PHASE_LABEL[t.phase]}</span>
        {n !== undefined && t.phase !== "done" && <span className="tc-count num">{rel(n)}</span>}
      </div>
      <div className="tc-body">
        <div className="tc-title">{t.title}</div>
        <div className="tc-meta num">{t.start ? (t.start === t.end ? fmt(t.start, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : `${fmt(t.start, { weekday: "short", day: "numeric", month: "short" })} – ${fmt(t.end!, { day: "numeric", month: "short", year: "numeric" })}`) : "Dates open"}{t.nights ? ` · ${t.nights} nights` : t.nights === 0 ? " · day trip" : ""}</div>
        <div className="tc-meta muted">{t.region} · {t.kind}</div>
        <div className="ready" aria-label={`Readiness: ${steps.map((s, i) => `${s} ${Math.round(t.ready[i] * 100)}%`).join(", ")}`}>
          {steps.map((s, i) => (
            <div key={s} className={`rd ${i === cur ? "cur" : ""}`}>
              <div className="rd-bar"><motion.div className="rd-fill" initial={false} animate={{ width: `${Math.round(t.ready[i] * 100)}%` }} transition={{ duration: .3 }} /></div>
              <span className="rd-l">{s}</span>
            </div>
          ))}
        </div>
        {t.next && <div className="tc-next"><Icon name={t.phase === "done" ? "check" : "flag"} size={14} />{t.next}</div>}
      </div>
    </motion.button>
  );
}

// ---------- travel year ----------
type Band = { label: string; from: string; to: string; kind: "holiday" | "school" | "trip" | "idea" | "long"; phase?: Phase; note?: string };
const Y = 2027;
const BANDS: Band[] = [
  { label: "New Year", from: "2027-01-01", to: "2027-01-03", kind: "long" },
  { label: "Family Day", from: "2027-02-13", to: "2027-02-15", kind: "long" },
  { label: "Good Friday", from: "2027-03-26", to: "2027-03-28", kind: "long" },
  { label: "Victoria Day", from: "2027-05-22", to: "2027-05-24", kind: "long" },
  { label: "Canada Day", from: "2027-07-01", to: "2027-07-04", kind: "long", note: "Thursday: take Friday off for 4 days" },
  { label: "Civic Holiday", from: "2027-07-31", to: "2027-08-02", kind: "long" },
  { label: "Labour Day", from: "2027-09-04", to: "2027-09-06", kind: "long" },
  { label: "Thanksgiving", from: "2027-10-09", to: "2027-10-11", kind: "long" },
  { label: "Christmas", from: "2027-12-25", to: "2027-12-27", kind: "long" },
  { label: "March break", from: "2027-03-15", to: "2027-03-19", kind: "school" },
  { label: "Summer", from: "2027-06-25", to: "2027-09-06", kind: "school" },
  { label: "Winter break", from: "2027-12-20", to: "2027-12-31", kind: "school" },
  { label: "Costa Rica", from: "2027-02-13", to: "2027-02-23", kind: "trip", phase: "plan" },
  { label: "Patagonia", from: "2027-02-26", to: "2027-03-11", kind: "trip", phase: "book" },
  { label: "Dolomites", from: "2027-07-13", to: "2027-07-26", kind: "trip", phase: "book" },
  { label: "Iceland", from: "2027-09-04", to: "2027-09-15", kind: "trip", phase: "plan" },
  { label: "Nova Scotia?", from: "2027-08-14", to: "2027-08-21", kind: "idea" },
  { label: "Fall colours?", from: "2027-10-09", to: "2027-10-11", kind: "idea" },
];
const dayOfYear = (iso: string) => Math.round((new Date(iso + "T12:00:00Z").getTime() - Date.UTC(Y, 0, 1, 12)) / 86400000);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Year({ phone, go }: { phone: boolean; go: ScreenProps["go"] }) {
  const [sel, setSel] = useState<Band | undefined>(BANDS.find(b => b.label === "Victoria Day"));
  const rows: { key: Band["kind"]; label: string }[] = [
    { key: "long", label: "Long weekends" }, { key: "school", label: "School" }, { key: "trip", label: "Trips" }, { key: "idea", label: "Ideas" },
  ];
  const freeLong = BANDS.filter(b => b.kind === "long" && !BANDS.some(t => (t.kind === "trip") && t.from <= b.to && t.to >= b.from));
  const spent = 9400, budget = 16000;
  return (
    <div className="year">
      <div className="year-head">
        <div className="goals" aria-label="Goals for 2027">
          <span className="chip ok"><Icon name="check" size={12} /> 1 international · Dolomites</span>
          <span className="chip warn"><Icon name="flag" size={12} /> 1 local, 3-4 days · not planned</span>
        </div>
        <div className="budgetbar" aria-label={`Budget ${spent} of ${budget} CAD`}>
          <span className="label">Budget, estimated</span>
          <div className="bb-track"><div className="bb-fill" style={{ width: `${(spent / budget) * 100}%` }} /></div>
          <span className="num">${(spent / 1000).toFixed(1)}k / ${budget / 1000}k</span>
        </div>
      </div>
      {!phone ? (
        <div className="timeline" role="grid" aria-label="2027 timeline">
          <div className="tl-months" aria-hidden="true"><span />{MONTHS.map(m => <span key={m} className="label">{m}</span>)}</div>
          {rows.map(r => (
            <div key={r.key} className={`tl-row r-${r.key}`}>
              <span className="tl-label label">{r.label}</span>
              <div className="tl-track">
                {MONTHS.map((_, i) => <span key={i} className="tl-grid" style={{ left: `${(dayOfYear(`${Y}-${String(i + 1).padStart(2, "0")}-01`) / 365) * 100}%` }} />)}
                {BANDS.filter(b => b.kind === r.key).map((b, k) => {
                  const l = dayOfYear(b.from) / 365 * 100, w = Math.max(.8, (dayOfYear(b.to) - dayOfYear(b.from) + 1) / 365 * 100);
                  const inside = r.key === "school" && w > 6;
                  return (
                    <span key={b.label}>
                      <button className={`tl-band k-${b.kind} ${sel === b ? "on" : ""} ${b.kind === "long" && freeLong.includes(b) ? "free" : ""}`} style={{ left: `${l}%`, width: `${w}%` }}
                        onClick={() => setSel(b)} title={`${b.label}: ${fmt(b.from)} – ${fmt(b.to)}`} aria-label={`${b.label}, ${fmt(b.from)} to ${fmt(b.to)}`}>
                        {inside ? <span>{b.label}</span> : null}
                      </button>
                      {(r.key === "trip" || r.key === "idea") && <span className={`tl-tag ${k % 2 ? "low" : ""}`} style={{ left: `${l}%` }} aria-hidden="true">{b.label}</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="months">
          {MONTHS.map((m, i) => {
            const mm = String(i + 1).padStart(2, "0");
            const bs = BANDS.filter(b => b.from.slice(5, 7) === mm || (b.from.slice(5, 7) < mm && b.to.slice(5, 7) >= mm && b.kind !== "school"));
            return (
              <div key={m} className="month">
                <span className="label">{m}</span>
                <div className="month-chips">
                  {bs.length ? bs.map(b => <button key={b.label} className={`chip k-${b.kind} ${sel === b ? "on" : ""}`} onClick={() => setSel(b)}>{b.label}{b.kind !== "school" ? <span className="num"> {fmt(b.from, { day: "numeric" })}</span> : null}</button>) : <span className="muted small">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <AnimatePresence mode="wait">
        {sel && (
          <motion.div key={sel.label} className="selsheet panelbox" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}>
            <div>
              <div className="label">{sel.kind === "long" ? "Long weekend" : sel.kind === "school" ? "School break" : sel.kind === "trip" ? "Trip" : "Idea"}</div>
              <div className="sel-title">{sel.label} <span className="num muted">{fmt(sel.from, { weekday: "short", day: "numeric", month: "short" })} – {fmt(sel.to, { weekday: "short", day: "numeric", month: "short" })}</span></div>
              <div className="muted small">{sel.note ?? (sel.kind === "long" ? (freeLong.includes(sel) ? `No trip yet · ${rel(daysUntil(sel.from))}. A local 3-4 day trip would meet this year's goal.` : "A trip already covers these dates.") : sel.kind === "trip" ? `${PHASE_LABEL[sel.phase!]} · ${rel(daysUntil(sel.from))}` : "")}</div>
            </div>
            <div className="sel-actions">
              {sel.kind === "trip" ? <button className="btn primary" onClick={() => go("plan")}>Open trip</button> : <>
                <button className="btn" onClick={() => go("explore")}>Day trip ideas</button>
                <button className="btn primary" onClick={() => go("new")}>Plan a trip for these dates</button>
              </>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
