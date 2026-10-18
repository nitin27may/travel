// The booking detail sheet: every captured field in readable groups. The confirmation code stays hidden until revealed.
import { useState, type ReactNode } from "react";
import type { Attachment, Reservation } from "../data/trip";
import { useStore } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import { KIND_ICON, ONE } from "./BookingForm";
import { cancelInfo, fmtDate, fmtDT, fmtTime, instant, paymentLine, TODAY, ZONE_LABEL, daysBetween, type Tone } from "./bookingsLib";
import type { ScreenId } from ".";

export const STATUS: Record<Reservation["status"], { label: string; cls: string }> = {
  to_book: { label: "to book", cls: "warn" }, held: { label: "held", cls: "act" }, booked: { label: "booked", cls: "ok" },
};

function Grp({ title, children }: { title: string; children: ReactNode }) {
  return <section className="bk-grp"><h3 className="label bk-grp-h">{title}</h3>{children}</section>;
}
function Row({ k, children }: { k: string; children: ReactNode }) { return <div><dt>{k}</dt><dd>{children}</dd></div>; }
const dur = (a: number, b: number) => { const m = Math.round((b - a) / 60000); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`; };

export function Detail({ r, go, onClose, onMark, onEdit, onAttach }: {
  r: Reservation; go: (id: ScreenId) => void; onClose: () => void; onMark: (id: string, s: Reservation["status"]) => void; onEdit: () => void; onAttach: (id: string, a: Attachment[]) => void;
}) {
  const { s, place } = useStore();
  const trip = s.trip;
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = r.placeId ? place(r.placeId) : undefined;
  const copy = async () => { try { await navigator.clipboard.writeText(r.code ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setReveal(true); } };
  const pay = paymentLine(r); const cancel = r.status === "booked" || r.status === "held" ? cancelInfo(r) : undefined;
  const holdLeft = r.holdUntil ? daysBetween(TODAY, r.holdUntil) : undefined;
  const dayN = r.dayN; const day = dayN ? trip.days[dayN - 1] : undefined;
  const item = (r.itemId && trip.items[r.itemId]) || Object.values(trip.items).find(i => i.ticket === r.id);
  const itemPlace = item ? place(item.placeId) : undefined;
  const g = r.guests; const who = g ? `${g.adults} adult${g.adults === 1 ? "" : "s"}${g.children.length ? `, ${g.children.length} child${g.children.length === 1 ? "" : "ren"} (${g.children.join(", ")})` : ""}` : undefined;
  const tz = r.tz ? ZONE_LABEL(r.tz) : undefined;
  const slot = r.kind === "lift" || r.kind === "parking" || r.kind === "activity" || r.kind === "restaurant";
  const when: ReactNode[] = [];
  if (r.kind === "stay") { when.push(<Row key="a" k="Check-in">{r.start ? <span className="num">{fmtDate(r.start, { year: true })}{fmtTime(r.start) ? `, from ${fmtTime(r.start)}` : ""}</span> : "Not set"}</Row>, <Row key="b" k="Check-out">{r.end ? <span className="num">{fmtDate(r.end, { year: true })}{fmtTime(r.end) ? `, by ${fmtTime(r.end)}` : ""}</span> : "Not set"}</Row>); }
  else if (r.kind === "car") { when.push(<Row key="a" k="Pick-up"><span className="num">{fmtDT(r.start, { year: true })}</span>{r.pickupPlace && <span className="muted"> · {r.pickupPlace}</span>}</Row>, <Row key="b" k="Drop-off"><span className="num">{fmtDT(r.end, { year: true })}</span>{r.dropoffPlace && <span className="muted"> · {r.dropoffPlace}</span>}</Row>); }
  else if (slot) {
    when.push(<Row key="a" k="Slot"><span className="num">{fmtDT(r.start, { year: true })}{r.end && fmtTime(r.end) ? ` to ${fmtTime(r.end)}` : ""}</span></Row>);
    if (r.entryFrom || r.entryBy) when.push(<Row key="b" k="Entry"><span className="num">{r.entryFrom && r.entryBy ? `${r.entryFrom} to ${r.entryBy}` : r.entryFrom ? `from ${r.entryFrom}` : `by ${r.entryBy}`}</span></Row>);
    if (r.where) when.push(<Row key="c" k="Meet at">{r.where}</Row>);
  }
  if (tz && r.kind !== "flight") when.push(<Row key="z" k="Time zone">{tz} <span className="muted">(all times local)</span></Row>);
  if (r.nights) when.push(<Row key="n" k="Nights">{r.nights}</Row>);
  if (r.kind === "car" && r.vehicleClass) when.push(<Row key="v" k="Vehicle">{r.vehicleClass}</Row>);
  if (r.kind === "stay" && (r.roomType || r.rooms)) when.push(<Row key="rm" k="Room">{[r.rooms ? `${r.rooms} room${r.rooms === 1 ? "" : "s"}` : "", r.roomType].filter(Boolean).join(" · ")}</Row>);
  if (!when.length && !r.legs) when.push(<Row key="w" k="When"><span className="num">{r.when}</span></Row>);

  return (
    <div className="bk-detail">
      <header className="bk-detail-h">
        <span className="glyph big"><Icon name={KIND_ICON[r.kind]} /></span>
        <div><div className="label">{ONE[r.kind]}{dayN ? ` · Day ${dayN}` : ""}</div><h2 className="bk-detail-title">{r.title}</h2>
          {r.provider && <div className="muted small bk-via">Booked through {r.provider}</div>}</div>
        <button className="btn ghost" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </header>
      <div className="bk-status-row">
        {(["to_book", "held", "booked"] as const).map(st => (
          <button key={st} className={`chip ${r.status === st ? STATUS[st].cls : ""} bk-status-btn`} aria-pressed={r.status === st} onClick={() => onMark(r.id, st)}>{STATUS[st].label}</button>
        ))}
      </div>
      {r.status === "to_book" && (
        <div className="bk-callout">
          <Icon name="clock" /><div><b>Not booked yet.</b> {r.opensAt ?? "No booking window known."}<div className="muted small">A Book task with reminders exists in Tasks. Mark it booked here when done, or paste the confirmation.</div></div>
        </div>
      )}
      {r.status === "held" && r.holdUntil && (
        <div className={`bk-callout ${holdLeft != null && holdLeft <= 14 ? "" : "quiet"}`}><Icon name="clock" /><div><b>Held until {fmtDT(r.holdUntil, { year: true })}.</b><div className="muted small">{holdLeft != null && holdLeft >= 0 ? `${holdLeft} days from today. Confirm or release it before then.` : "The hold has expired."}</div></div></div>
      )}

      {(when.length > 0 || r.legs) && (
        <Grp title="When">
          {when.length > 0 && <dl className="bk-facts">{when}</dl>}
          {r.legs && (
            <ol className="bk-segs">
              {r.legs.map((l, i) => (
                <li key={i} className="bk-seg">
                  <span className="bk-seg-dot" aria-hidden="true" />
                  <div className="bk-seg-body">
                    <div className="bk-seg-top">{l.num && <span className="chip num">{l.num}</span>}{l.cabin && <span className="muted small">{l.cabin}</span>}
                      {l.dep && l.arr && <span className="muted small num">{dur(instant(l.dep, l.depTz), instant(l.arr, l.arrTz))}</span>}</div>
                    <div className="bk-seg-line"><b>{l.from}</b><Icon name="chevron" size={14} /><b>{l.to}</b></div>
                    <div className="muted small num">{fmtDT(l.dep)}{l.depTz ? ` ${ZONE_LABEL(l.depTz)}` : ""} → {fmtDT(l.arr)}{l.arrTz ? ` ${ZONE_LABEL(l.arrTz)}` : ""}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Grp>
      )}

      {(who || r.kind === "flight" || r.kind === "lift") && (
        <Grp title="Who">
          {who && r.kind !== "flight" && <dl className="bk-facts"><Row k="Guests">{who}</Row></dl>}
          {(r.kind === "flight" || r.kind === "lift") && (
            <ul className="bk-pax">
              {trip.travellers.map(t => (
                <li key={t.id}><Avatar initials={t.initials} /><span>{t.name}{t.age ? <span className="muted num"> {t.age}</span> : null}</span>{r.kind === "flight" && <span className="num muted">{r.seats?.[t.id] ? `seat ${r.seats[t.id]}` : "no seat"}</span>}</li>
              ))}
            </ul>
          )}
        </Grp>
      )}

      {(pay || cancel || r.cost) && (
        <Grp title="Money">
          <dl className="bk-facts">
            {(pay || r.cost) && <Row k="Payment"><span className="num">{pay ?? r.cost}</span></Row>}
            {cancel && <Row k="Cancellation"><span className={`chip ${cancel.cls as Tone}`}>{cancel.warn && <Icon name="alert" size={12} />}{cancel.text}</span></Row>}
          </dl>
        </Grp>
      )}

      {(r.address || r.phone || r.email || r.manageUrl || p) && (
        <Grp title="Contact and links">
          <dl className="bk-facts">
            {p && <Row k="Place">{p.name}<span className="muted"> · {p.area}</span></Row>}
            {r.address && <Row k="Address">{r.address}</Row>}
            {r.phone && <Row k="Phone"><a className="bk-link num" href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}><Icon name="phone" size={13} />{r.phone}</a></Row>}
            {r.email && <Row k="Email"><a className="bk-link" href={`mailto:${r.email}`}>{r.email}</a></Row>}
            {r.manageUrl && <Row k="Manage"><a className="bk-link" href={r.manageUrl} target="_blank" rel="noopener noreferrer"><Icon name="link" size={13} />{new URL(r.manageUrl).hostname.replace(/^www\./, "")}</a></Row>}
          </dl>
        </Grp>
      )}

      {r.attachments?.length ? (
        <Grp title="Files">
          <ul className="bk-files static">{r.attachments.map((a, i) => <li key={i}><Icon name={a.kind === "pdf" ? "list" : "layers"} size={14} /><span className="bk-file-name">{a.name}</span><span className="muted small num">{fmtDate(a.addedAt, { dow: false })}</span></li>)}</ul>
        </Grp>
      ) : null}

      {(r.notes || r.note) && <Grp title="Notes"><p className="bk-notes-t">{r.notes ?? r.note}</p></Grp>}

      <Grp title="Belongs to">
        {day ? (
          <div className="bk-belongs">
            <div><b>Day {day.n}</b>{day.title ? <span className="muted"> · {day.title}</span> : null}
              {itemPlace && <div className="small muted">{item?.time ? `${item.time} · ` : ""}{itemPlace.name}</div>}</div>
            <button className="btn small" onClick={() => go("plan")}><Icon name="cal" size={14} />Open in Plan</button>
          </div>
        ) : <p className="muted small bk-notes-t">The whole trip. Pick a day when you edit it to see it in the plan.</p>}
      </Grp>

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
        <button className="btn primary" onClick={onEdit}><Icon name="edit" size={14} />Edit</button>
        {r.manageUrl && <a className="btn" href={r.manageUrl} target="_blank" rel="noopener noreferrer"><Icon name="link" size={14} />Manage booking</a>}
        <label className="btn ghost bk-attach"><Icon name="ticket" size={14} />Attach file
          <input type="file" multiple accept="application/pdf,image/*" className="sr" onChange={e => {
            const f = Array.from(e.target.files ?? []); if (!f.length) return;
            onAttach(r.id, f.map(x => ({ name: x.name, kind: x.type.startsWith("image/") ? "image" as const : "pdf" as const, addedAt: TODAY }))); e.target.value = "";
          }} /></label>
      </footer>
    </div>
  );
}
