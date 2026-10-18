// Tasks: the trip as a to-do list. Groups with progress, one-tap check with undo, relative + absolute due
// dates, source chips, and the reminder schedule for booking-window tasks. Local state (prototype).
// docs/v2/02-experience.md §8-9, ux/screens S12.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { ScreenProps } from ".";
import type { Task } from "../data/trip";
import { useStore } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import "./tasks.css";

type Group = Task["group"] | "On the day";
interface T extends Omit<Task, "group"> { group: Group; window?: boolean; checklist?: { text: string; done: boolean }[] }
const GROUPS: Group[] = ["Book", "Buy", "Pack", "Documents", "Prepare", "On the day"];
const GROUP_ICON: Record<Group, string> = { Book: "ticket", Buy: "money", Pack: "layers", Documents: "shield", Prepare: "check", "On the day": "sun" };
const TODAY = new Date("2026-10-18T12:00:00Z");

const dayMs = 86400000;
function dueText(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  const n = Math.round((d.getTime() - TODAY.getTime()) / dayMs);
  const abs = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const rel = n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 ? `in ${n} days` : `${-n} days ago`;
  return { rel, abs, n };
}
function reminders(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  const f = (x: Date) => x.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const eve = new Date(d.getTime() - dayMs);
  return [
    { when: f(new Date(d.getTime() - 7 * dayMs)), what: "A week before it opens", ch: "email" },
    { when: `${f(eve)} 19:00`, what: "The evening before", ch: "push" },
    { when: `${f(d)} 07:45`, what: "15 minutes before opening", ch: "push" },
    { when: `${f(d)} 08:00`, what: "At opening (08:00 Rome = 02:00 Toronto)", ch: "push" },
    { when: `${f(d)} 10:00`, what: "Did you get it?", ch: "push" },
  ];
}

