// Budget: planned vs actual by category, drawn to one scale; EUR items converted to CAD at a stated rate;
// expenses list with an add form. No cost splitting in v1. docs/v2/features/F10, ux/screens S13.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { ScreenProps } from ".";
import { Icon } from "../ui/Icon";
import "./budget.css";

type Cat = "getting_there" | "local_transport" | "lodging" | "food" | "activities" | "misc";
const CATS: { id: Cat; label: string; icon: string }[] = [
  { id: "getting_there", label: "Getting there", icon: "plane" },
  { id: "local_transport", label: "Local transport", icon: "car" },
  { id: "lodging", label: "Lodging", icon: "bed" },
  { id: "food", label: "Food", icon: "home" },
  { id: "activities", label: "Activities", icon: "ticket" },
  { id: "misc", label: "Misc and buffer", icon: "more" },
];
// Example rate for the prototype; the app stores the rate it used and the date it was read.
const RATE = 1.52; const RATE_DATE = "18 Oct 2026";
const PLANNED: Record<Cat, number> = { getting_there: 4212, local_transport: 1650, lodging: 7550, food: 2470, activities: 1290, misc: 1030 };

interface Exp { id: string; date: string; label: string; amount: number; cur: "CAD" | "EUR"; cat: Cat; booked?: boolean }
const toCad = (e: Exp) => e.cur === "EUR" ? e.amount * RATE : e.amount;
const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

