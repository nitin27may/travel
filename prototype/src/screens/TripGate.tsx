// Trip scope. Plan, Today, Bookings, Tasks and Budget always belong to one trip: with none chosen they show a
// picker; the trip switcher in each of those screens changes it. Only the Dolomites plan is loaded in the
// prototype, so other trips open on an honest empty state with the first steps.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ScreenId } from ".";
import { FULL_PLAN, PHASE_LABEL, useMyTrips, type TripCard } from "../data/trips";
import { useStore } from "../state/store";
import { Icon } from "../ui/Icon";
import "./tripgate.css";

const fmt = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const when = (t: TripCard) => t.start ? `${fmt(t.start)}${t.nights ? ` · ${t.nights} nights` : " · day trip"}` : "Dates open";
const SCREEN_NAME: Partial<Record<ScreenId, string>> = { plan: "plan", today: "day", bookings: "bookings", tasks: "tasks", budget: "budget", share: "sharing" };

export function TripPicker({ screen, onPick, onNew }: { screen: ScreenId; onPick: (id: string) => void; onNew: () => void }) {
  const trips = useMyTrips().filter(t => t.phase !== "done").sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));
  return (
    <div className="page tripgate">
      <div className="page-inner">
        <h1 className="sign page-title">Which trip?</h1>
        <p className="muted">Pick a trip to open its {SCREEN_NAME[screen] ?? "plan"}. Bookings, tasks and budget are kept per trip.</p>
        <div className="tg-list" role="list">
          {trips.map(t => (
            <button key={t.id} role="listitem" className="tg-row" onClick={() => onPick(t.id)}>
              <span className={`tg-swatch tone-${t.tone}`} aria-hidden="true" />
              <span className="tg-main"><b>{t.title}</b><small className="muted num">{when(t)} · {t.region}</small></span>
              <span className="chip">{PHASE_LABEL[t.phase]}</span>
              <Icon name="chevron" />
            </button>
          ))}
          <button className="tg-row tg-new" onClick={onNew}><span className="tg-swatch add" aria-hidden="true"><Icon name="plus" /></span><span className="tg-main"><b>Plan a new trip</b><small className="muted">Where, when, who, what kind of trip</small></span></button>
        </div>
      </div>
    </div>
  );
}

/** non-modal switcher: the trip name with a chevron; the menu animates open and closes on outside click or Escape */
export function TripSwitcher({ tripId, onPick, onAll, className = "" }: { tripId: string; onPick: (id: string) => void; onAll: () => void; className?: string }) {
  const trips = useMyTrips();
  const cur = trips.find(t => t.id === tripId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const live = trips.filter(t => t.phase !== "done").sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));
  return (
    <div className={`tswitch ${className}`} ref={ref}>
      <button className="tswitch-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span className="sign">{cur?.title ?? "Choose a trip"}</span><Icon name="down" size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="tswitch-menu" role="listbox" aria-label="Trips" initial={{ opacity: 0, y: -4, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: .98 }} transition={{ duration: .14 }}>
            {live.map(t => (
              <button key={t.id} role="option" aria-selected={t.id === tripId} className={`tswitch-row ${t.id === tripId ? "on" : ""}`} onClick={() => { onPick(t.id); setOpen(false); }}>
                <span className={`tg-swatch sm tone-${t.tone}`} aria-hidden="true" />
                <span className="tg-main"><b>{t.title}</b><small className="muted num">{when(t)}</small></span>
                {t.id === tripId && <Icon name="check" />}
              </button>
            ))}
            <button className="tswitch-row all" onClick={() => { onAll(); setOpen(false); }}><Icon name="home" /><span>All trips</span></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** a trip without a loaded plan: what the screen would hold, and the three ways to start it */
export function EmptyTrip({ tripId, screen, go, switcher }: { tripId: string; screen: ScreenId; go: (id: ScreenId) => void; switcher: React.ReactNode }) {
  const t = useMyTrips().find(x => x.id === tripId);
  if (!t) return null;
  const what = screen === "bookings" ? "No bookings recorded yet" : screen === "tasks" ? "No tasks yet" : screen === "budget" ? "No budget yet" : screen === "today" ? "Today mode starts on the first day of the trip" : "No days planned yet";
  return (
    <div className="page tripgate">
      <div className="page-inner">
        {switcher}
        <div className="muted num tg-sub" hidden={!switcher}>{when(t)} · {t.region} · {t.kind}</div>
        <div className="tg-empty">
          <h2>{what}</h2>
          <p className="muted">{t.next ?? "Start with where you sleep each night, then add places to each day."}</p>
          {FULL_PLAN.has(t.id) ? null : <p className="muted small">The prototype carries the full plan for the Dolomites trip only; this trip shows the start of a plan.</p>}
          <div className="tg-actions">
            <button className="btn primary" onClick={() => go("templates")}><Icon name="layers" />Start from a template</button>
            <button className="btn" onClick={() => go("explore")}><Icon name="compass" />Browse places to add</button>
            <button className="btn" onClick={() => go("settings")}><Icon name="link" />Draft it from a chat client</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS: { id: ScreenId; label: string; icon: string }[] = [
  { id: "plan", label: "Plan", icon: "map" }, { id: "today", label: "Today", icon: "sun" }, { id: "bookings", label: "Bookings", icon: "ticket" },
  { id: "tasks", label: "Tasks", icon: "check" }, { id: "budget", label: "Budget", icon: "money" },
];
/** the trip as a container: name (switcher), dates and status, and the trip's own views as tabs with progress */
export function TripHeader({ tripId, screen, go, onPick }: { tripId: string; screen: ScreenId; go: (id: ScreenId) => void; onPick: (id: string) => void }) {
  const t = useMyTrips().find(x => x.id === tripId);
  const { s } = useStore();
  if (!t) return null;
  const full = FULL_PLAN.has(tripId);
  const count: Partial<Record<ScreenId, string>> = full ? {
    plan: `${s.trip.days.filter(d => d.itemIds.length).length}/${s.trip.days.length} days`,
    bookings: `${s.trip.reservations.filter(r => r.status === "booked").length}/${s.trip.reservations.length}`,
    tasks: `${s.trip.tasks.filter(k => k.done).length}/${s.trip.tasks.length}`,
  } : {};
  return (
    <header className="triphead" aria-label={`Trip: ${t.title}`}>
      <div className="th-id">
        <span className={`tg-swatch sm tone-${t.tone}`} aria-hidden="true" />
        <TripSwitcher tripId={tripId} onPick={onPick} onAll={() => go("home")} className="compact" />
        <span className="muted num th-when">{when(t)}</span>
        <span className="chip">{PHASE_LABEL[t.phase]}</span>
      </div>
      <nav className="th-tabs" aria-label="This trip">
        {TABS.map(x => (
          <button key={x.id} className={`th-tab ${screen === x.id ? "on" : ""}`} aria-current={screen === x.id ? "page" : undefined} onClick={() => go(x.id)}>
            <Icon name={x.icon} size={15} /><span>{x.label}</span>{count[x.id] && <span className="th-count num">{count[x.id]}</span>}
          </button>
        ))}
      </nav>
    </header>
  );
}
