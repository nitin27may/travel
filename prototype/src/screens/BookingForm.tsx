// The booking form: one per kind, grouped What / When / Who / Money / Contact and links / Files and notes / Belongs to.
// Used to add, to edit, and to check what a pasted confirmation said. Native date and time inputs, inline errors.
import { motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import type { Reservation } from "../data/trip";
import { useStore } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { blankDraft, blankLeg, CURRENCIES, fmtDate, fromDraft, isSlot, TODAY, toDraft, validate, ZONE_LABEL, ZONES, type Draft, type Errors, type Kind, type Reading } from "./bookingsLib";

export const KIND_ICON: Record<Kind, string> = { flight: "plane", stay: "bed", car: "car", lift: "flag", parking: "parking", activity: "star", restaurant: "home" };
export const ONE: Record<Kind, string> = { flight: "Flight", stay: "Stay", car: "Car", lift: "Lift", parking: "Parking", activity: "Activity", restaurant: "Restaurant" };
const STATUS_OPTS = [["to_book", "to book", "warn"], ["held", "held", "act"], ["booked", "booked", "ok"]] as const;
const PAY_OPTS = [["", "Not recorded"], ["paid", "Paid in full"], ["deposit", "Deposit paid"], ["pay_on_arrival", "Pay on arrival"], ["unpaid", "Not paid yet"]] as const;

function Field({ id, label, hint, error, children, wide }: { id: string; label: string; hint?: string; error?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`bk-field ${wide ? "wide" : ""}`}>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
      {error ? <span className="bk-err small" id={`${id}-e`} role="alert"><Icon name="alert" size={12} />{error}</span> : hint ? <span className="bk-hint small" id={`${id}-h`}>{hint}</span> : null}
    </div>
  );
}
function Sec({ title, children }: { title: string; children: ReactNode }) {
  return <section className="bk-sec"><h3 className="label bk-sec-h">{title}</h3>{children}</section>;
}

