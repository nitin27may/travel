// Trail section of the place page: facts grid with inline edit, route-data state, hazards, grouped links with
// an inline "Add a link" form. Edits live in the module store in data/trails.ts so they survive navigation.
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import {
  checkedLabel, checklist, fmtPoint, nav, osmUrl, sourceLabel,
  DIFFICULTY, FIELD, FIELDS, GROUPS, KIND_GROUP, LINK_GROUPS, LINK_KINDS, addHazard, addLink, domainOf, guessKind, isHttp, removeHazard, removeLink,
  sendFactForReview, sendHazardForReview, sendLinkForReview, saveFacts, useTrail, validate,
  type Fact, type FieldDef, type LinkKind, type ParkingLot, type Point, type TrailLink, type TrailRecord, type Trailhead,
} from "../data/trails";

const NOT_YET = "not researched yet";
const trustOf = (f: Fact) => (f.conf === "official" || f.conf === "operator" ? "stated" : "unverified");

function useFade() {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: false as const, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: "auto" }, exit: { opacity: 0, height: 0 }, transition: { duration: 0.2 } };
}

function Provenance({ f, onSend }: { f: Fact; onSend?: () => void }) {
  if (f.you) {
    return (
      <span className="tr-prov">
        <span className="chip act">added by you · {f.added ?? "today"}</span>
        {f.sent ? <span className="chip ok"><Icon name="check" size={11} />sent for review</span> : <button type="button" className="chip glow tr-send" onClick={onSend}>Send for review</button>}
      </span>
    );
  }
  if (f.conflict?.length) {
    return (
      <span className="tr-conf">
        <span className="chip warn"><Icon name="alert" size={11} />sources disagree · {f.conflict.length}</span>
        {f.conflict.map((c, i) => <span key={i} className="small"><b>{c.v}</b><span className="muted"> · {c.conf} · {c.src} · read {c.read}</span></span>)}
      </span>
    );
  }
  const t = trustOf(f);
  return <span className="tr-prov small muted"><span className={`chip trust-${t}`}>{t}</span> {f.conf} · {f.src} · read {f.read}</span>;
}

/** Four-step fallback chain with the active step marked. */
export function RouteState({ rec }: { rec: TrailRecord }) {
  const src = rec.facts.geometry_source?.v ?? "none";
  const ids = rec.facts.geometry_ids?.v ?? "";
  const first = ids.match(/\d{5,}/)?.[0];
  const hasLine = src !== "none" && !!rec.facts.geometry_source;
  const hasEmbed = rec.links.some(l => l.kind === "komoot" || l.kind === "wikiloc");
  const hasTh = !!(rec.facts.th_lat && rec.facts.th_lon);
  const headline = !rec.facts.geometry_source
    ? "Route data not looked up yet"
    : src === "osm_relation" ? `Route line from OSM relation ${first ?? ""}`.trim()
      : src === "osm_ways" ? "Route line from OSM ways, no relation"
        : src === "none" ? "Pins only: no open route data yet" : `Route line from ${src.replace("_", " ")}`;
  const steps = [
    { n: 1, t: "Own line from open data", d: hasLine ? `${src}${ids ? ": " + ids : ""}` : "none stored", on: hasLine },
    { n: 2, t: "Third-party embed (Komoot, Wikiloc)", d: hasEmbed ? "a tour exists; embed terms not yet checked, so link only for now" : "no tour found", on: false },
    { n: 3, t: "Pins only", d: hasTh ? "trailhead pin stored" : "trailhead coordinates not stored", on: !hasLine },
    { n: 4, t: "Link-out cards", d: `${rec.links.filter(l => ["alltrails", "komoot", "wikiloc", "official"].includes(l.kind)).length} links, always shown`, on: true },
  ];
  return (
    <section className="panelbox tr-route">
      <h2 className="pp-h"><Icon name="map" size={15} /> Map and route data</h2>
      <p className={`tr-head ${hasLine ? "" : "warn"}`}>{headline}</p>
      <ol className="tr-chain">
        {steps.map(s => (
          <li key={s.n} className={s.on ? "on" : ""}>
            <span className="num tr-n">{s.n}</span>
            <span><b>{s.t}</b><span className="muted small"> {s.d}</span></span>
            {s.on && s.n !== 4 && <span className="chip act">in use</span>}
          </li>
        ))}
      </ol>
      <p className="muted small">A line is never drawn from a guess. OSM data is ODbL, shown as "(c) OpenStreetMap contributors".</p>
    </section>
  );
}

