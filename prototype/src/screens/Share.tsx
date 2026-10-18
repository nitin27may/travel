// Share sheet (S26) with a live "what they will see" preview, and the guest view (S27).
// Rules from docs/v2/10-sharing.md: ages, heights and passport dates never leave the household; codes are
// off by default and chosen per reservation; private notes are excluded from every shared view.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ScreenProps } from ".";
import { dayDate, fmtDay, type Reservation } from "../data/trip";
import { useStore } from "../state/store";
import { Icon } from "../ui/Icon";
import "./share.css";

type Scope = "trip" | "days" | "today" | "list" | "item" | "reservation";
const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: "trip", label: "Whole trip", hint: "All 14 days" },
  { id: "days", label: "Some days", hint: "A range of days" },
  { id: "today", label: "Today's plan", hint: "Follows today, ends after the trip" },
  { id: "list", label: "A list", hint: "Ideas, Food and huts" },
  { id: "item", label: "One place", hint: "Meet us here" },
  { id: "reservation", label: "A booking card", hint: "Address, dates, phone" },
];
const EXPIRY = ["24 hours", "7 days", "End of trip", "Never"] as const;
// private notes belong to their author; the prototype marks one so the exclusion is visible
const PRIVATE_NOTES = [{ day: 9, text: "Pick up Aarav's birthday cake in Ortisei (surprise)" }];
const spring = { type: "spring" as const, stiffness: 520, damping: 40 };

interface Link { id: string; name: string; scope: string; expires: string; views: number; last: string; pin: boolean }