export function Budget({ phone }: ScreenProps) {
  const reduce = useReducedMotion();
  const [exps, setExps] = useState<Exp[]>([
    { id: "e1", date: "2027-03-02", label: "Air Canada, 3 return tickets", amount: 4212.36, cur: "CAD", cat: "getting_there", booked: true },
    { id: "e2", date: "2027-03-10", label: "Car rental, automatic, 13 days", amount: 812, cur: "EUR", cat: "local_transport", booked: true },
    { id: "e3", date: "2027-03-14", label: "San Candido hotel, 4 nights", amount: 1340, cur: "EUR", cat: "lodging", booked: true },
    { id: "e4", date: "2027-07-13", label: "Groceries, San Candido", amount: 64.2, cur: "EUR", cat: "food" },
    { id: "e5", date: "2027-07-14", label: "Braies P4 parking", amount: 44, cur: "EUR", cat: "local_transport" },
    { id: "e6", date: "2027-07-14", label: "Rowing boat, 45 min", amount: 20, cur: "EUR", cat: "activities" },
    { id: "e7", date: "2027-07-15", label: "Tre Cime toll road", amount: 40, cur: "EUR", cat: "local_transport" },
    { id: "e8", date: "2027-07-15", label: "Lunch, Rifugio Locatelli", amount: 71.5, cur: "EUR", cat: "food" },
  ]);
  const [form, setForm] = useState({ label: "", amount: "", cur: "EUR" as Exp["cur"], cat: "food" as Cat, date: "2027-07-16" });
  const [open, setOpen] = useState(false);

  const actual = useMemo(() => Object.fromEntries(CATS.map(c => [c.id, exps.filter(e => e.cat === c.id).reduce((a, e) => a + toCad(e), 0)])) as Record<Cat, number>, [exps]);
  const plannedTotal = Object.values(PLANNED).reduce((a, b) => a + b, 0);
  const actualTotal = Object.values(actual).reduce((a, b) => a + b, 0);
  const max = Math.max(...CATS.map(c => Math.max(PLANNED[c.id], actual[c.id])));
  const ticks = [0, 2000, 4000, 6000, 8000].filter(t => t <= max * 1.05);
  const sorted = [...exps].sort((a, b) => b.date.localeCompare(a.date));

  const add = () => {
    const amount = parseFloat(form.amount.replace(",", ".")); if (!form.label.trim() || !(amount > 0)) return;
    setExps(x => [...x, { id: `e${Date.now()}`, date: form.date, label: form.label.trim(), amount, cur: form.cur, cat: form.cat }]);
    setForm(f => ({ ...f, label: "", amount: "" })); setOpen(false);
  };

  return (
    <div className="page bg">
      <div className="page-inner">
        <header className="bg-head">
          <div>
            <h1 className="sign page-title">Budget</h1>
            <p className="muted small bg-sub">All amounts in CAD. Euro items converted at €1 = ${RATE.toFixed(2)} (example rate, read {RATE_DATE}). Plan includes a 12% buffer.</p>
          </div>
          <button className="btn primary" onClick={() => setOpen(o => !o)} aria-expanded={open}><Icon name="plus" size={14} />Add expense</button>
        </header>

        <section className="bg-totals" aria-label="Totals">
          <div className="panelbox bg-tot"><span className="label">Planned</span><span className="num bg-big">{fmt(plannedTotal)}</span><span className="muted small">for 3 people, 13 nights</span></div>
          <div className="panelbox bg-tot"><span className="label">Spent or committed</span><span className="num bg-big">{fmt(actualTotal)}</span><span className="muted small">{Math.round((actualTotal / plannedTotal) * 100)}% of plan</span></div>
          <div className="panelbox bg-tot"><span className="label">Left</span><span className={`num bg-big ${plannedTotal - actualTotal < 0 ? "crit-text" : ""}`}>{fmt(plannedTotal - actualTotal)}</span><span className="muted small">{fmt((plannedTotal - actualTotal) / 3)} per person</span></div>
        </section>

        <section className="panelbox bg-chart" aria-label="Planned and actual by category">
          <div className="bg-legend small"><span><i className="sw plan" />Planned</span><span><i className="sw act" />Spent or committed</span></div>
          <div className="bg-rows">
            {CATS.map(c => {
              const p = PLANNED[c.id], a = actual[c.id], over = a > p;
              return (
                <div key={c.id} className="bg-row">
                  <div className="bg-cat"><Icon name={c.icon} size={14} /><span>{c.label}</span></div>
                  <div className="bg-track" aria-label={`${c.label}: planned ${fmt(p)}, spent ${fmt(a)}`}>
                    {ticks.map(t => <span key={t} className="bg-tick" style={{ left: `${(t / max) * 100}%` }} />)}
                    <span className="bg-plan" style={{ width: `${(p / max) * 100}%` }} />
                    <motion.span className={`bg-act ${over ? "over" : ""}`} initial={false} animate={{ width: `${(a / max) * 100}%` }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }} />
                  </div>
                  <div className="bg-nums num small"><span>{fmt(a)}</span><span className="muted"> / {fmt(p)}</span></div>
                </div>
              );
            })}
          </div>
          {!phone && <div className="bg-axis num small muted">{ticks.map(t => <span key={t} style={{ left: `${(t / max) * 100}%` }}>{t ? `$${t / 1000}k` : "0"}</span>)}</div>}
        </section>

        <AnimatePresence>
          {open && (
            <motion.form className="panelbox bg-form" onSubmit={e => { e.preventDefault(); add(); }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={reduce ? { duration: 0 } : { duration: .22, ease: [.2, .8, .2, 1] }}>
              <label className="bg-field grow"><span className="label">What</span><input id="bg-label" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Dinner in Cortina" /></label>
              <label className="bg-field"><span className="label">Amount</span><input id="bg-amount" inputMode="decimal" className="num" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></label>
              <label className="bg-field"><span className="label">Currency</span><select id="bg-cur" value={form.cur} onChange={e => setForm(f => ({ ...f, cur: e.target.value as Exp["cur"] }))}><option>EUR</option><option>CAD</option></select></label>
              <label className="bg-field"><span className="label">Category</span><select id="bg-cat" value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value as Cat }))}>{CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
              <label className="bg-field"><span className="label">Date</span><input id="bg-date" type="date" className="num" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></label>
              <div className="bg-form-f">
                {form.cur === "EUR" && parseFloat(form.amount) > 0 && <span className="muted small num">≈ {fmt(parseFloat(form.amount) * RATE)} CAD</span>}
                <button className="btn primary" type="submit">Save expense</button>
                <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <section className="bg-exps" aria-label="Expenses">
          <span className="label">Expenses, newest first</span>
          <motion.ul layout={!reduce} className="bg-list">
            <AnimatePresence initial={false}>
              {sorted.map(e => {
                const c = CATS.find(x => x.id === e.cat)!;
                const d = new Date(e.date + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
                return (
                  <motion.li layout={!reduce} key={e.id} className="bg-exp" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}>
                    <span className="glyph"><Icon name={c.icon} /></span>
                    <span className="bg-exp-main"><span className="bg-exp-title">{e.label}</span><span className="muted small">{c.label}{e.booked ? " · from a booking" : ""} · <span className="num">{d}</span></span></span>
                    <span className="bg-exp-amt num"><span>{fmt(toCad(e))}</span>{e.cur === "EUR" && <small className="muted">€{e.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>}</span>
                    <button className="btn ghost small" aria-label={`Remove ${e.label}`} onClick={() => setExps(x => x.filter(y => y.id !== e.id))}><Icon name="x" size={14} /></button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        </section>
      </div>
    </div>
  );
}
