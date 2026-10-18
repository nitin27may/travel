// Bookings: what is booked, held, or still to book (we never book; people record it). Timeline by day or
// kind, a detail sheet with every captured field, add/edit forms per kind, paste a confirmation, and the wallet.
// Local state only (prototype). docs/v2/09-reservations.md, ux/screens S10, S11.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { ScreenProps } from ".";
import type { Attachment, Reservation } from "../data/trip";
import { useStore } from "../state/store";
import { Icon } from "../ui/Icon";
import { Detail, STATUS } from "./BookingDetail";
import { BookingForm, KIND_ICON, ONE } from "./BookingForm";
import { paymentChip, readConfirmation, SAMPLE_FLIGHT, SAMPLE_HOTEL, type Kind, type Reading } from "./bookingsLib";
import "./bookings.css";

const KIND_LABEL: Record<Kind, string> = { flight: "Flights", stay: "Stays", car: "Car", lift: "Lifts", parking: "Parking", activity: "Activities", restaurant: "Restaurants" };
// Trip day for reservations that carry no dayN of their own (older records).
const DAY_OF: Record<string, number> = { "r-flight": 1, "r-car": 1, "r-s1": 1, "r-s2": 5, "r-s3": 9, "r-braies": 2, "r-auronzo": 3, "r-seceda": 12, "r-otzi": 13 };
const dayOf = (r: Reservation) => r.dayN ?? DAY_OF[r.id];