export function BookingForm({ kind, initial, reading, phone, onCancel, onSave }: { kind: Kind; initial?: Reservation; reading?: Reading; phone: boolean; onCancel: () => void; onSave: (r: Reservation) => void }) {
  const { s, place } = useStore();
  const trip = s.trip;
  const [d, setD] = useState<Draft>(() => {
    if (initial) return toDraft(initial, trip);
    const base = blankDraft(kind, trip.zone);
    if (!reading) return base;
    const seats = Object.fromEntries(trip.travellers.map((t, i) => [t.id, reading.seatList[i] ?? ""]));
    return { ...base, ...reading.patch, seats };
  });
  const [tried, setTried] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));
  const errors: Errors = tried ? validate(d) : {};
  const k = d.kind; const slot = isSlot(k);
  const text = (id: keyof Draft & string, props: { type?: string; placeholder?: string; inputMode?: "numeric" | "decimal" | "tel" | "url" | "email"; min?: string } = {}) => (
    <input id={`f-${id}`} className="bk-input" type={props.type ?? "text"} inputMode={props.inputMode} min={props.min} placeholder={props.placeholder} value={d[id] as string}
      aria-invalid={!!errors[id]} aria-describedby={errors[id] ? `f-${id}-e` : undefined} onChange={e => set(id, e.target.value as never)} />
  );
  const dayItems = d.dayN ? (trip.days[Number(d.dayN) - 1]?.itemIds ?? []) : [];
  const label = ONE[k].toLowerCase();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(d);
    if (Object.keys(errs).length) {
      setTried(true);
      requestAnimationFrame(() => { const el = ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]'); el?.scrollIntoView({ block: "center", behavior: "smooth" }); el?.focus({ preventScroll: true }); });
      return;
    }
    onSave(fromDraft(d, initial, trip));
  };
  const setLeg = (i: number, patch: Partial<Draft["legs"][number]>) => set("legs", d.legs.map((l, n) => n === i ? { ...l, ...patch } : l));
  const pick = (f: FileList | null) => {
    if (!f?.length) return;
    set("attachments", [...d.attachments, ...Array.from(f).map(x => ({ name: x.name, kind: x.type.startsWith("image/") ? "image" as const : "pdf" as const, addedAt: TODAY }))]);
  };

  return (
    <form ref={ref} className="bk-detail bk-form" noValidate onSubmit={submit}>
      <header className="bk-detail-h">
        <span className="glyph big"><Icon name={KIND_ICON[k]} /></span>
        <div><div className="label">{initial ? "Edit booking" : `Add ${label}`}</div><h2 className="bk-detail-title">{initial ? initial.title : reading ? "Check what we read" : `New ${label}`}</h2></div>
        <button type="button" className="btn ghost" onClick={onCancel} aria-label="Close"><Icon name="x" /></button>
      </header>
      {reading && !initial && <div className="bk-callout ok"><Icon name="check" /><span className="small">Filled from the pasted email: {reading.found.length} things read{reading.missing.length ? `, ${reading.missing.join(", ").toLowerCase()} not found` : ""}. Check each field before saving.</span></div>}
      {tried && Object.keys(errors).length > 0 && <div className="bk-callout crit" role="alert"><Icon name="alert" /><span className="small">{Object.keys(errors).length === 1 ? "One field needs a fix." : `${Object.keys(errors).length} fields need a fix.`} Nothing is saved yet.</span></div>}

      <Sec title="What">
        <div className="bk-form-grid">
          <Field id="f-kind" label="Kind" error={errors.kind}>
            <select id="f-kind" value={k} onChange={e => { const nk = e.target.value as Kind; setD(x => ({ ...x, kind: nk, legs: nk === "flight" && !x.legs.length ? [blankLeg()] : x.legs })); }}>
              {(Object.keys(ONE) as Kind[]).map(o => <option key={o} value={o}>{ONE[o]}</option>)}
            </select>
          </Field>
          <Field id="f-title" label="Title" error={errors.title} hint={k === "stay" ? "Hotel name, town" : k === "flight" ? "AC 892 Toronto to Venice" : "What it is"}>{text("title")}</Field>
          <Field id="f-provider" label="Booked through" hint="Airline, Booking.com, direct">{text("provider")}</Field>
          <Field id="f-code" label="Confirmation code" hint="Hidden until revealed">{text("code")}</Field>
        </div>
        <div className="bk-field"><span className="label" id="f-status-l">Status</span>
          <div className="bk-status-row" role="group" aria-labelledby="f-status-l">
            {STATUS_OPTS.map(([v, l, c]) => <button type="button" key={v} className={`chip ${d.status === v ? c : ""} bk-status-btn`} aria-pressed={d.status === v} onClick={() => set("status", v)}>{l}</button>)}
          </div>
        </div>
      </Sec>

      <Sec title="When">
        {k === "flight" && d.legs.map((l, i) => (
          <div key={i} className="bk-seg-form">
            <div className="bk-leg-h"><span className="chip num">Leg {i + 1}</span>
              {d.legs.length > 1 && <button type="button" className="btn small ghost" onClick={() => set("legs", d.legs.filter((_, n) => n !== i))} aria-label={`Remove leg ${i + 1}`}><Icon name="x" size={13} />Remove</button>}</div>
            <div className="bk-form-grid">
              <Field id={`f-num-${i}`} label="Flight"><input id={`f-num-${i}`} className="bk-input" value={l.num} placeholder="AC 892" onChange={e => setLeg(i, { num: e.target.value })} /></Field>
              <Field id={`f-cab-${i}`} label="Cabin"><input id={`f-cab-${i}`} className="bk-input" value={l.cabin} placeholder="Economy" onChange={e => setLeg(i, { cabin: e.target.value })} /></Field>
              <Field id={`f-from-${i}`} label="From" hint="Airport code"><input id={`f-from-${i}`} className="bk-input" value={l.from} placeholder="YYZ" onChange={e => setLeg(i, { from: e.target.value.toUpperCase() })} /></Field>
              <Field id={`f-to-${i}`} label="To" hint="Airport code"><input id={`f-to-${i}`} className="bk-input" value={l.to} placeholder="VCE" onChange={e => setLeg(i, { to: e.target.value.toUpperCase() })} /></Field>
              <Field id={`f-dep-${i}`} label="Departs" hint="Local time there" error={errors[`leg${i}`]}>
                <input id={`f-dep-${i}`} type="datetime-local" className="bk-input num" value={l.dep} aria-invalid={!!errors[`leg${i}`]} onChange={e => setLeg(i, { dep: e.target.value })} /></Field>
              <Field id={`f-depz-${i}`} label="Departure zone"><ZoneSelect id={`f-depz-${i}`} v={l.depTz} on={v => setLeg(i, { depTz: v })} /></Field>
              <Field id={`f-arr-${i}`} label="Arrives" hint="Local time there"><input id={`f-arr-${i}`} type="datetime-local" className="bk-input num" value={l.arr} onChange={e => setLeg(i, { arr: e.target.value })} /></Field>
              <Field id={`f-arrz-${i}`} label="Arrival zone"><ZoneSelect id={`f-arrz-${i}`} v={l.arrTz} on={v => setLeg(i, { arrTz: v })} /></Field>
            </div>
          </div>
        ))}
        {k === "flight" && <button type="button" className="btn small ghost bk-add-leg" onClick={() => set("legs", [...d.legs, { ...blankLeg(), depTz: d.legs.at(-1)?.arrTz ?? "", arrTz: d.legs.at(-1)?.depTz ?? "" }])}><Icon name="plus" size={14} />Add a leg</button>}

        {(k === "stay" || k === "car") && (
          <div className="bk-form-grid">
            <Field id="f-start" label={k === "stay" ? "Check-in" : "Pick-up"} hint={k === "stay" ? "Date and from time" : "Date and time"}>{text("start", { type: "datetime-local" })}</Field>
            <Field id="f-end" label={k === "stay" ? "Check-out" : "Drop-off"} hint={k === "stay" ? "Date and by time" : "Date and time"} error={errors.end}>{text("end", { type: "datetime-local" })}</Field>
            {k === "car" && <>
              <Field id="f-pickupPlace" label="Pick-up place">{text("pickupPlace", { placeholder: "Marco Polo, desk 3" })}</Field>
              <Field id="f-dropoffPlace" label="Drop-off place">{text("dropoffPlace", { placeholder: "Marco Polo, car return" })}</Field>
              <Field id="f-vehicleClass" label="Vehicle class" hint="Size, gearbox, fuel" wide>{text("vehicleClass", { placeholder: "Compact, automatic" })}</Field>
            </>}
            <Field id="f-tz" label="Time zone" hint="Both times are local there"><ZoneSelect id="f-tz" v={d.tz} on={v => set("tz", v)} /></Field>
          </div>
        )}
        {slot && (
          <div className="bk-form-grid">
            <Field id="f-date" label="Date">{text("date", { type: "date" })}</Field>
            <Field id="f-slotTime" label="Slot starts">{text("slotTime", { type: "time" })}</Field>
            <Field id="f-endTime" label="Slot ends" error={errors.endTime} hint="If it has one">{text("endTime", { type: "time" })}</Field>
            <Field id="f-entryFrom" label="Enter from" hint="Entry window opens">{text("entryFrom", { type: "time" })}</Field>
            <Field id="f-entryBy" label="Enter by" error={errors.entryBy} hint="Entry window closes">{text("entryBy", { type: "time" })}</Field>
            <Field id="f-tz" label="Time zone"><ZoneSelect id="f-tz" v={d.tz} on={v => set("tz", v)} /></Field>
            <Field id="f-where" label={k === "parking" ? "Lot" : "Meeting point"} wide>{text("where", { placeholder: k === "parking" ? "P4, Lago di Braies" : "Valley station" })}</Field>
          </div>
        )}
      </Sec>

      <Sec title="Who">
        {k === "flight" ? (
          <div className="bk-pax-list">
            {trip.travellers.map(t => (
              <div key={t.id} className="bk-pax-form"><Avatar initials={t.initials} /><span>{t.name}{t.age ? <span className="muted num"> {t.age}</span> : null}</span>
                <input aria-label={`Seat for ${t.name}`} className="bk-input num small-input" value={d.seats[t.id] ?? ""} onChange={e => set("seats", { ...d.seats, [t.id]: e.target.value })} placeholder="Seat" /></div>
            ))}
          </div>
        ) : (
          <div className="bk-form-grid">
            <Field id="f-adults" label="Adults" error={errors.adults}>{text("adults", { type: "number", inputMode: "numeric", min: "0", placeholder: "2" })}</Field>
            <Field id="f-children" label="Children's ages" error={errors.children} hint="Comma separated">{text("children", { placeholder: "10, 7" })}</Field>
            {k === "stay" && <>
              <Field id="f-rooms" label="Rooms" error={errors.rooms}>{text("rooms", { type: "number", inputMode: "numeric", min: "1", placeholder: "1" })}</Field>
              <Field id="f-roomType" label="Room type" hint="Bed setup, board">{text("roomType", { placeholder: "Family room, breakfast" })}</Field>
            </>}
          </div>
        )}
      </Sec>

      <Sec title="Money">
        <div className="bk-form-grid">
          <Field id="f-payStatus" label="Payment">
            <select id="f-payStatus" value={d.payStatus} onChange={e => set("payStatus", e.target.value as Draft["payStatus"])}>{PAY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <Field id="f-currency" label="Currency"><select id="f-currency" value={d.currency} onChange={e => set("currency", e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field id="f-total" label="Total" error={errors.total}>{text("total", { type: "number", inputMode: "decimal", min: "0", placeholder: "0.00" })}</Field>
          <Field id="f-paid" label="Paid so far" error={errors.paid}>{text("paid", { type: "number", inputMode: "decimal", min: "0", placeholder: "0.00" })}</Field>
          {(d.payStatus === "deposit" || d.payStatus === "unpaid") && <Field id="f-dueDate" label="Balance due" hint="Date">{text("dueDate", { type: "date" })}</Field>}
          <Field id="f-freeCancel" label="Free cancel until" hint="Date and time">{text("freeCancel", { type: "datetime-local" })}</Field>
          {d.status === "held" && <Field id="f-holdUntil" label="Held until" hint="Hold expires">{text("holdUntil", { type: "datetime-local" })}</Field>}
        </div>
      </Sec>

      <Sec title="Contact and links">
        <div className="bk-form-grid">
          <Field id="f-address" label="Address" wide>{text("address", { placeholder: "Street, town" })}</Field>
          <Field id="f-phone" label="Phone" error={errors.phone}>{text("phone", { type: "tel", inputMode: "tel", placeholder: "+39 0474 913 000" })}</Field>
          <Field id="f-email" label="Email" error={errors.email}>{text("email", { type: "email", inputMode: "email", placeholder: "info@hotel.example" })}</Field>
          <Field id="f-manageUrl" label="Manage booking link" error={errors.manageUrl} hint="https:// link from the confirmation" wide>{text("manageUrl", { type: "url", inputMode: "url", placeholder: "https://" })}</Field>
        </div>
      </Sec>

      <Sec title="Files and notes">
        {d.attachments.length > 0 && (
          <ul className="bk-files">
            {d.attachments.map((a, i) => (
              <li key={i}><Icon name={a.kind === "pdf" ? "list" : "layers"} size={14} /><span className="bk-file-name">{a.name}</span>
                <button type="button" className="btn ghost small" aria-label={`Remove ${a.name}`} onClick={() => set("attachments", d.attachments.filter((_, n) => n !== i))}><Icon name="x" size={13} /></button></li>
            ))}
          </ul>
        )}
        <label className="bk-upload"><Icon name="ticket" size={14} /> Add a PDF or photo<input type="file" multiple accept="application/pdf,image/*" className="sr" onChange={e => { pick(e.target.files); e.target.value = ""; }} /></label>
        <Field id="f-notes" label="Notes">
          <textarea id="f-notes" className="bk-input bk-notes" rows={3} value={d.notes} onChange={e => set("notes", e.target.value)} placeholder="Baggage, door codes, what to bring" />
        </Field>
      </Sec>

      <Sec title="Belongs to">
        <div className="bk-form-grid">
          <Field id="f-dayN" label="Day" hint="Where it shows in the plan">
            <select id="f-dayN" value={d.dayN} onChange={e => setD(x => ({ ...x, dayN: e.target.value, itemId: "" }))}>
              <option value="">Whole trip</option>
              {trip.days.map(dy => <option key={dy.n} value={dy.n}>Day {dy.n} · {dy.title ?? fmtDate(addDay(trip.start, dy.n - 1))}</option>)}
            </select>
          </Field>
          <Field id="f-itemId" label="Stop" hint={d.dayN ? "Optional" : "Pick a day first"}>
            <select id="f-itemId" value={d.itemId} disabled={!d.dayN} onChange={e => set("itemId", e.target.value)}>
              <option value="">No particular stop</option>
              {dayItems.map(id => { const it = trip.items[id]; return <option key={id} value={id}>{it.time ? `${it.time} · ` : ""}{place(it.placeId)?.name ?? "Stop"}</option>; })}
            </select>
          </Field>
        </div>
      </Sec>

      <motion.footer className={`bk-detail-f bk-form-f ${phone ? "phone" : ""}`} layout>
        <button type="submit" className="btn primary"><Icon name="check" size={14} />{initial ? "Save changes" : `Save ${label}`}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
      </motion.footer>
    </form>
  );
}

function ZoneSelect({ id, v, on }: { id: string; v: string; on: (v: string) => void }) {
  const list = v && !ZONES.includes(v) ? [v, ...ZONES] : ZONES;
  return <select id={id} value={v} onChange={e => on(e.target.value)}>{list.map(z => <option key={z} value={z}>{ZONE_LABEL(z)}</option>)}</select>;
}
function addDay(iso: string, n: number) { const [y, m, dd] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, dd + n)); return t.toISOString().slice(0, 10); }