export function Share({ go, phone }: ScreenProps) {
  const { s, place } = useStore();
  const [audience, setAudience] = useState<"link" | "invite">("link");
  const [scope, setScope] = useState<Scope>("days");
  const [from, setFrom] = useState(9), [to, setTo] = useState(12);
  const [listId, setListId] = useState("ideas");
  const [itemId, setItemId] = useState(s.trip.days[11].itemIds[0]);
  const [resId, setResId] = useState("r-s1");
  const [inc, setInc] = useState({ notes: true, stays: true, transport: true, costs: false, tasks: false, allowCopy: true });
  const [codes, setCodes] = useState<Record<string, boolean>>({});
  const [expiry, setExpiry] = useState<(typeof EXPIRY)[number]>("7 days");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("Grandparents");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [links, setLinks] = useState<Link[]>([
    { id: "l1", name: "Grandparents", scope: "Days 1-14", expires: "End of trip", views: 12, last: "2 h ago", pin: false },
    { id: "l2", name: "Aarav's phone", scope: "Today's plan", expires: "End of trip", views: 3, last: "yesterday", pin: false },
  ]);
  const [members, setMembers] = useState([{ who: "Partner", email: "partner@example.com", role: "editor" }]);

  const days = useMemo(() => {
    if (scope === "trip") return s.trip.days;
    if (scope === "days") return s.trip.days.filter(d => d.n >= from && d.n <= to);
    if (scope === "today") return s.trip.days.filter(d => d.n === 3);
    return [];
  }, [scope, from, to, s.trip.days]);
  const resInScope: Reservation[] = scope === "reservation" ? s.trip.reservations.filter(r => r.id === resId)
    : days.length ? s.trip.reservations.filter(r => r.kind === "stay" || r.kind === "flight" || r.kind === "car" || days.some(d => d.itemIds.some(i => s.trip.items[i]?.ticket === r.id))) : [];
  const url = `app.example/s/${hash(`${scope}${from}${to}${listId}${itemId}${resId}${JSON.stringify(inc)}`)}`;
  const scopeLabel = scope === "days" ? `Days ${from}-${to}` : SCOPES.find(x => x.id === scope)!.label;

  async function copy() {
    try { await navigator.clipboard.writeText(`https://${url}`); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { const el = document.getElementById("share-url") as HTMLInputElement | null; el?.select(); }
  }
  function create() {
    if (audience === "invite") {
      if (!email.includes("@")) return;
      setMembers(m => [...m, { who: email.split("@")[0], email, role }]); setEmail(""); setMade("invite"); return;
    }
    setLinks(l => [{ id: `l${Date.now()}`, name: name || "Link", scope: scopeLabel, expires: expiry, views: 0, last: "never", pin: pin.length >= 4 }, ...l]);
    setMade("link");
  }
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="page">
      <div className="page-inner share">
        <header className="share-head">
          <div><div className="label">Dolomites · 13-26 Jul 2027</div><h1 className="sign page-title">Share</h1></div>
          <button className="btn" onClick={() => go("plan")}><Icon name="x" />Close</button>
        </header>
        <div className={`share-grid ${phone ? "one" : ""}`}>
          <section className="share-form" aria-label="What to share">
            <div className="seg" role="radiogroup" aria-label="Audience">
              <button role="radio" aria-checked={audience === "link"} className={audience === "link" ? "on" : ""} onClick={() => setAudience("link")}><Icon name="link" />Guest link</button>
              <button role="radio" aria-checked={audience === "invite"} className={audience === "invite" ? "on" : ""} onClick={() => setAudience("invite")}><Icon name="users" />Invite people</button>
            </div>

            {audience === "invite" ? (
              <div className="panelbox field-stack">
                <label className="fld"><span className="label">Email</span><input id="share-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></label>
                <div className="seg small" role="radiogroup" aria-label="Role">
                  {(["viewer", "editor"] as const).map(r => <button key={r} role="radio" aria-checked={role === r} className={role === r ? "on" : ""} onClick={() => setRole(r)}>{r === "viewer" ? "Can view" : "Can edit"}</button>)}
                </div>
                <p className="muted small">Members see the whole trip. Viewers never see booking codes, tickets or other people's private notes. Ages stay in the household.</p>
                <button className="btn primary" onClick={create} disabled={!email.includes("@")}>Send invite</button>
                <div className="label">People with access</div>
                <ul className="plain">
                  <li className="lrow"><span className="avatar ok">N</span><span><b>Nitin</b><small className="muted"> owner</small></span></li>
                  {members.map(m => <li key={m.email} className="lrow"><span className="avatar ok">{m.who[0].toUpperCase()}</span><span><b>{m.who}</b><small className="muted"> {m.email} · {m.role}</small></span>
                    <button className="btn ghost small danger" onClick={() => setMembers(x => x.filter(y => y.email !== m.email))}>Remove</button></li>)}
                </ul>
              </div>
            ) : (
              <>
                <fieldset className="panelbox">
                  <legend className="label">Share</legend>
                  <div className="scopes">
                    {SCOPES.map(x => (
                      <label key={x.id} className={`scope ${scope === x.id ? "on" : ""}`}>
                        <input type="radio" name="scope" checked={scope === x.id} onChange={() => setScope(x.id)} />
                        <span><b>{x.label}</b><small className="muted">{x.hint}</small></span>
                      </label>
                    ))}
                  </div>
                  {scope === "days" && <div className="inline-fields"><label>From day <select id="share-from" value={from} onChange={e => { const v = +e.target.value; setFrom(v); if (to < v) setTo(v); }}>{s.trip.days.map(d => <option key={d.n}>{d.n}</option>)}</select></label>
                    <label>to <select id="share-to" value={to} onChange={e => setTo(+e.target.value)}>{s.trip.days.filter(d => d.n >= from).map(d => <option key={d.n}>{d.n}</option>)}</select></label></div>}
                  {scope === "list" && <select id="share-list" value={listId} onChange={e => setListId(e.target.value)}>{s.trip.lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
                  {scope === "item" && <select id="share-item" value={itemId} onChange={e => setItemId(e.target.value)}>{s.trip.days.flatMap(d => d.itemIds.map(id => <option key={id} value={id}>Day {d.n}: {place(s.trip.items[id].placeId)?.name}</option>))}</select>}
                  {scope === "reservation" && <select id="share-res" value={resId} onChange={e => setResId(e.target.value)}>{s.trip.reservations.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}</select>}
                </fieldset>

                <fieldset className="panelbox">
                  <legend className="label">Include</legend>
                  {([["notes", "Notes", "Private notes are never included"], ["stays", "Where you sleep", "Names, dates and phone"], ["transport", "Flights and car", "Times and places"], ["costs", "Costs and budget", "Off unless you need it"], ["tasks", "Tasks", "For a helper looking after things"], ["allowCopy", "Allow 'Copy to my trips'", "They get the plan, not your bookings"]] as const).map(([k, l, h]) => (
                    <label key={k} className="tog"><input type="checkbox" checked={inc[k]} onChange={e => setInc(v => ({ ...v, [k]: e.target.checked }))} /><span><b>{l}</b><small className="muted">{h}</small></span></label>
                  ))}
                  {resInScope.filter(r => r.code).length > 0 && (
                    <div className="codes">
                      <div className="label">Booking codes · one at a time</div>
                      {resInScope.filter(r => r.code).map(r => (
                        <label key={r.id} className="tog"><input type="checkbox" checked={!!codes[r.id]} onChange={e => setCodes(c => ({ ...c, [r.id]: e.target.checked }))} /><span><b>{r.title}</b><small className="muted">Anyone with the code can change this booking</small></span></label>
                      ))}
                    </div>
                  )}
                  <p className="never small"><Icon name="shield" size={13} />Never shared: ages, heights, passport dates, tickets and receipts.</p>
                </fieldset>

                <fieldset className="panelbox field-stack">
                  <legend className="label">Link settings</legend>
                  <label className="fld"><span className="label">Name it</span><input id="share-name" value={name} onChange={e => setName(e.target.value)} /></label>
                  <div className="seg small" role="radiogroup" aria-label="Expires">
                    {EXPIRY.map(x => <button key={x} role="radio" aria-checked={expiry === x} className={expiry === x ? "on" : ""} onClick={() => setExpiry(x)}>{x}</button>)}
                  </div>
                  <label className="fld"><span className="label">PIN (optional, 4-6 digits)</span><input id="share-pin" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="none" /></label>
                  <button className="btn primary" onClick={create}>Create link</button>
                </fieldset>
              </>
            )}
            <AnimatePresence>
              {made === "link" && (
                <motion.div className="panelbox made" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
                  <div className="label">Link ready</div>
                  <div className="url-row"><input id="share-url" readOnly value={`https://${url}`} aria-label="Link" onFocus={e => e.target.select()} />
                    <button className="btn primary" onClick={copy}><Icon name={copied ? "check" : "link"} />{copied ? "Copied" : "Copy"}</button></div>
                  <div className="qr-row"><QR text={url} /><div className="field-stack">
                    <p className="small muted">Scan from another phone. {pin.length >= 4 ? "They will be asked for the PIN." : "No PIN set."} Expires: {expiry.toLowerCase()}.</p>
                    {canShare && <button className="btn" onClick={() => navigator.share?.({ title: "Dolomites plan", url: `https://${url}` }).catch(() => {})}><Icon name="share" />Send with…</button>}
                    <button className="btn" onClick={() => go("guest")}>Open as a guest</button>
                  </div></div>
                </motion.div>
              )}
            </AnimatePresence>

            <section className="panelbox">
              <div className="label">Active links</div>
              <ul className="plain">
                <AnimatePresence initial={false}>
                  {links.map(l => (
                    <motion.li key={l.id} className="lrow" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={spring}>
                      <Icon name="link" />
                      <span><b>{l.name}</b><small className="muted num"> {l.scope} · {l.views} views · last {l.last} · expires {l.expires.toLowerCase()}{l.pin ? " · PIN" : ""}</small></span>
                      <button className="btn ghost small danger" onClick={() => setLinks(x => x.filter(y => y.id !== l.id))}>Revoke</button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              <p className="muted small">Revoking stops the link at once. It cannot unsee what someone already opened.</p>
            </section>
          </section>

          <section className="preview" aria-label="What they will see" aria-live="polite">
            <div className="preview-bar"><span className="label">What they will see</span><span className="chip">{audience === "invite" ? `${role} · signed in` : "signed out · read only"}</span></div>
            <div className="preview-phone">
              {audience === "invite" ? <p className="muted small">Members see the full plan in the app. {role === "viewer" ? "Without booking codes, tickets and your private notes." : "They can edit the plan, bookings and tasks."}</p> :
                <GuestBody days={days} scope={scope} listId={listId} itemId={itemId} reservations={resInScope} inc={inc} codes={codes} expiry={expiry} />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function GuestBody({ days, scope, listId, itemId, reservations, inc, codes, expiry, banner = true }: {
  days: { n: number; itemIds: string[]; base?: string; title?: string }[]; scope: Scope; listId?: string; itemId?: string; reservations: Reservation[];
  inc: { notes: boolean; stays: boolean; transport: boolean; costs: boolean; tasks: boolean; allowCopy: boolean }; codes: Record<string, boolean>; expiry: string; banner?: boolean;
}) {
  const { s, place } = useStore();
  const names = s.trip.travellers.map(t => t.name).join(", ");          // first names only, never ages
  const hiddenPrivate = PRIVATE_NOTES.filter(p => days.some(d => d.n === p.day)).length;
  return (
    <div className="guest-body">
      {banner && <div className="guest-banner"><Icon name="shield" size={14} />Shared by Nitin · view only · expires {expiry === "End of trip" ? "Mon 26 Jul" : expiry === "Never" ? "never" : expiry === "24 hours" ? "tomorrow" : "Sun 25 Jul"}</div>}
      <h2 className="sign guest-title">Dolomites</h2>
      <p className="muted small">{names} · 13-26 Jul 2027</p>
      {scope === "list" && listId && <div className="g-day"><b>{s.trip.lists.find(l => l.id === listId)?.name}</b>
        <ul>{s.trip.lists.find(l => l.id === listId)?.itemIds.map(id => <li key={id}>{place(s.trip.items[id].placeId)?.name}</li>)}</ul></div>}
      {scope === "item" && itemId && (() => { const it = s.trip.items[itemId]; const p = place(it.placeId); return p && <div className="g-day"><b>{p.name}</b><p className="small">{it.time ? `At ${it.time}. ` : ""}{p.summary}</p><p className="small muted num">{p.lat.toFixed(4)}, {p.lng.toFixed(4)} · open in Maps</p></div>; })()}
      {days.map(d => (
        <div key={d.n} className="g-day">
          <div className="g-day-head"><span className="sign">Day {d.n}</span><span className="num muted">{fmtDay(dayDate(s.trip.start, d.n))}</span></div>
          <b className="small">{d.title}</b>
          <ul>{d.itemIds.map(id => { const it = s.trip.items[id]; const p = place(it.placeId); return p && <li key={id}><span className="num">{it.time ?? "—"}</span> {p.name}{inc.notes && it.note ? <small className="muted"> · {it.note}</small> : null}</li>; })}</ul>
          {inc.stays && d.base && <p className="small"><Icon name="bed" size={12} /> {place(d.base)?.name}</p>}
        </div>
      ))}
      {reservations.filter(r => (r.kind === "stay" && inc.stays) || ((r.kind === "flight" || r.kind === "car") && inc.transport) || (r.kind !== "stay" && r.kind !== "flight" && r.kind !== "car") || scope === "reservation").map(r => (
        <div key={r.id} className="g-res"><b>{r.title}</b><span className="small muted">{r.when}</span>
          {r.code && (codes[r.id] ? <span className="num small">Code {r.code}</span> : <span className="small muted">Code not shared</span>)}
          {inc.costs && r.cost && <span className="small num">{r.cost}</span>}</div>
      ))}
      {hiddenPrivate > 0 && <p className="small muted"><Icon name="shield" size={12} /> {hiddenPrivate} private note not shown.</p>}
      {inc.allowCopy && <button className="btn" disabled>Copy to my trips</button>}
    </div>
  );
}

export function Guest({ go }: ScreenProps) {
  const { s } = useStore();
  const [copied, setCopied] = useState(false);
  return (
    <div className="page guest-page">
      <div className="page-inner guest">
        <GuestBody days={s.trip.days.filter(d => d.n >= 9 && d.n <= 12)} scope="days" reservations={s.trip.reservations.filter(r => r.kind === "stay")}
          inc={{ notes: true, stays: true, transport: true, costs: false, tasks: false, allowCopy: false }} codes={{}} expiry="7 days" />
        <div className="guest-foot">
          <button className="btn primary" onClick={() => setCopied(true)}>{copied ? "Copied to your trips (sign in to keep it)" : "Copy to my trips"}</button>
          <button className="btn ghost" onClick={() => go("share")}>Back to sharing (owner)</button>
        </div>
        <p className="muted small">Saved on this phone after the first open, so it works without signal.</p>
      </div>
    </div>
  );
}

/** QR-style code drawn on canvas. Illustrative, not a scannable QR (the app uses a real encoder). */
function QR({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext("2d"); if (!g) return;
    const n = 25, px = 5; c.width = c.height = n * px + 20;
    const st = getComputedStyle(document.documentElement);
    g.fillStyle = st.getPropertyValue("--surface").trim() || "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = st.getPropertyValue("--ink").trim() || "#000";
    let x = hashNum(text);
    const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
    const finder = (i: number, j: number) => [[0, 0], [0, n - 7], [n - 7, 0]].some(([a, b]) => i >= a && i < a + 7 && j >= b && j < b + 7);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      let on: boolean;
      if (finder(i, j)) { const a = i < 7 ? i : i - (n - 7), b = j < 7 ? j : j - (n - 7); on = a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4); }
      else on = rnd() > 0.52;
      if (on) g.fillRect(10 + j * px, 10 + i * px, px, px);
    }
  }, [text]);
  return <canvas ref={ref} className="qr" role="img" aria-label="QR code for the link" />;
}
const hashNum = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0 || 1; };
const hash = (s: string) => hashNum(s).toString(36).slice(0, 7);