function Input({ def, value, error, onChange, focus }: { def: FieldDef; value: string; error?: string; onChange: (v: string) => void; focus?: boolean }) {
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  useEffect(() => { if (focus) ref.current?.focus(); }, [focus]);
  const id = `tf-${def.key}`;
  return (
    <div className="tr-in">
      {def.type === "select" ? (
        <select id={id} ref={ref} value={value} aria-invalid={!!error} onChange={e => onChange(e.target.value)} aria-label={def.label}>
          <option value="">not set</option>{def.options!.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <span className="tr-inwrap">
          <input id={id} ref={ref} value={value} inputMode={def.type === "text" || def.type === "url" ? "text" : "decimal"} aria-label={def.label} aria-invalid={!!error}
            placeholder={def.hint || (def.type === "url" ? "https://" : "")} onChange={e => onChange(e.target.value)} />
          {def.unit && <span className="muted small">{def.unit}</span>}
        </span>
      )}
      {error && <span className="tr-err" role="alert">{error}</span>}
    </div>
  );
}

function Value({ def, f }: { def: FieldDef; f: Fact }) {
  if (def.type === "url") return <a href={f.v} target="_blank" rel="noreferrer" className="tr-url">{domainOf(f.v)}</a>;
  return (
    <div className="tr-val">
      <span className="num">{f.v}</span>{def.unit && /^[\d.\-\s]+$/.test(f.v) ? <span className="muted"> {def.unit}</span> : null}
      {def.key === "difficulty" && DIFFICULTY[f.v] && <div className="muted small">{DIFFICULTY[f.v].split(": ")[1]}</div>}
    </div>
  );
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (d: string) => { const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : d; };

function PointCard({ icon, title, p, rows, note, badge, drive }: { icon: string; title: string; p: Point; rows: [string, string | undefined][]; note?: string; badge?: string; drive?: { name: string; p: Point } }) {
  const [copied, setCopied] = useState(false);
  const coords = fmtPoint(p);
  const n = nav(p);
  const dir = drive ? nav(drive.p).directions : n.directions;
  const appleDir = drive ? nav(drive.p).apple : n.apple;
  const chk = checkedLabel(p.point_checked);
  const href = osmUrl(p.point_source);
  const copy = async () => {
    try { await navigator.clipboard.writeText(coords); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { const r = document.createRange(); const el = document.getElementById(`pt-${title}`); if (el) { r.selectNodeContents(el); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); } }
  };
  const shown = rows.filter(r => r[1]);
  return (
    <article className="tr-pt">
      <header><span className="tl-ic"><Icon name={icon} size={15} /></span><b>{title}</b>{badge && <span className="chip act">{badge}</span>}</header>
      {shown.length > 0 && <dl className="tr-pt-dl">{shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      {note && <p className="small muted tr-pt-note">{note}</p>}
      <div className="tr-coord">
        <code id={`pt-${title}`} className="num">{coords}</code>
        <button type="button" className="btn ghost small" onClick={copy} aria-label={`Copy coordinates of ${title}`}><Icon name={copied ? "check" : "list"} size={12} />{copied ? "Copied" : "Copy"}</button>
      </div>
      <div className="tr-src small muted">
        {href ? <a href={href} target="_blank" rel="noreferrer">{sourceLabel(p.point_source)}</a> : <span>{sourceLabel(p.point_source)}</span>}
        <span aria-hidden="true">·</span><span>{chk.who}</span>
        {chk.needsPerson && <><span aria-hidden="true">·</span><span className="chip warn">needs your check</span></>}
      </div>
      <div className="tr-nav">
        <a className="btn primary small" href={n.google} target="_blank" rel="noreferrer"><Icon name="pin" size={13} />Open in Google Maps</a>
        <a className="btn small" href={dir} target="_blank" rel="noreferrer"><Icon name="nav" size={13} />Directions</a>
        <a className="btn small" href={appleDir} target="_blank" rel="noreferrer"><Icon name="map" size={13} />Apple Maps</a>
      </div>
      {drive && <p className="small muted tr-pt-note">You cannot drive here: Directions and Apple Maps go to {drive.name}, the valley lot.</p>}
    </article>
  );
}

/** Trailhead and parking cards with stored points, their source and generated map links. */
export function TrailAccess({ id }: { id: string }) {
  const rec = useTrail(id);
  const t: Trailhead | undefined = rec.trailhead;
  const lots: ParkingLot[] = rec.parking ?? [];
  return (
    <section className="panelbox tr-access" aria-label="Trailhead and parking">
      <div className="tr-bar"><h2 className="pp-h"><Icon name="flag" size={15} /> Trailhead and parking</h2><span className="tr-grow" />
        {lots.length > 0 && <span className="muted small num">{lots.length} lot{lots.length > 1 ? "s" : ""}</span>}</div>
      {t ? <PointCard icon="flag" title={t.name} p={t} note={t.note}
        badge={t.kind === "lift_top" ? "walk starts here (by lift)" : "walk starts here"}
        drive={t.kind === "lift_top" && lots[0] ? { name: lots[0].name, p: lots[0] } : undefined}
        rows={[["Elevation", t.elev_m ? `${t.elev_m} m` : undefined]]} />
        : <div className="tr-gap"><span className="muted">Trailhead point {NOT_YET}</span></div>}
      {lots.length > 0 && <div className="label tr-lots-h">Parking</div>}
      <div className="tr-lots">
        {lots.map(l => <PointCard key={l.name + l.point_source} icon="parking" title={l.name} p={l} note={l.note} rows={[["Fee", l.fee], ["Capacity", l.capacity]]} />)}
      </div>
      {t && lots.length === 0 && <div className="tr-gap"><span className="muted">Parking {NOT_YET}</span></div>}
      <p className="muted small">Points come from OpenStreetMap, never from Google. The map buttons are built from our point and hand it to Google or Apple Maps.</p>
    </section>
  );
}

export function TrailFacts({ id }: { id: string }) {
  const rec = useTrail(id);
  const fade = useFade();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [focusKey, setFocusKey] = useState<string>();
  const [saved, setSaved] = useState(false);

  const begin = (key?: string) => {
    setDraft(Object.fromEntries(FIELDS.map(f => [f.key, rec.facts[f.key]?.v ?? ""])));
    setErrs({}); setFocusKey(key); setEdit(true); setSaved(false);
  };
  const cancel = () => { setEdit(false); setErrs({}); };
  const save = () => {
    const e: Record<string, string> = {};
    for (const f of FIELDS) { const m = validate(f, draft[f.key] ?? ""); if (m) e[f.key] = m; }
    setErrs(e);
    if (Object.keys(e).length) return;
    const changes: Record<string, string> = {};
    for (const f of FIELDS) if ((draft[f.key] ?? "") !== (rec.facts[f.key]?.v ?? "")) changes[f.key] = draft[f.key] ?? "";
    saveFacts(id, changes);
    setEdit(false); setSaved(true);
  };
  const known = FIELDS.filter(f => rec.facts[f.key]).length;

  return (
    <>
    <TrailAccess id={id} />
    <section className="panelbox tr-facts" aria-label="Trail facts">
      <div className="tr-bar">
        <h2 className="pp-h">Trail</h2>
        <span className="muted small num tr-count">{known} of {FIELDS.length} fields filled</span>
        <span className="tr-grow" />
        {saved && !edit && <span className="chip ok"><Icon name="check" size={11} />saved</span>}
        {edit ? (
          <>
            <button className="btn" type="button" onClick={cancel}>Cancel</button>
            <button className="btn primary" type="button" onClick={save}><Icon name="check" size={14} />Save</button>
          </>
        ) : <button className="btn" type="button" onClick={() => begin()}><Icon name="edit" size={14} />Edit facts</button>}
      </div>
      {Object.keys(errs).length > 0 && <div className="chip crit tr-errsum" role="alert"><Icon name="alert" size={12} />Fix {Object.keys(errs).length} field{Object.keys(errs).length > 1 ? "s" : ""} before saving</div>}
      {GROUPS.map(g => (
        <div key={g.key} className={`tr-group g-${g.key}`}>
          <div className="label">{g.title}</div>
          <dl className="tr-grid">
            {FIELDS.filter(f => f.group === g.key).map(def => {
              const f = rec.facts[def.key];
              return (
                <div key={def.key} className={`tr-row ${def.wide ? "wide" : ""} ${errs[def.key] ? "bad" : ""}`}>
                  <dt><label htmlFor={`tf-${def.key}`}>{def.label}</label></dt>
                  <dd>
                    {edit ? (
                      <>
                        <Input def={def} value={draft[def.key] ?? ""} error={errs[def.key]} focus={focusKey === def.key} onChange={v => setDraft(d => ({ ...d, [def.key]: v }))} />
                        {f && !f.you && draft[def.key] !== f.v && <span className="muted small">was {f.v}; your edit replaces the researched value</span>}
                      </>
                    ) : f ? (
                      <>
                        <Value def={def} f={f} />
                        <Provenance f={f} onSend={() => sendFactForReview(id, def.key)} />
                      </>
                    ) : (
                      <span className="tr-gap"><span className="muted">{NOT_YET}</span><button type="button" className="btn ghost small" onClick={() => begin(def.key)} aria-label={`Add ${def.label}`}><Icon name="plus" size={12} />Add</button></span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ))}
      <AnimatePresence>{edit && (
        <motion.p className="muted small tr-note" {...fade}>Your values show "added by you" until a reviewer checks them. In the real app research proposes and review verifies.</motion.p>
      )}</AnimatePresence>
    </section>
    </>
  );
}

export function TrailHazards({ id }: { id: string }) {
  const rec = useTrail(id);
  const fade = useFade();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState<number>();
  return (
    <section className="panelbox">
      <div className="tr-bar"><h2 className="pp-h">Hazards</h2><span className="tr-grow" />
        <button type="button" className="btn ghost small" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name="plus" size={12} />Add</button></div>
      {rec.hazards.length === 0 && <div className="tr-gap"><span className="muted">Hazards {NOT_YET}</span></div>}
      {rec.hazards.map((h, i) => (
        <div key={i} className="pp-haz tr-haz">
          <Icon name="alert" size={14} />
          <div className="tr-grow">
            <div>{h.v}</div><Provenance f={h} onSend={() => sendHazardForReview(id, i)} />
            <AnimatePresence>{ask === i && (
              <motion.div className="tr-confirm" {...fade}>
                <span className="small">Remove this hazard? Your note "{h.v.slice(0, 40)}" is lost.</span>
                <button className="btn small" type="button" onClick={() => { removeHazard(id, i); setAsk(undefined); }}>Remove</button>
                <button className="btn ghost small" type="button" onClick={() => setAsk(undefined)}>Keep</button>
              </motion.div>)}</AnimatePresence>
          </div>
          {h.you && <button type="button" className="btn ghost small" aria-label="Remove hazard" onClick={() => setAsk(i)}><Icon name="x" size={12} /></button>}
        </div>
      ))}
      <AnimatePresence>{open && (
        <motion.form className="tr-add" {...fade} onSubmit={e => { e.preventDefault(); if (!text.trim()) return; addHazard(id, text.trim()); setText(""); setOpen(false); }}>
          <label>What can go wrong<input value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Snowfield above 2,400 m until early July" /></label>
          <div className="tr-btns"><button className="btn primary" type="submit">Add hazard</button><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button></div>
        </motion.form>)}</AnimatePresence>
    </section>
  );
}

const KIND_ICON: Record<LinkKind, string> = {
  official: "shield", alltrails: "map", komoot: "map", wikiloc: "map", outdooractive: "map", gaia: "map", fatmap: "map", osm: "layers", waymarked: "layers", gpx: "list", map_sheet: "map", conditions: "alert",
  weather: "sun", webcam: "search", booking: "ticket", transit: "nav", video: "star", report: "list", other: "link",
};
const KIND_LABEL: Record<string, string> = Object.fromEntries(LINK_KINDS.map(k => [k.kind, k.label]));
const LINK_ONLY = new Set<LinkKind>(["alltrails", "komoot", "wikiloc", "outdooractive", "gaia", "fatmap"]);

function LinkRow({ id, l }: { id: string; l: TrailLink }) {
  const fade = useFade();
  const [ask, setAsk] = useState(false);
  return (
    <li className={`tl ${l.kind === "alltrails" ? "tl-out" : ""}`}>
      <a href={l.url} target="_blank" rel="noreferrer" className="tl-a">
        <span className="tl-ic"><Icon name={KIND_ICON[l.kind]} size={15} /></span>
        <span className="tl-t">
          <b>{l.label}</b>
          <span className="muted small">{KIND_LABEL[l.kind]} · {domainOf(l.url)}</span>
        </span>
        <Icon name="share" size={13} className="tl-ext" />
      </a>
      <div className="tl-meta small muted">
        {l.you ? <><span className="chip act">added by you · today</span>{l.sent ? <span className="chip ok"><Icon name="check" size={11} />sent for review</span> : <button type="button" className="chip glow tr-send" onClick={() => sendLinkForReview(id, l.id)}>Send for review</button>}<span>not checked yet</span></>
          : <><span>checked {l.checked_at}</span>{l.opened === false && <span className="chip warn">found in search, not opened</span>}</>}
        {LINK_ONLY.has(l.kind) && <span className="chip">link only</span>}
        {l.note && <span className="tl-note">{l.note}</span>}
        {l.you && <button type="button" className="btn ghost small" aria-label="Remove link" onClick={() => setAsk(a => !a)}><Icon name="x" size={12} /></button>}
      </div>
      <AnimatePresence>{ask && (
        <motion.div className="tr-confirm" {...fade}>
          <span className="small">Remove "{l.label}"? The link and its note are lost.</span>
          <button className="btn small" type="button" onClick={() => removeLink(id, l.id)}>Remove</button>
          <button className="btn ghost small" type="button" onClick={() => setAsk(false)}>Keep</button>
        </motion.div>)}</AnimatePresence>
    </li>
  );
}

export function TrailLinks({ id }: { id: string }) {
  const rec = useTrail(id);
  const fade = useFade();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<LinkKind>("official");
  const [kindTouched, setKindTouched] = useState(false);
  const [label, setLabel] = useState("");
  const [labelTouched, setLabelTouched] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const onUrl = (v: string) => {
    setUrl(v); setErr("");
    if (!kindTouched) { const k = guessKind(v.trim()); if (k) setKind(k); }
    if (!labelTouched && isHttp(v.trim())) setLabel(domainOf(v.trim()));
  };
  const reset = () => { setUrl(""); setLabel(""); setNote(""); setKind("official"); setKindTouched(false); setLabelTouched(false); setErr(""); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!isHttp(u)) { setErr("Must be a full link starting with http:// or https://"); return; }
    addLink(id, { kind, url: u, label: label.trim() || domainOf(u), note: note.trim() || undefined });
    reset(); setOpen(false);
  };
  const detected = !kindTouched && url && guessKind(url.trim());
  const list = checklist(rec);
  const filled = list.filter(c => c.st.state === "url" || c.st.state === "found_in_search").length;
  const nones = list.filter(c => c.st.state === "searched_none" || c.st.state === "not_checked");

  return (
    <section className="panelbox tr-links">
      <div className="tr-bar">
        <h2 className="pp-h">Links</h2><span className="muted small num">{rec.links.length}</span><span className="tr-grow" />
        <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen(o => !o)}><Icon name={open ? "x" : "plus"} size={14} />{open ? "Close" : "Add a link"}</button>
      </div>
      <AnimatePresence>{open && (
        <motion.form className="tr-add" {...fade} onSubmit={submit} noValidate>
          <label>Link<input type="url" value={url} onChange={e => onUrl(e.target.value)} placeholder="Paste a link: https://" aria-invalid={!!err} autoFocus /></label>
          {err && <span className="tr-err" role="alert">{err}</span>}
          <div className="tr-two">
            <label>Kind<select value={kind} onChange={e => { setKind(e.target.value as LinkKind); setKindTouched(true); }}>
              {LINK_GROUPS.map(g => <optgroup key={g} label={g}>{LINK_KINDS.filter(k => k.group === g).map(k => <option key={k.kind} value={k.kind}>{k.label}</option>)}</optgroup>)}
            </select>{detected && <span className="muted small">detected from the domain</span>}</label>
            <label>Label<input value={label} onChange={e => { setLabel(e.target.value); setLabelTouched(true); }} placeholder="filled from the domain" /></label>
          </div>
          <label>Note (optional)<input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Shows the 2026 reroute" /></label>
          <div className="tr-btns"><button className="btn primary" type="submit"><Icon name="plus" size={14} />Add link</button><button className="btn" type="button" onClick={() => { reset(); setOpen(false); }}>Cancel</button></div>
        </motion.form>)}</AnimatePresence>
      <div className="tl-check" aria-label="Link checklist">
        <div className="label">Checklist · <span className="num">{filled} of {list.length}</span> kinds filled</div>
        <ul className="tl-chips">
          {list.map(c => {
            const st = c.st.state;
            const cls = st === "url" ? "ok" : st === "found_in_search" ? "warn" : st === "searched_none" ? "" : "crit";
            const tip = st === "url" ? "link found and opened" : st === "found_in_search" ? "found in search, not opened" : st === "searched_none" ? "searched, none found" : "not checked yet";
            return <li key={c.kind}><span className={`chip ${cls}`} title={tip}>{st === "url" || st === "found_in_search" ? <Icon name="check" size={11} /> : null}{c.label}<span className="sr-only">: {tip}</span></span></li>;
          })}
        </ul>
      </div>
      {LINK_GROUPS.map(g => {
        const ls = rec.links.filter(l => KIND_GROUP[l.kind] === g);
        if (!ls.length) return null;
        return (
          <div key={g} className="tl-group">
            <div className="label">{g}</div>
            <ul className="tl-list">{ls.map(l => <LinkRow key={l.id} id={id} l={l} />)}</ul>
          </div>
        );
      })}
      {nones.length > 0 && (
        <div className="tl-group">
          <div className="label">Gaps</div>
          <ul className="tl-none">
            {nones.map(c => (
              <li key={c.kind}>
                <b>{c.label}</b>
                {c.st.state === "searched_none"
                  ? <><span className="muted">none found (checked {fmtDate(c.st.date)})</span><span className="muted small tl-q">{[c.st.note, c.st.query ? `searched ${c.st.query}` : ""].filter(Boolean).join(" · ")}</span></>
                  : <span className="crit-text">not checked yet</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted small">AllTrails and the other route platforms are link-out only: no embeds, and their stats, photos and tracks are never copied. AllTrails blocks bots, so those pages are marked "found in search, not opened".</p>
    </section>
  );
}
