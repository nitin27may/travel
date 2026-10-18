// Bookings: what is booked, held, or still to book (we never book; people record it). Timeline by day or
// kind, a detail sheet with segments, travellers and a hidden code, per-kind add forms, paste/forward
// entry, and the wallet. Local state only (prototype). docs/v2/09-reservations.md, ux/screens S10, S11.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { ScreenProps } from ".";
import type { Reservation } from "../data/trip";
import { useStore } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import "./bookings.css";

type Kind = Reservation["kind"];
const KIND_ICON: Record<Kind, string> = { flight: "plane", stay: "bed", car: "car", lift: "flag", parking: "parking", activity: "star", restaurant: "home" };
const KIND_LABEL: Record<Kind, string> = { flight: "Flights", stay: "Stays", car: "Car", lift: "Lifts", parking: "Parking", activity: "Activities", restaurant: "Restaurants" };
const ONE: Record<Kind, string> = { flight: "Flight", stay: "Stay", car: "Car", lift: "Lift", parking: "Parking", activity: "Activity", restaurant: "Restaurant" };
const STATUS: Record<Reservation["status"], { label: string; cls: string }> = {
  to_book: { label: "to book", cls: "warn" }, held: { label: "held", cls: "act" }, booked: { label: "booked", cls: "ok" },
};
// Trip day for each reservation (13 Jul = day 1). Prototype mapping; the app derives it from segments.
const DAY_OF: Record<string, number> = { "r-flight": 1, "r-car": 1, "r-s1": 1, "r-s2": 5, "r-s3": 9, "r-braies": 2, "r-auronzo": 3, "r-seceda": 12, "r-otzi": 13 };
const SEGMENTS: Record<string, { from: string; to: string; dep: string; arr: string; num?: string }[]> = {
  "r-flight": [
    { from: "YYZ Toronto", to: "VCE Venice", dep: "Mon 12 Jul 18:30 Toronto", arr: "Tue 13 Jul 09:05 Venice (+1)", num: "AC 892" },
    { from: "VCE Venice", to: "YYZ Toronto", dep: "Mon 26 Jul 11:50 Venice", arr: "Mon 26 Jul 15:10 Toronto", num: "AC 893" },
  ],
  "r-car": [{ from: "Marco Polo, desk 3", to: "Marco Polo", dep: "Tue 13 Jul 11:30", arr: "Mon 26 Jul 12:00" }],
  "r-s1": [{ from: "Check-in from 15:00", to: "Check-out by 10:00", dep: "Tue 13 Jul", arr: "Sat 17 Jul" }],
  "r-s2": [{ from: "Check-in from 14:00", to: "Check-out by 10:30", dep: "Sat 17 Jul", arr: "Wed 21 Jul" }],
};
const SEATS: Record<string, string> = { t1: "23A", t2: "23B", t3: "23C" };

const SAMPLE = `From: Air Canada <confirmation@aircanada.ca>
Subject: Your booking confirmation - K7Q2PZ

Booking reference: K7Q2PZ
Passengers: SINGH/NITIN MR, SINGH/PARTNER MRS, SINGH/Kai MSTR

Flight 1: AC 892  Toronto (YYZ) Terminal 1 -> Venice (VCE)
  Depart: Mon 12 Jul 2027 18:30   Arrive: Tue 13 Jul 2027 09:05
  Seats: 23A, 23B, 23C   Cabin: Economy

Flight 2: AC 893  Venice (VCE) -> Toronto (YYZ) Terminal 1
  Depart: Mon 26 Jul 2027 11:50   Arrive: Mon 26 Jul 2027 15:10

Total: CAD 4,212.36`;

interface Parsed { code?: string; flights: { num: string; from: string; to: string; dep: string; arr: string }[]; pax: string[]; seats: string[]; total?: string }
function parseEmail(t: string): Parsed {
  const code = t.match(/(?:reference|PNR|confirmation)[:\s]+([A-Z0-9]{6})/i)?.[1];
  const flights: Parsed["flights"] = [];
  const re = /\b([A-Z]{2}) ?(\d{2,4})\b[^\n]*?\((\w{3})\)[^\n]*?\((\w{3})\)[\s\S]*?Depart:\s*([^\n]+?)\s{2,}Arrive:\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) flights.push({ num: `${m[1]} ${m[2]}`, from: m[3], to: m[4], dep: m[5].trim(), arr: m[6].trim() });
  const pax = (t.match(/Passengers?:\s*([^\n]+)/i)?.[1] ?? "").split(",").map(x => x.trim()).filter(Boolean)
    .map(x => { const [last, first] = x.split("/"); return `${(first ?? "").replace(/\s+(MR|MRS|MS|MSTR|MISS)$/, "")} ${last}`.trim(); });
  const seats = (t.match(/Seats?:\s*([^\n]+?)(?:\s{2,}|$)/im)?.[1] ?? "").split(/,\s*/).filter(Boolean);
  const total = t.match(/Total:\s*([A-Z]{3}\s*[\d,.]+)/)?.[1];
  return { code, flights, pax, seats, total };
}