export function Bookings({ phone, go }: ScreenProps) {
  const { s } = useStore();
  const reduce = useReducedMotion();
  const [list, setList] = useState<Reservation[]>(() => s.trip.reservations);
  const [group, setGroup] = useState<"day" | "kind">("day");
  const [view, setView] = useState<"list" | "wallet">("list");
  const [open, setOpen] = useState<string>();
  const [adding, setAdding] = useState<Kind | "paste" | null>(null);
  const [editing, setEditing] = useState<string>();
  const [reading, setReading] = useState<Reading>();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 520, damping: 40 };
  const slide = reduce ? { duration: 0 } : { duration: .24, ease: [.2, .8, .2, 1] as [number, number, number, number] };

  const groups = useMemo(() => {
    const out = new Map<string, Reservation[]>();
    const sorted = [...list].sort((a, b) => (dayOf(a) ?? 99) - (dayOf(b) ?? 99));
    for (const r of sorted) {
      const key = group === "day" ? (dayOf(r) ? `Day ${dayOf(r)}` : "Whole trip") : KIND_LABEL[r.kind];
      out.set(key, [...(out.get(key) ?? []), r]);
    }
    return [...out.entries()];
  }, [list, group]);
  const counts = { booked: list.filter(r => r.status === "booked").length, held: list.filter(r => r.status === "held").length, to_book: list.filter(r => r.status === "to_book").length };
  const upcoming = list.filter(r => r.status === "to_book" && r.opensAt).slice(0, 3);
  const sel = list.find(r => r.id === open);
  const edit = list.find(r => r.id === editing);
  const formOpen = !!edit || (adding != null && adding !== "paste");
  const closeAll = () => { setOpen(undefined); setAdding(null); setEditing(undefined); setReading(undefined); };

  const save = (r: Reservation) => {
    setList(l => l.some(x => x.id === r.id) ? l.map(x => x.id === r.id ? r : x) : [...l, r]);
    setAdding(null); setEditing(undefined); setReading(undefined); setOpen(r.id);
  };
  const mark = (id: string, status: Reservation["status"]) => setList(l => l.map(r => r.id === id ? { ...r, status } : r));
  const attach = (id: string, a: Attachment[]) => setList(l => l.map(r => r.id === id ? { ...r, attachments: [...(r.attachments ?? []), ...a] } : r));

  return (
    <div className="page bk">
      <div className="page-inner">
        <header className="bk-head">
          <div>
            <h1 className="sign page-title">Bookings</h1>
            <p className="muted bk-sub num">{counts.booked} booked · {counts.held} held · {counts.to_book} to book. We never book for you; record what you booked anywhere.</p>
          </div>
          <div className="bk-tabs" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === "list"} className={view === "list" ? "on" : ""} onClick={() => setView("list")}><Icon name="list" size={14} /> Timeline</button>
            <button role="tab" aria-selected={view === "wallet"} className={view === "wallet" ? "on" : ""} onClick={() => setView("wallet")}><Icon name="wallet" size={14} /> Wallet</button>
          </div>
        </header>

        {view === "wallet" ? <Wallet list={list} phone={phone} /> : (
          <div className={`bk-grid ${phone ? "one" : ""}`}>
            <div className="bk-main">
              {upcoming.length > 0 && (
                <section className="panelbox bk-opens" aria-label="What opens next">
                  <span className="label">Opens next</span>
                  {upcoming.map(r => (
                    <button key={r.id} className="bk-open-row" onClick={() => { setAdding(null); setEditing(undefined); setOpen(r.id); }}>
                      <Icon name="clock" /><span className="bk-open-title">{r.title}</span><span className="muted small">{r.opensAt}</span>
                    </button>
                  ))}
                </section>
              )}
              <div className="bk-tools">
                <div className="bk-tabs small" role="tablist" aria-label="Group by">
                  <button role="tab" aria-selected={group === "day"} className={group === "day" ? "on" : ""} onClick={() => setGroup("day")}>By day</button>
                  <button role="tab" aria-selected={group === "kind"} className={group === "kind" ? "on" : ""} onClick={() => setGroup("kind")}>By kind</button>
                </div>
                <div className="bk-addbtns">
                  {(["flight", "stay", "car", "lift", "parking", "activity"] as Kind[]).map(k => (
                    <button key={k} className="btn small" onClick={() => { setReading(undefined); setEditing(undefined); setAdding(k); }}><Icon name={KIND_ICON[k]} size={14} />{ONE[k]}</button>
                  ))}
                  <button className="btn primary small" onClick={() => { setEditing(undefined); setAdding("paste"); }}><Icon name="inbox" size={14} />Paste confirmation</button>
                </div>
              </div>
              {groups.map(([g, rs]) => (
                <section key={g} className="bk-group">
                  <h2 className="label bk-group-h">{g}</h2>
                  <motion.ul layout={!reduce} className="bk-list">
                    {rs.map(r => {
                      const pc = paymentChip(r);
                      return (
                        <motion.li layout={!reduce} key={r.id} transition={spring}>
                          <button className={`bk-row ${open === r.id ? "on" : ""} ${r.status}`} onClick={() => { setAdding(null); setEditing(undefined); setOpen(r.id); }} aria-expanded={open === r.id}>
                            <span className="glyph"><Icon name={KIND_ICON[r.kind]} /></span>
                            <span className="bk-row-main">
                              <span className="bk-row-title">{r.title}</span>
                              <span className="muted small num">{r.when}{r.nights ? ` · ${r.nights}` : ""}</span>
                              {r.provider && <span className="muted small bk-row-via">via {r.provider}</span>}
                              {r.status === "to_book" && r.opensAt && <span className="small bk-row-opens"><Icon name="clock" size={12} />{r.opensAt}</span>}
                            </span>
                            <span className="bk-row-side">
                              <span className={`chip ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                              {pc ? <span className={`chip ${pc.cls} num`}>{pc.label}</span> : r.cost && <span className="num small muted">{r.cost}</span>}
                            </span>
                          </button>
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                </section>
              ))}
            </div>
            <aside className="bk-side">
              <ForwardPanel />
              {!phone && !sel && !adding && <div className="panelbox muted small">Select a booking to see its dates, money, contacts and code.</div>}
            </aside>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(sel || adding) && (
          <motion.div key="scrim" className="bk-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }} onClick={closeAll} />
        )}
        {sel && !formOpen && adding !== "paste" && (
          <motion.aside key={`d-${sel.id}`} className={`bk-sheet ${phone ? "phone" : ""}`} role="dialog" aria-label={sel.title}
            initial={phone ? { y: "100%" } : { x: 40, opacity: 0 }} animate={phone ? { y: 0 } : { x: 0, opacity: 1 }} exit={phone ? { y: "100%" } : { x: 40, opacity: 0 }} transition={slide}>
            <Detail r={sel} go={go} onClose={() => setOpen(undefined)} onMark={mark} onEdit={() => setEditing(sel.id)} onAttach={attach} />
          </motion.aside>
        )}
        {(formOpen || adding === "paste") && (
          <motion.aside key="form" className={`bk-sheet ${phone ? "phone" : ""}`} role="dialog" aria-label={edit ? "Edit booking" : "Add a booking"}
            initial={phone ? { y: "100%" } : { x: 40, opacity: 0 }} animate={phone ? { y: 0 } : { x: 0, opacity: 1 }} exit={phone ? { y: "100%" } : { x: 40, opacity: 0 }} transition={slide}>
            {adding === "paste"
              ? <PasteBox onCancel={() => setAdding(null)} onParsed={rd => { setReading(rd); setAdding(rd.kind); }} />
              : <BookingForm key={edit?.id ?? `${adding}-${reading ? "r" : "n"}`} kind={edit?.kind ?? (adding as Kind)} initial={edit} reading={reading} phone={phone}
                  onCancel={() => { if (edit) setEditing(undefined); else { setAdding(null); setReading(undefined); } }} onSave={save} />}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

function ForwardPanel() {
  const addr = "dolomites-7kq@in.trips.example";
  const [copied, setCopied] = useState(false);
  return (
    <section className="panelbox bk-forward">
      <span className="label"><Icon name="inbox" size={12} /> Forward a confirmation</span>
      <p className="small">Forward airline, hotel or ticket emails to your trip address. We read the booking details they carry and add them here for you to check.</p>
      <div className="bk-addr"><code className="num">{addr}</code>
        <button className="btn small" onClick={async () => { try { await navigator.clipboard.writeText(addr); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* select instead */ } }}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <div className="bk-inbox">
        <div className="bk-inbox-row"><span className="chip ok">added</span><span className="small">Air Canada · K7Q2PZ</span><span className="muted small num">2 Mar</span></div>
        <div className="bk-inbox-row"><span className="chip warn">check</span><span className="small">booking.com · Cortina hotel</span><span className="muted small num">9 Mar</span></div>
      </div>
      <label className="bk-upload"><Icon name="ticket" size={14} /> Or upload a PDF or photo<input type="file" accept="application/pdf,image/*" className="sr" /></label>
    </section>
  );
}

function PasteBox({ onParsed, onCancel }: { onParsed: (r: Reading) => void; onCancel: () => void }) {
  const { s } = useStore();
  const [text, setText] = useState("");
  const rd = useMemo(() => text.trim() ? readConfirmation(text, s.trip.zone) : undefined, [text, s.trip.zone]);
  const usable = !!rd && (rd.legs > 0 || rd.found.length >= 3);
  return (
    <div className="bk-detail">
      <header className="bk-detail-h">
        <span className="glyph big"><Icon name="inbox" /></span>
        <div><div className="label">Add a booking</div><h2 className="bk-detail-title">Paste a confirmation</h2></div>
        <button className="btn ghost" onClick={onCancel} aria-label="Close"><Icon name="x" /></button>
      </header>
      <label className="label" htmlFor="bk-paste">Confirmation email text</label>
      <textarea id="bk-paste" className="bk-textarea num" rows={10} value={text} onChange={e => setText(e.target.value)} placeholder="Paste the email here" />
      <div className="bk-row-btns">
        <button className="btn small" onClick={() => setText(SAMPLE_FLIGHT)}>Flight sample</button>
        <button className="btn small" onClick={() => setText(SAMPLE_HOTEL)}>Hotel sample</button>
        <span className="muted small">Read on your device; nothing is sent anywhere.</span>
      </div>
      {rd && (
        <motion.div className="panelbox bk-found" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <span className="label">Found · looks like a {ONE[rd.kind].toLowerCase()}</span>
          <ul className="small bk-found-list">
            {rd.found.map(f => <li key={f}><Icon name="check" size={13} /> {f}</li>)}
            {rd.missing.map(f => <li key={f} className="miss"><Icon name="alert" size={13} /> {f} not found</li>)}
          </ul>
          <button className="btn primary" disabled={!usable} onClick={() => onParsed(rd)}>Check what we read</button>
        </motion.div>
      )}
    </div>
  );
}

function Wallet({ list, phone }: { list: Reservation[]; phone: boolean }) {
  const { s } = useStore();
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  // Prototype "today" is Day 12 (Sat 24 Jul): the Seceda slot, plus the stay and car that run through it.
  const today = list.filter(r => ["r-seceda", "r-car", "r-s3"].includes(r.id));
  const rest = list.filter(r => r.status === "booked" && !today.includes(r));
  return (
    <div className={`bk-wallet ${phone ? "one" : ""}`}>
      <div className="bk-wallet-head"><span className="sign bk-wallet-day">Day 12</span><span className="muted num">Sat 24 Jul · Seceda, then Val di Funes · works offline</span></div>
      <div className="bk-wallet-cards">
        {today.map(r => (
          <article key={r.id} className={`bk-wcard ${r.status}`}>
            <header className="bk-wcard-h"><Icon name={KIND_ICON[r.kind]} size={18} /><span className="label">{ONE[r.kind]}</span><span className={`chip ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></header>
            <h3 className="bk-wcard-title">{r.title}</h3>
            <div className="num bk-wcard-when">{r.when}</div>
            {r.kind === "lift" && <>
              <QR seed={r.id + s.trip.id} />
              <div className="bk-wcard-code-row">
                <span className="label">Code</span>
                <span className="bk-wcard-code num">{reveal[r.id] ? "SEC-24-0830-3P" : "•••• ••••"}</span>
                <button className="btn small" onClick={() => setReveal(x => ({ ...x, [r.id]: !x[r.id] }))}>{reveal[r.id] ? "Hide" : "Reveal"}</button>
              </div>
              <div className="small muted">3 people · Ortisei valley station · non-refundable</div>
            </>}
            {r.code && r.kind !== "lift" && <div className="bk-wcard-code-row"><span className="label">Code</span><span className="bk-wcard-code num">{reveal[r.id] ? r.code : "••••••"}</span><button className="btn small" onClick={() => setReveal(x => ({ ...x, [r.id]: !x[r.id] }))}>{reveal[r.id] ? "Hide" : "Reveal"}</button></div>}
            {r.status === "to_book" && <div className="bk-callout"><Icon name="alert" /><span className="small">Still to book: {r.opensAt}</span></div>}
            <footer className="bk-wcard-f"><button className="btn small"><Icon name="nav" size={14} />Navigate</button><button className="btn small ghost"><Icon name="phone" size={14} />Call</button></footer>
          </article>
        ))}
      </div>
      <span className="label">Rest of the trip</span>
      <ul className="bk-list">
        {rest.map(r => <li key={r.id} className="bk-row static"><span className="glyph"><Icon name={KIND_ICON[r.kind]} /></span><span className="bk-row-main"><span className="bk-row-title">{r.title}</span><span className="muted small num">{r.when}</span></span><span className="chip ok">booked</span></li>)}
      </ul>
    </div>
  );
}

/** a deterministic QR-like placeholder; the real wallet shows the operator's code image */
function QR({ seed }: { seed: string }) {
  const n = 25;
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296;
  const cells: string[] = [];
  const finder = (x: number, y: number) => { for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) { const edge = i === 0 || i === 6 || j === 0 || j === 6; const core = i >= 2 && i <= 4 && j >= 2 && j <= 4; if (edge || core) cells.push(`M${x + i} ${y + j}h1v1h-1z`); } };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const inF = (i < 8 && j < 8) || (i >= n - 8 && j < 8) || (i < 8 && j >= n - 8);
    if (!inF && rnd() > .52) cells.push(`M${i} ${j}h1v1h-1z`);
  }
  return <svg className="bk-qr" viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label="Ticket code (placeholder)"><rect x="-2" y="-2" width={n + 4} height={n + 4} className="bk-qr-bg" /><path d={cells.join("")} className="bk-qr-fg" /></svg>;
}
