// Settings (S24): household, notifications, connected chat clients (MCP) and personal access tokens.
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ScreenProps } from ".";
import { Icon } from "../ui/Icon";
import "./settings.css";

type Tab = "household" | "notifications" | "clients" | "tokens";
const spring = { type: "spring" as const, stiffness: 520, damping: 40 };
const SCOPE_INFO: Record<string, string> = {
  "catalog:read": "Search places, trails and guides",
  "trips:read": "Read your trips and plans",
  "trips:write": "Add, move and change items in your trips",
  "reservations:read": "See booking codes and tickets",
  "people:read": "See ages, heights and passport dates",
  "research:propose": "Suggest new places and facts for review",
};

export function Settings({ phone }: ScreenProps) {
  const [tab, setTab] = useState<Tab>("household");
  const tabs: [Tab, string, string][] = [["household", "Household", "home"], ["notifications", "Notifications", "inbox"], ["clients", "Connected apps", "link"], ["tokens", "Access tokens", "shield"]];
  return (
    <div className="page">
      <div className="page-inner settings">
        <h1 className="sign page-title">Settings</h1>
        <div className={`set-grid ${phone ? "one" : ""}`}>
          <nav className="set-nav" aria-label="Settings sections">
            {tabs.map(([id, l, i]) => <button key={id} className={tab === id ? "on" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon name={i} />{l}</button>)}
          </nav>
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} className="set-body">
              {tab === "household" && <Household />}
              {tab === "notifications" && <Notifications />}
              {tab === "clients" && <Clients />}
              {tab === "tokens" && <Tokens />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Household() {
  const [radius, setRadius] = useState(120);
  const [people, setPeople] = useState([
    { name: "Nitin", born: "1986", height: "", passport: "2031-04" },
    { name: "Partner", born: "1988", height: "", passport: "2029-11" },
    { name: "Aarav", born: "2016", height: "142", passport: "2027-09" },
  ]);
  const soon = (p: string) => p && p <= "2027-10";
  return (
    <>
      <section className="panelbox set-sec">
        <h2 className="set-h">Home base</h2>
        <label className="fld"><span className="label">Start from</span><input id="hh-home" defaultValue="Whitby, Ontario" /></label>
        <label className="fld"><span className="label">Day-trip radius: <span className="num">{radius} min</span> drive</span>
          <input id="hh-radius" type="range" min={30} max={240} step={15} value={radius} onChange={e => setRadius(+e.target.value)} /></label>
        <div className="chips-row">{["Car", "Mid-range", "Balanced pace", "Waterfalls", "Lookouts", "Caves", "Swimming", "Splash pads"].map(x => <span key={x} className="chip act">{x}</span>)}</div>
        <p className="small"><b>Avoid:</b> unfenced cliff edges with young kids; long drives with nothing to break them up.</p>
      </section>
      <section className="panelbox set-sec">
        <div className="row-between"><h2 className="set-h">People</h2><span className="chip ok"><Icon name="shield" size={12} />Private to the household</span></div>
        <p className="muted small">Ages and heights decide what fits (via ferrata 12+, toboggan 8+). They never appear in shared links, templates or chat clients without permission.</p>
        <div className="ptable" role="table">
          <div className="prow head" role="row"><span>Name</span><span>Born</span><span>Height</span><span>Passport valid to</span></div>
          {people.map((p, i) => (
            <div key={i} className="prow" role="row">
              <input id={`p-name-${i}`} value={p.name} aria-label="Name" onChange={e => setPeople(x => x.map((y, k) => k === i ? { ...y, name: e.target.value } : y))} />
              <input id={`p-born-${i}`} className="num" value={p.born} aria-label="Birth year" inputMode="numeric" onChange={e => setPeople(x => x.map((y, k) => k === i ? { ...y, born: e.target.value } : y))} />
              <input id={`p-h-${i}`} className="num" value={p.height} placeholder="optional" aria-label="Height in cm" onChange={e => setPeople(x => x.map((y, k) => k === i ? { ...y, height: e.target.value } : y))} />
              <span className="pp"><input id={`p-pp-${i}`} type="month" className="num" value={p.passport} aria-label="Passport valid to" onChange={e => setPeople(x => x.map((y, k) => k === i ? { ...y, passport: e.target.value } : y))} />
                {soon(p.passport) && <span className="chip warn">too short for Dolomites: needs valid to Oct 2027</span>}</span>
            </div>
          ))}
        </div>
        <button className="btn" onClick={() => setPeople(x => [...x, { name: "", born: "", height: "", passport: "" }])}><Icon name="plus" />Add a person</button>
      </section>
      <section className="panelbox set-sec">
        <h2 className="set-h">Passes and memberships</h2>
        <ul className="plain">
          <li className="lrow"><Icon name="ticket" /><span><b>Ontario Parks vehicle pass</b><small className="muted num"> expires 31 Mar 2027</small></span><span className="chip ok">active</span></li>
          <li className="lrow"><Icon name="ticket" /><span><b>Parks Canada Discovery Pass</b><small className="muted"> pays for itself after 3 visits on the Rockies trip</small></span><span className="chip warn">not held</span></li>
        </ul>
      </section>
    </>
  );
}

function Notifications() {
  const [ch, setCh] = useState({ push: true, email: true, calendar: true, digest: true });
  const [quiet, setQuiet] = useState({ from: "22:00", to: "07:00" });
  const [override, setOverride] = useState(true);
  return (
    <>
      <section className="panelbox set-sec">
        <h2 className="set-h">How we reach you</h2>
        {([["push", "Push to this phone", "For booking openings that sell out in minutes. On iPhone, add the app to the Home Screen first."], ["email", "Email", "A copy of every booking reminder."], ["calendar", "Calendar feed", "A backstop: calendars refresh feeds every few hours, so it never carries a 15-minute warning alone."], ["digest", "Weekly digest", "While a trip is in Book or Prepare."]] as const).map(([k, l, h]) => (
          <label key={k} className="tog"><input type="checkbox" checked={ch[k]} onChange={e => setCh(v => ({ ...v, [k]: e.target.checked }))} /><span><b>{l}</b><small className="muted">{h}</small></span></label>
        ))}
      </section>
      <section className="panelbox set-sec">
        <h2 className="set-h">Quiet hours</h2>
        <div className="inline-fields"><label>From <input id="q-from" type="time" className="num" value={quiet.from} onChange={e => setQuiet(q => ({ ...q, from: e.target.value }))} /></label>
          <label>to <input id="q-to" type="time" className="num" value={quiet.to} onChange={e => setQuiet(q => ({ ...q, to: e.target.value }))} /></label></div>
        <label className="tog"><input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} /><span><b>Ring anyway for fast-selling openings</b><small className="muted">The Seceda lift slots open at 08:00 Italian time, which is 02:00 in Whitby. Other reminders wait until {quiet.to}.</small></span></label>
      </section>
      <section className="panelbox set-sec">
        <h2 className="set-h">Booking openings, schedule</h2>
        <ol className="sched num">{["7 days before", "The evening before", "15 minutes before", "At opening", "2 hours after: did you get it?"].map(x => <li key={x}>{x}</li>)}</ol>
      </section>
    </>
  );
}

function Clients() {
  const [clients, setClients] = useState([
    { id: "claude", name: "Claude", last: "today 08:14", scopes: { "catalog:read": true, "trips:read": true, "trips:write": true, "reservations:read": false, "people:read": false, "research:propose": true } as Record<string, boolean>, recent: "Added 6 items to Dolomites · day 11 (undo available)" },
    { id: "cc", name: "Claude Code (research)", last: "2 days ago", scopes: { "catalog:read": true, "trips:read": false, "trips:write": false, "reservations:read": false, "people:read": false, "research:propose": true } as Record<string, boolean>, recent: "Proposed 14 changes for El Chaltén trails (in review)" },
  ]);
  return (
    <>
      <p className="muted small">Chat clients connect through MCP and act as you, within the permissions below. Every change they make shows in the trip's activity with an undo.</p>
      <AnimatePresence initial={false}>
        {clients.map(c => (
          <motion.section key={c.id} className="panelbox set-sec" layout exit={{ opacity: 0, height: 0 }} transition={spring}>
            <div className="row-between"><h2 className="set-h">{c.name}</h2><span className="muted small num">last used {c.last}</span></div>
            <p className="small"><Icon name="clock" size={12} /> {c.recent}</p>
            <div className="scopes-list">
              {Object.entries(c.scopes).map(([k, on]) => (
                <label key={k} className={`tog ${k === "people:read" || k === "reservations:read" ? "sensitive" : ""}`}>
                  <input type="checkbox" checked={on} onChange={e => setClients(x => x.map(y => y.id === c.id ? { ...y, scopes: { ...y.scopes, [k]: e.target.checked } } : y))} />
                  <span><b className="num">{k}</b><small className="muted">{SCOPE_INFO[k]}{(k === "people:read" || k === "reservations:read") ? " · off unless you turn it on" : ""}</small></span>
                </label>
              ))}
            </div>
            <button className="btn ghost danger" onClick={() => setClients(x => x.filter(y => y.id !== c.id))}>Disconnect {c.name}</button>
          </motion.section>
        ))}
      </AnimatePresence>
      {clients.length === 0 && <p className="muted">No chat clients connected. Add the MCP address to your client and sign in from there.</p>}
      <section className="panelbox set-sec"><h2 className="set-h">Connect a client</h2><p className="small">MCP address</p><code className="code num">https://app.example/mcp</code></section>
    </>
  );
}

function Tokens() {
  const [tokens, setTokens] = useState([{ id: "t1", name: "Laptop Claude Code", scopes: "catalog:read, research:propose", created: "3 Oct 2026", last: "yesterday" }]);
  const [name, setName] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  function create() {
    const raw = Array.from(crypto.getRandomValues(new Uint8Array(18))).map(b => b.toString(16).padStart(2, "0")).join("");
    setTokens(t => [{ id: raw.slice(0, 6), name: name || "New token", scopes: "catalog:read, trips:read", created: "today", last: "never" }, ...t]);
    setShown(`tp_${raw}`); setName("");
  }
  return (
    <>
      <section className="panelbox set-sec">
        <h2 className="set-h">Create a token</h2>
        <p className="muted small">For clients that cannot sign in with OAuth (for example Claude Code with a header). Tokens older than 90 days are flagged for rotation.</p>
        <div className="url-row"><input id="tok-name" value={name} onChange={e => setName(e.target.value)} placeholder="What is it for?" aria-label="Token name" /><button className="btn primary" onClick={create}>Create</button></div>
        <AnimatePresence>
          {shown && (
            <motion.div className="tok-once" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
              <p className="small"><b>Copy it now.</b> This is the only time it is shown; we store only a hash.</p>
              <div className="url-row"><input id="tok-value" readOnly value={shown} className="num" onFocus={e => e.target.select()} aria-label="New token" />
                <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(shown); setCopied(true); } catch { (document.getElementById("tok-value") as HTMLInputElement)?.select(); } }}>{copied ? "Copied" : "Copy"}</button>
                <button className="btn ghost" onClick={() => { setShown(null); setCopied(false); }}>Done</button></div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      <section className="panelbox set-sec">
        <h2 className="set-h">Your tokens</h2>
        <ul className="plain">
          {tokens.map(t => <li key={t.id} className="lrow"><Icon name="shield" /><span><b>{t.name}</b><small className="muted num"> {t.scopes} · created {t.created} · last used {t.last}</small></span>
            <button className="btn ghost small danger" onClick={() => setTokens(x => x.filter(y => y.id !== t.id))}>Revoke</button></li>)}
        </ul>
      </section>
    </>
  );
}