export function Bookings({ phone }: ScreenProps) {
  const { s } = useStore();
  const reduce = useReducedMotion();
  const [list, setList] = useState<Reservation[]>(() => s.trip.reservations);
  const [group, setGroup] = useState<"day" | "kind">("day");
  const [view, setView] = useState<"list" | "wallet">("list");
  const [open, setOpen] = useState<string>();
  const [adding, setAdding] = useState<Kind | "paste" | null>(null);
  const [prefill, setPrefill] = useState<Parsed>();
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 520, damping: 40 };

  const groups = useMemo(() => {
    const out = new Map<string, Reservation[]>();
    const sorted = [...list].sort((a, b) => (DAY_OF[a.id] ?? 99) - (DAY_OF[b.id] ?? 99));
    for (const r of sorted) {
      const key = group === "day" ? (DAY_OF[r.id] ? `Day ${DAY_OF[r.id]}` : "Whole trip") : KIND_LABEL[r.kind];
      out.set(key, [...(out.get(key) ?? []), r]);
    }
    return [...out.entries()];
  }, [list, group]);
  const counts = { booked: list.filter(r => r.status === "booked").length, held: list.filter(r => r.status === "held").length, to_book: list.filter(r => r.status === "to_book").length };
  const upcoming = list.filter(r => r.status === "to_book" && r.opensAt).slice(0, 3);
  const sel = list.find(r => r.id === open);

  const save = (r: Reservation) => { setList(l => [...l.filter(x => x.id !== r.id), r]); setAdding(null); setPrefill(undefined); setOpen(r.id); };
  const mark = (id: string, status: Reservation["status"]) => setList(l => l.map(r => r.id === id ? { ...r, status } : r));

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
                    <button key={r.id} className="bk-open-row" onClick={() => setOpen(r.id)}>
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
                    <button key={k} className="btn ghost small" onClick={() => { setPrefill(undefined); setAdding(k); }}><Icon name={KIND_ICON[k]} size={14} />{ONE[k]}</button>
                  ))}
                  <button className="btn primary small" onClick={() => setAdding("paste")}><Icon name="inbox" size={14} />Paste confirmation</button>
                </div>
              </div>
              {groups.map(([g, rs]) => (
                <section key={g} className="bk-group">
                  <h2 className="label bk-group-h">{g}</h2>
                  <motion.ul layout={!reduce} className="bk-list">
                    {rs.map(r => (
                      <motion.li layout={!reduce} key={r.id} transition={spring}>
                        <button className={`bk-row ${open === r.id ? "on" : ""} ${r.status}`} onClick={() => setOpen(r.id)} aria-expanded={open === r.id}>
                          <span className="glyph"><Icon name={KIND_ICON[r.kind]} /></span>
                          <span className="bk-row-main">
                            <span className="bk-row-title">{r.title}</span>
                            <span className="muted small num">{r.when}{r.nights ? ` · ${r.nights}` : ""}</span>
                            {r.status === "to_book" && r.opensAt && <span className="small bk-row-opens"><Icon name="clock" size={12} />{r.opensAt}</span>}
                          </span>
                          <span className="bk-row-side">
                            <span className={`chip ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                            {r.cost && <span className="num small muted">{r.cost}</span>}
                          </span>
                        </button>
                      </motion.li>
                    ))}
                  </motion.ul>
                </section>
              ))}
            </div>
            <aside className="bk-side">
              <ForwardPanel />
              {!phone && !sel && !adding && <div className="panelbox muted small">Select a booking to see its segments, travellers and code.</div>}
            </aside>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(sel || adding) && (
          <motion.div className="bk-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : .2 }} onClick={() => { setOpen(undefined); setAdding(null); }} />
        )}
        {sel && !adding && (
          <motion.aside key={sel.id} className={`bk-sheet ${phone ? "phone" : ""}`} role="dialog" aria-label={sel.title}
            initial={phone ? { y: "100%" } : { x: 40, opacity: 0 }} animate={phone ? { y: 0 } : { x: 0, opacity: 1 }} exit={phone ? { y: "100%" } : { x: 40, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: .24, ease: [.2, .8, .2, 1] }}>
            <Detail r={sel} onClose={() => setOpen(undefined)} onMark={mark} />
          </motion.aside>
        )}
        {adding && (
          <motion.aside key="add" className={`bk-sheet ${phone ? "phone" : ""}`} role="dialog" aria-label="Add a booking"
            initial={phone ? { y: "100%" } : { x: 40, opacity: 0 }} animate={phone ? { y: 0 } : { x: 0, opacity: 1 }} exit={phone ? { y: "100%" } : { x: 40, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: .24, ease: [.2, .8, .2, 1] }}>
            {adding === "paste"
              ? <PasteBox onCancel={() => setAdding(null)} onParsed={p => { setPrefill(p); setAdding("flight"); }} />
              : <AddForm kind={adding} prefill={prefill} onCancel={() => { setAdding(null); setPrefill(undefined); }} onSave={save} />}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

function Detail({ r, onClose, onMark }: { r: Reservation; onClose: () => void; onMark: (id: string, s: Reservation["status"]) => void }) {
  const { s, place } = useStore();
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const segs = SEGMENTS[r.id];
  const p = r.placeId ? place(r.placeId) : undefined;
  const copy = async () => { try { await navigator.clipboard.writeText(r.code ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setReveal(true); } };
  return (
    <div className="bk-detail">
      <header className="bk-detail-h">
        <span className="glyph big"><Icon name={KIND_ICON[r.kind]} /></span>
        <div><div className="label">{ONE[r.kind]}{DAY_OF[r.id] ? ` · Day ${DAY_OF[r.id]}` : ""}</div><h2 className="bk-detail-title">{r.title}</h2></div>
        <button className="btn ghost" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </header>
      <div className="bk-status-row">
        {(["to_book", "held", "booked"] as const).map(st => (
          <button key={st} className={`chip ${r.status === st ? STATUS[st].cls : ""} bk-status-btn`} aria-pressed={r.status === st} onClick={() => onMark(r.id, st)}>{STATUS[st].label}</button>
        ))}
      </div>
      {r.status === "to_book" && (
        <div className="bk-callout">
          <Icon name="clock" /><div><b>Not booked yet.</b> {r.opensAt ?? "No booking window known."}<div className="muted small">A Book task with reminders exists in Tasks. Mark it booked here when done, or forward the confirmation.</div></div>
        </div>
      )}
      <dl className="bk-facts">
        <div><dt>When</dt><dd className="num">{r.when}</dd></div>
        {r.nights && <div><dt>Nights</dt><dd>{r.nights}</dd></div>}
        {p && <div><dt>Where</dt><dd>{p.name}<span className="muted"> · {p.area}</span></dd></div>}
        {r.cost && <div><dt>Cost</dt><dd className="num">{r.cost}</dd></div>}
        {r.note && <div><dt>Note</dt><dd>{r.note}</dd></div>}
      </dl>
      {segs && (
        <section>
          <span className="label">Segments</span>
          <ol className="bk-segs">
            {segs.map((g, i) => (
              <li key={i} className="bk-seg">
                <span className="bk-seg-dot" aria-hidden="true" />
                <div className="bk-seg-body">
                  {g.num && <span className="chip num">{g.num}</span>}
                  <div className="bk-seg-line"><b>{g.from}</b><Icon name="chevron" size={14} /><b>{g.to}</b></div>
                  <div className="muted small num">{g.dep} → {g.arr}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      {(r.kind === "flight" || r.kind === "lift") && (
        <section>
          <span className="label">Travellers</span>
          <ul className="bk-pax">
            {s.trip.travellers.map(t => (
              <li key={t.id}><Avatar initials={t.initials} /><span>{t.name}{t.age ? <span className="muted num"> {t.age}</span> : null}</span>{r.kind === "flight" && <span className="num muted">seat {SEATS[t.id]}</span>}</li>
            ))}
          </ul>
        </section>
      )}
      {r.code && (
        <section className="bk-secret">
          <span className="label"><Icon name="shield" size={12} /> Confirmation code</span>
          <div className="bk-code-row">
            <span className={`bk-code num ${reveal ? "" : "hidden"}`} aria-label={reveal ? r.code : "Hidden code"}>{reveal ? r.code : "••••••"}</span>
            <button className="btn small" onClick={() => setReveal(v => !v)}>{reveal ? "Hide" : "Reveal"}</button>
            {reveal && <button className="btn small ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</button>}
          </div>
          <p className="muted small">Codes let anyone change or cancel the booking. Only members see them, never guest links.</p>
        </section>
      )}
      <footer className="bk-detail-f">
        <button className="btn"><Icon name="link" size={14} /> Manage booking</button>
        <button className="btn ghost"><Icon name="ticket" size={14} /> Attach ticket</button>
      </footer>
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

function PasteBox({ onParsed, onCancel }: { onParsed: (p: Parsed) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => text ? parseEmail(text) : undefined, [text]);
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
        <button className="btn small" onClick={() => setText(SAMPLE)}>Use sample</button>
        <span className="muted small">Read on your device; nothing is sent anywhere.</span>
      </div>
      {parsed && (
        <motion.div className="panelbox bk-found" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <span className="label">Found</span>
          <ul className="small bk-found-list">
            <li><Icon name={parsed.code ? "check" : "alert"} size={13} /> Code {parsed.code ?? "not found"}</li>
            <li><Icon name={parsed.flights.length ? "check" : "alert"} size={13} /> {parsed.flights.length} flight segment{parsed.flights.length === 1 ? "" : "s"}{parsed.flights.length ? `: ${parsed.flights.map(f => `${f.num} ${f.from}→${f.to}`).join(", ")}` : ""}</li>
            <li><Icon name={parsed.pax.length ? "check" : "alert"} size={13} /> {parsed.pax.length} passengers{parsed.seats.length ? `, seats ${parsed.seats.join(" ")}` : ""}</li>
            {parsed.total && <li><Icon name="check" size={13} /> Total {parsed.total}</li>}
          </ul>
          <button className="btn primary" disabled={!parsed.flights.length && !parsed.code} onClick={() => onParsed(parsed)}>Review and add</button>
        </motion.div>
      )}
    </div>
  );
}

function AddForm({ kind, prefill, onCancel, onSave }: { kind: Kind; prefill?: Parsed; onCancel: () => void; onSave: (r: Reservation) => void }) {
  const { s } = useStore();
  const [status, setStatus] = useState<Reservation["status"]>(prefill ? "booked" : "to_book");
  const [title, setTitle] = useState(prefill?.flights[0] ? `${prefill.flights[0].num} ${prefill.flights[0].from} → ${prefill.flights[0].to}` : "");
  const [code, setCode] = useState(prefill?.code ?? "");
  const [segs, setSegs] = useState(prefill?.flights.length ? prefill.flights : [{ num: "", from: "", to: "", dep: "", arr: "" }]);
  const [seats, setSeats] = useState<Record<string, string>>(() => Object.fromEntries(s.trip.travellers.map((t, i) => [t.id, prefill?.seats[i] ?? ""])));
  const [a, setA] = useState(""); const [b, setB] = useState(""); const [extra, setExtra] = useState("");
  const [cost, setCost] = useState(prefill?.total ?? "");
  const label = ONE[kind];
  const submit = () => onSave({
    id: `r-new-${Date.now()}`, kind, status, title: title || `New ${label.toLowerCase()}`, code: code || undefined, cost: cost || undefined,
    when: kind === "flight" ? segs.map(g => g.dep).filter(Boolean).join(" · ") || "Dates to add" : [a, b].filter(Boolean).join(" → ") || "Dates to add",
    note: kind === "flight" ? `${s.trip.travellers.length} passengers · seats ${Object.values(seats).filter(Boolean).join(", ") || "not set"}` : extra || undefined,
  });
  return (
    <form className="bk-detail bk-form" onSubmit={e => { e.preventDefault(); submit(); }}>
      <header className="bk-detail-h">
        <span className="glyph big"><Icon name={KIND_ICON[kind]} /></span>
        <div><div className="label">Add {label.toLowerCase()}</div><h2 className="bk-detail-title">{prefill ? "Check what we read" : `New ${label.toLowerCase()}`}</h2></div>
        <button type="button" className="btn ghost" onClick={onCancel} aria-label="Close"><Icon name="x" /></button>
      </header>
      {prefill && <div className="bk-callout ok"><Icon name="check" /><span className="small">Filled from the pasted email. Check each field before saving.</span></div>}
      <fieldset className="bk-fs">
        <legend className="label">Status</legend>
        <div className="bk-status-row">
          {(["to_book", "held", "booked"] as const).map(st => <button type="button" key={st} className={`chip ${status === st ? STATUS[st].cls : ""} bk-status-btn`} aria-pressed={status === st} onClick={() => setStatus(st)}>{STATUS[st].label}</button>)}
        </div>
      </fieldset>
      <Field id="f-title" label="Title" value={title} set={setTitle} placeholder={kind === "stay" ? "Hotel name, town" : kind === "flight" ? "AC 892 Toronto → Venice" : "What it is"} />
      {kind === "flight" && (
        <fieldset className="bk-fs">
          <legend className="label">Segments</legend>
          {segs.map((g, i) => (
            <div key={i} className="bk-seg-form">
              <span className="chip num">Leg {i + 1}</span>
              <div className="bk-form-grid">
                <Field id={`f-num-${i}`} label="Flight" value={g.num} set={v => setSegs(x => x.map((y, k) => k === i ? { ...y, num: v } : y))} placeholder="AC 892" />
                <Field id={`f-from-${i}`} label="From" value={g.from} set={v => setSegs(x => x.map((y, k) => k === i ? { ...y, from: v } : y))} placeholder="YYZ" />
                <Field id={`f-to-${i}`} label="To" value={g.to} set={v => setSegs(x => x.map((y, k) => k === i ? { ...y, to: v } : y))} placeholder="VCE" />
                <Field id={`f-dep-${i}`} label="Departs (local)" value={g.dep} set={v => setSegs(x => x.map((y, k) => k === i ? { ...y, dep: v } : y))} placeholder="12 Jul 18:30" />
                <Field id={`f-arr-${i}`} label="Arrives (local)" value={g.arr} set={v => setSegs(x => x.map((y, k) => k === i ? { ...y, arr: v } : y))} placeholder="13 Jul 09:05" />
              </div>
            </div>
          ))}
          <button type="button" className="btn small ghost" onClick={() => setSegs(x => [...x, { num: "", from: "", to: "", dep: "", arr: "" }])}><Icon name="plus" size={14} />Add a leg</button>
        </fieldset>
      )}
      {kind === "flight" && (
        <fieldset className="bk-fs">
          <legend className="label">Passengers and seats</legend>
          {s.trip.travellers.map(t => (
            <div key={t.id} className="bk-pax-form"><Avatar initials={t.initials} /><span>{t.name}</span>
              <input aria-label={`Seat for ${t.name}`} className="bk-input num small-input" value={seats[t.id]} onChange={e => setSeats(x => ({ ...x, [t.id]: e.target.value }))} placeholder="Seat" /></div>
          ))}
        </fieldset>
      )}
      {kind === "stay" && <div className="bk-form-grid">
        <Field id="f-a" label="Check-in (date and from time)" value={a} set={setA} placeholder="21 Jul from 15:00" />
        <Field id="f-b" label="Check-out (date and by time)" value={b} set={setB} placeholder="25 Jul by 10:00" />
        <Field id="f-x" label="Free cancellation until" value={extra} set={setExtra} placeholder="1 Jul 23:59" />
      </div>}
      {kind === "car" && <div className="bk-form-grid">
        <Field id="f-a" label="Pick-up (place, date, time)" value={a} set={setA} placeholder="Marco Polo, 13 Jul 11:30" />
        <Field id="f-b" label="Drop-off" value={b} set={setB} placeholder="Marco Polo, 26 Jul 12:00" />
        <Field id="f-x" label="Car class, insurance" value={extra} set={setExtra} placeholder="Automatic compact, full cover" />
      </div>}
      {(kind === "lift" || kind === "parking" || kind === "activity" || kind === "restaurant") && <div className="bk-form-grid">
        <Field id="f-a" label="Date and slot" value={a} set={setA} placeholder="24 Jul 08:30" />
        <Field id="f-x" label="Meeting point or lot" value={extra} set={setExtra} placeholder="Ortisei valley station" />
      </div>}
      <div className="bk-form-grid">
        <Field id="f-code" label="Confirmation code (private)" value={code} set={setCode} placeholder="Optional" />
        <Field id="f-cost" label="Cost" value={cost} set={setCost} placeholder="CAD 0" />
      </div>
      <footer className="bk-detail-f">
        <button type="submit" className="btn primary"><Icon name="check" size={14} />Save {label.toLowerCase()}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </footer>
    </form>
  );
}

function Field({ id, label, value, set, placeholder }: { id: string; label: string; value: string; set: (v: string) => void; placeholder?: string }) {
  return <label className="bk-field" htmlFor={id}><span className="label">{label}</span><input id={id} className="bk-input" value={value} placeholder={placeholder} onChange={e => set(e.target.value)} /></label>;
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