export function Tasks({ phone }: ScreenProps) {
  const { s } = useStore();
  const reduce = useReducedMotion();
  const [tasks, setTasks] = useState<T[]>(() => [
    ...s.trip.tasks.map(t => ({ ...t, window: t.source === "Booking window" })),
    { id: "d1", group: "On the day", title: "Braies: leave the hotel 04:40 for the 05:32 sunrise", due: "2027-07-14", done: false, source: "Trip items" },
    { id: "d2", group: "On the day", title: "Lagazuoi: headlamps charged, helmets", due: "2027-07-19", done: false, source: "Trip items",
      checklist: [{ text: "3 headlamps", done: false }, { text: "Spare batteries", done: false }, { text: "Rain shells", done: true }] },
    { id: "p2", group: "Pack", title: "Dawn layers for 2,500 m: hats and gloves ×3", due: "2027-07-10", done: false, source: "Packing template" },
  ]);
  const [last, setLast] = useState<{ id: string; title: string; done: boolean } | null>(null);
  const [open, setOpen] = useState<string | null>("k1");
  const [hideDone, setHideDone] = useState(false);
  const [adding, setAdding] = useState<Group | null>(null);
  const [draft, setDraft] = useState("");
  const [draftDue, setDraftDue] = useState("2027-07-01");
  useEffect(() => { if (!last) return; const h = setTimeout(() => setLast(null), 6000); return () => clearTimeout(h); }, [last]);

  const toggle = (id: string) => setTasks(ts => ts.map(t => { if (t.id !== id) return t; setLast({ id, title: t.title, done: !t.done }); return { ...t, done: !t.done }; }));
  const undo = () => { if (!last) return; setTasks(ts => ts.map(t => t.id === last.id ? { ...t, done: !last.done } : t)); setLast(null); };
  const total = tasks.length, done = tasks.filter(t => t.done).length;
  const next = useMemo(() => tasks.filter(t => !t.done).sort((a, b) => a.due.localeCompare(b.due))[0], [tasks]);
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 520, damping: 40 };

  return (
    <div className="page tk">
      <div className="page-inner">
        <header className="tk-head">
          <div>
            <h1 className="sign page-title">Tasks</h1>
            <p className="muted num tk-sub">{done} of {total} done · Dolomites, 13 Jul 2027</p>
          </div>
          <label className="tk-toggle"><input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} /> Hide done</label>
        </header>
        <div className="tk-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Tasks done">
          <motion.span className="tk-bar-fill" animate={{ width: `${(done / total) * 100}%` }} transition={reduce ? { duration: 0 } : { duration: .3 }} />
        </div>
        {next && (() => { const d = dueText(next.due); return (
          <div className="tk-next"><Icon name="clock" /><span><b>Next due:</b> {next.title} <span className="num">{d.rel}, {d.abs}</span></span></div>
        ); })()}

        <div className={`tk-groups ${phone ? "one" : ""}`}>
          {GROUPS.map(g => {
            const items = tasks.filter(t => t.group === g).sort((a, b) => a.due.localeCompare(b.due));
            const gd = items.filter(t => t.done).length;
            const shown = hideDone ? items.filter(t => !t.done) : items;
            return (
              <section key={g} className="panelbox tk-group" aria-labelledby={`tk-${g}`}>
                <header className="tk-group-h">
                  <span className="glyph"><Icon name={GROUP_ICON[g]} /></span>
                  <h2 id={`tk-${g}`} className="tk-group-title">{g}</h2>
                  <span className="num muted small">{gd}/{items.length}</span>
                  <span className="tk-mini" aria-hidden="true"><span style={{ width: items.length ? `${(gd / items.length) * 100}%` : 0 }} /></span>
                </header>
                <motion.ul layout={!reduce} className="tk-list">
                  <AnimatePresence initial={false}>
                    {shown.map(t => {
                      const d = dueText(t.due);
                      const owner = t.owner ? s.trip.travellers.find(x => x.id === t.owner) : undefined;
                      return (
                        <motion.li layout={!reduce} key={t.id} transition={spring} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className={`tk-item ${t.done ? "done" : ""}`}>
                          <div className="tk-row">
                            <button className={`tk-check ${t.done ? "on" : ""}`} onClick={() => toggle(t.id)} aria-pressed={t.done} aria-label={`${t.done ? "Mark not done" : "Mark done"}: ${t.title}`}>
                              <AnimatePresence>{t.done && <motion.span initial={{ scale: reduce ? 1 : .4 }} animate={{ scale: 1 }} exit={{ scale: .4, opacity: 0 }} transition={spring}><Icon name="check" size={14} /></motion.span>}</AnimatePresence>
                            </button>
                            <div className="tk-main">
                              <span className="tk-title">{t.title}</span>
                              <span className="tk-meta">
                                <span className={`num ${!t.done && d.n < 60 ? "warn-text" : "muted"}`}>{d.rel}, {d.abs}</span>
                                {t.source && <span className="chip">{t.source}</span>}
                                {t.window && <button className="chip act tk-rem-btn" aria-expanded={open === t.id} onClick={() => setOpen(o => o === t.id ? null : t.id)}><Icon name="clock" size={12} />5 reminders</button>}
                              </span>
                            </div>
                            {owner && <Avatar initials={owner.initials} title={owner.name} />}
                          </div>
                          <AnimatePresence initial={false}>
                            {t.window && open === t.id && (
                              <motion.ol className="tk-rems" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : { duration: .22, ease: [.2, .8, .2, 1] }}>
                                {reminders(t.due).map(r => <li key={r.what}><span className="num">{r.when}</span><span>{r.what}</span><span className="chip">{r.ch}</span></li>)}
                              </motion.ol>
                            )}
                          </AnimatePresence>
                          {t.checklist && (
                            <ul className="tk-check-list">
                              {t.checklist.map((c, i) => (
                                <li key={i}><label><input type="checkbox" checked={c.done} onChange={() => setTasks(ts => ts.map(x => x.id === t.id ? { ...x, checklist: x.checklist!.map((y, k) => k === i ? { ...y, done: !y.done } : y) } : x))} /> {c.text}</label></li>
                              ))}
                            </ul>
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                  {shown.length === 0 && <li className="muted small tk-empty">{items.length ? "All done." : "Nothing here yet."}</li>}
                </motion.ul>
                {adding === g ? (
                  <form className="tk-add" onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; setTasks(ts => [...ts, { id: `m${Date.now()}`, group: g, title: draft.trim(), due: draftDue, done: false, source: "Added by you" }]); setDraft(""); setAdding(null); }}>
                    <input autoFocus className="tk-input" aria-label="Task" value={draft} onChange={e => setDraft(e.target.value)} placeholder={`Add to ${g}`} />
                    <input type="date" className="tk-input num" aria-label="Due date" value={draftDue} onChange={e => setDraftDue(e.target.value)} />
                    <button className="btn primary small" type="submit">Add</button>
                    <button className="btn ghost small" type="button" onClick={() => setAdding(null)}>Cancel</button>
                  </form>
                ) : <button className="btn ghost small tk-add-btn" onClick={() => setAdding(g)}><Icon name="plus" size={14} />Add a task</button>}
              </section>
            );
          })}
        </div>
      </div>
      <div className="tk-toast-wrap" aria-live="polite">
        <AnimatePresence>
          {last && (
            <motion.div key={last.id + last.done} className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={spring}>
              <span>{last.done ? "Done" : "Not done"}: {last.title}</span>
              <button className="btn ghost toast-undo" onClick={undo}><Icon name="undo" /> Undo</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
