// S18 Templates: gallery, then the adapt flow (when, who, keep) and a change list to review before
// anything is created. Changes are computed from item priority, the month, daylight and the party.
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { ScreenProps } from ".";
import { sunFor } from "../../../core/src/sun/index.ts";
import { useStore } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import "./templates.css";

type Pri = "must" | "should" | "nice";
interface TItem { name: string; pri: Pri; minAge?: number; season?: Partial<Record<number, string>>; lane?: "A" | "B" }
interface TDay { n: number; base: string; items: TItem[] }
interface Template {
  id: string; title: string; nights: number; months: number[]; best: string; party: string; type: string[]; tone: string;
  curated: boolean; travelled: boolean; blurb: string; minNights: number; days?: TDay[]; lat: number; lng: number; zone: string; refDate: string;
}

const ROCKIES_DAYS: TDay[] = [
  { n: 1, base: "Banff", items: [{ name: "Calgary airport to Banff", pri: "must" }, { name: "Vermilion Lakes sunset", pri: "nice" }] },
  { n: 2, base: "Banff", items: [{ name: "Johnston Canyon", pri: "must" }, { name: "Mount Norquay via ferrata", pri: "should", minAge: 12, lane: "A" }, { name: "Banff Gondola", pri: "should", lane: "B" }] },
  { n: 3, base: "Lake Louise", items: [{ name: "Lake Agnes teahouse", pri: "must" }, { name: "Fairview Lookout", pri: "nice" }] },
  { n: 4, base: "Jasper", items: [{ name: "Peyto Lake", pri: "must", season: { 6: "Bow Summit lot may still have snow in early June" } }, { name: "Athabasca Glacier", pri: "should" }] },
  { n: 5, base: "Jasper", items: [{ name: "Maligne Canyon", pri: "should" }, { name: "Maligne Lake cruise to Spirit Island", pri: "must", season: { 10: "Cruise ends early October: swap for the Mary Schäffer loop" } }] },
  { n: 6, base: "Jasper", items: [{ name: "Edith Cavell meadows", pri: "should", season: { 6: "Road opens mid-June; meadows trail often snow-bound" } }] },
  { n: 7, base: "Jasper", items: [{ name: "Jasper SkyTram", pri: "nice" }, { name: "Spare day", pri: "nice" }] },
  { n: 8, base: "Lake Louise", items: [{ name: "Mistaya Canyon", pri: "nice" }, { name: "Icefields Parkway south", pri: "must" }] },
  { n: 9, base: "Lake Louise", items: [{ name: "Moraine Lake sunrise", pri: "must", season: { 10: "Moraine Lake road closes ~13 Oct" } }, { name: "Larch Valley", pri: "should", season: { 6: "Snow on the pass into July: swap for Consolation Lakes", 7: "No gold larches in July (peak ~20 Sep): still a fine green hike", 8: "No gold larches in August (peak ~20 Sep): still a fine green hike" } }] },
  { n: 10, base: "Lake Louise", items: [{ name: "Lake O'Hara (lottery)", pri: "should", season: { 10: "Lake O'Hara bus ends early October" } }] },
  { n: 11, base: "Lake Louise", items: [{ name: "Emerald Lake", pri: "should" }, { name: "Takakkaw Falls", pri: "should", season: { 10: "Yoho Valley Road closes in October" } }] },
  { n: 12, base: "Kananaskis", items: [{ name: "Ha Ling Peak", pri: "should", minAge: 8 }, { name: "Troll Falls", pri: "nice" }] },
  { n: 13, base: "Kananaskis", items: [{ name: "Kananaskis Nordic Spa", pri: "nice", minAge: 18 }] },
  { n: 14, base: "Kananaskis", items: [{ name: "To Calgary airport", pri: "must" }] },
];

const TEMPLATES: Template[] = [
  { id: "rockies", title: "Canadian Rockies, 14 nights", nights: 14, months: [8, 9], best: "Sep 8-22", party: "2 adults + child 6", type: ["Family", "Hiking"], tone: "lake", curated: true, travelled: false, blurb: "Five bases, three tracks every day: adults' hike, family, less walking.", minNights: 8, days: ROCKIES_DAYS, lat: 51.4254, lng: -116.1773, zone: "America/Edmonton", refDate: "2029-09-16" },
  { id: "dolomites", title: "Dolomites, 13 nights", nights: 13, months: [7, 8], best: "mid-Jul to Aug", party: "2 adults + child 10", type: ["Family", "Hiking"], tone: "relief", curated: true, travelled: false, blurb: "Three valley bases; Braies, Tre Cime, Seceda; beginner via ferrata at Cinque Torri.", minNights: 7, lat: 46.57, lng: 11.67, zone: "Europe/Rome", refDate: "2027-07-20" },
  { id: "iceland", title: "Iceland Ring Road by camper", nights: 11, months: [9], best: "Sep 4-22", party: "adults", type: ["Camper van", "Road trip"], tone: "ice", curated: true, travelled: false, blurb: "Counter-clockwise with Snæfellsnes; campsites only; aurora window.", minNights: 9, lat: 64.14, lng: -21.94, zone: "Atlantic/Reykjavik", refDate: "2027-09-08" },
  { id: "utah", title: "Utah's five parks", nights: 10, months: [4, 5, 9], best: "Apr-May, Sep", party: "family", type: ["Family", "Road trip"], tone: "steppe", curated: true, travelled: false, blurb: "Springdale, Bryce, Torrey, Moab; every leg paved. Narrows before 1 Oct.", minNights: 7, lat: 37.2, lng: -112.98, zone: "America/Denver", refDate: "2027-05-10" },
  { id: "patagonia", title: "Patagonia with kids 11+", nights: 13, months: [2, 3], best: "late Feb - mid Mar", party: "adults + 11+", type: ["Family", "Adventure"], tone: "steppe", curated: true, travelled: false, blurb: "Ushuaia, El Chaltén, El Calafate; minitrekking on Perito Moreno (8-65).", minNights: 10, lat: -49.33, lng: -72.89, zone: "America/Argentina/Rio_Gallegos", refDate: "2027-03-02" },
  { id: "algonquin", title: "Algonquin colour weekend", nights: 2, months: [9, 10], best: "late Sep - early Oct", party: "family", type: ["Weekend", "Fall colours"], tone: "forest", curated: true, travelled: true, blurb: "Track and Tower ledge at 08:00, Ragged Falls, Dorset tower. Day permit 5 days ahead.", minNights: 2, lat: 45.58, lng: -78.5, zone: "America/Toronto", refDate: "2026-10-11" },
  { id: "vermont", title: "Vermont foliage, 3 nights", nights: 3, months: [9, 10], best: "early Oct", party: "family", type: ["Weekend", "Fall colours"], tone: "forest", curated: true, travelled: true, blurb: "Hyde Park base; Smugglers' Notch, Stowe, covered bridges.", minNights: 2, lat: 44.6, lng: -72.6, zone: "America/New_York", refDate: "2026-10-02" },
  { id: "norway", title: "Norway, Arctic first", nights: 14, months: [6, 7, 8], best: "24 Jun - 8 Jul", party: "family 12+", type: ["Road trip"], tone: "lake", curated: true, travelled: false, blurb: "Lofoten, Senja, then the fjords; midnight sun; 12 km hiking ceiling.", minNights: 10, lat: 68.2, lng: 13.6, zone: "Europe/Oslo", refDate: "2028-06-28" },
];
const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const W: Record<Pri, number> = { must: 5, should: 2, nice: 1 };

export function Templates({ phone, go }: ScreenProps) {
  const [q, setQ] = useState("");
  const [month, setMonth] = useState(0);
  const [type, setType] = useState("Any");
  const [len, setLen] = useState("Any");
  const [open, setOpen] = useState<Template | undefined>();
  const types = ["Any", "Family", "Hiking", "Road trip", "Camper van", "Weekend", "Fall colours", "Adventure"];
  const list = TEMPLATES.filter(t =>
    (!q || t.title.toLowerCase().includes(q.toLowerCase()) || t.blurb.toLowerCase().includes(q.toLowerCase())) &&
    (!month || t.months.includes(month)) && (type === "Any" || t.type.includes(type)) &&
    (len === "Any" || (len === "Weekend" ? t.nights <= 3 : len === "Week" ? t.nights > 3 && t.nights <= 9 : t.nights > 9)));
  return (
    <div className="page templates">
      <div className="page-inner">
        <header className="tp-head">
          <h1 className="sign page-title">Templates</h1>
          <span className="muted small">Shared with family and friends · curated from planned and travelled trips</span>
        </header>
        <div className="tp-filters">
          <label className="tp-search"><Icon name="search" /><input id="tp-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates" aria-label="Search templates" /></label>
          <select aria-label="Month" value={month} onChange={e => setMonth(Number(e.target.value))}><option value={0}>Any month</option>{MONTHS.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
          <select aria-label="Length" value={len} onChange={e => setLen(e.target.value)}>{["Any", "Weekend", "Week", "Two weeks"].map(x => <option key={x}>{x}</option>)}</select>
          <div className="chips-row">{types.map(t => <button key={t} className={`chip ${type === t ? "act" : ""}`} aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>)}</div>
        </div>
        <motion.div layout className="tp-grid">
          <AnimatePresence initial={false}>
            {list.map(t => (
              <motion.button layout key={t.id} className="tp-card" onClick={() => setOpen(t)} initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .97 }} transition={{ type: "spring", stiffness: 520, damping: 40 }}>
                <div className={`tc-hero tone-${t.tone}`} aria-hidden="true">
                  {t.curated && <span className="chip tc-phase"><Icon name="check" size={12} /> curated</span>}
                  <span className={`chip tp-trav ${t.travelled ? "ok" : ""}`}>{t.travelled ? "travelled" : "not travelled yet"}</span>
                </div>
                <div className="tc-body">
                  <div className="tc-title">{t.title}</div>
                  <div className="tc-meta muted">{t.party} · {t.type.join(", ")}</div>
                  <p className="tp-blurb">{t.blurb}</p>
                  <div className="tp-fits"><Icon name="cal" size={14} /> Fits {t.best} · {t.nights} nights</div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
          {list.length === 0 && <p className="muted">No templates match. <button className="linkish" onClick={() => { setQ(""); setMonth(0); setType("Any"); setLen("Any"); }}>Clear filters</button></p>}
        </motion.div>
      </div>
      <AnimatePresence>{open && <Adapt key={open.id} t={open} phone={phone} onClose={() => setOpen(undefined)} go={go} />}</AnimatePresence>
    </div>
  );
}

interface Change { id: string; kind: "Length" | "Daylight" | "Season" | "Party" | "Bookings"; text: string; why: string; day?: number }

function Adapt({ t, phone, onClose, go }: { t: Template; phone: boolean; onClose: () => void; go: ScreenProps["go"] }) {
  const { s, toast } = useStore();
  const [start, setStart] = useState(t.id === "rockies" ? "2027-06-26" : t.refDate);
  const [nights, setNights] = useState(t.id === "rockies" ? 10 : t.nights);
  const [who, setWho] = useState(s.trip.travellers.map(x => x.id));
  const [mode, setMode] = useState<"adapt" | "copy">("adapt");
  const [stage, setStage] = useState<"setup" | "changes">("setup");
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const month = Number(start.slice(5, 7));
  const ages = s.trip.travellers.filter(x => who.includes(x.id)).map(x => x.age).filter((a): a is number => a !== undefined);
  const youngest = ages.length ? Math.min(...ages) : undefined;

  const changes: Change[] = useMemo(() => {
    const out: Change[] = [];
    if (mode === "copy") return out;
    const days = t.days;
    // length: drop the lowest-priority days first, never a "must"
    if (days && nights < t.nights) {
      const drop = [...days].filter(d => !d.items.some(i => i.pri === "must")).sort((a, b) => a.items.reduce((x, i) => x + W[i.pri], 0) - b.items.reduce((x, i) => x + W[i.pri], 0)).slice(0, t.nights - nights);
      for (const d of drop.sort((a, b) => a.n - b.n)) out.push({ id: `len-${d.n}`, kind: "Length", day: d.n, text: `Drop day ${d.n} (${d.base}): ${d.items.map(i => i.name).join(", ")}`, why: `lowest priority: ${d.items.map(i => i.pri).join(" + ")}` });
      const left = days.filter(d => !drop.includes(d));
      for (const b of new Set(days.map(d => d.base))) {
        const was = days.filter(d => d.base === b).length, now = left.filter(d => d.base === b).length;
        if (now === 0) out.push({ id: `base-${b}`, kind: "Length", text: `Drop the ${b} base entirely (${was} night${was > 1 ? "s" : ""})`, why: "all its days were lowest priority" });
        else if (now < was) out.push({ id: `base-${b}`, kind: "Length", text: `${b}: ${was} → ${now} night${now > 1 ? "s" : ""}`, why: "fewer days based there" });
      }
    } else if (nights > t.nights) out.push({ id: "len-add", kind: "Length", text: `${nights - t.nights} extra day${nights - t.nights > 1 ? "s" : ""} added as free days at the busiest base`, why: "the template has no more items; add from the catalog later" });
    if (nights < t.minNights) out.push({ id: "len-min", kind: "Length", text: `Below the template's minimum of ${t.minNights} nights: whole regions are dropped`, why: `suggested length: ${t.minNights}+` });
    // daylight: compare sunrise and sunset at the main area with the template's reference date
    const ref = sunFor(t.lat, t.lng, t.refDate, t.zone), now = sunFor(t.lat, t.lng, start, t.zone);
    if (ref && now) {
      const toMin = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
      const dSet = toMin(now.sunset) - toMin(ref.sunset), dRise = toMin(now.sunrise) - toMin(ref.sunrise);
      if (Math.abs(dSet) >= 10) out.push({ id: "sun-set", kind: "Daylight", text: `Sunset ${now.sunset} instead of ${ref.sunset} (${dSet > 0 ? "+" : "−"}${Math.abs(dSet)} min)`, why: dSet > 0 ? "longer evenings: late hikes and sunset stops gain room" : "shorter evenings: afternoon hikes start earlier" });
      if (Math.abs(dRise) >= 10 && t.id === "rockies") out.push({ id: "sun-rise", kind: "Daylight", day: 9, text: `Moraine Lake sunrise at ${now.sunrise} (template ${ref.sunrise}): leave the base ${dRise < 0 ? "earlier" : "later"}`, why: "the shuttle or start time moves with sunrise" });
    }
    // season: items whose note depends on the new month
    for (const d of days ?? []) for (const i of d.items) { const note = i.season?.[month]; if (note) out.push({ id: `sea-${d.n}-${i.name}`, kind: "Season", day: d.n, text: `${i.name}: ${note}`, why: `${MONTHS[month]} instead of ${t.best}` }); }
    if (!t.months.includes(month)) out.push({ id: "sea-out", kind: "Season", text: `Out of the template's season (${t.best})`, why: "checks will flag more closures after creating" });
    // party: age limits against the youngest traveller
    if (youngest !== undefined) for (const d of days ?? []) for (const i of d.items) if (i.minAge && youngest < i.minAge) {
      const kid = s.trip.travellers.find(x => x.age === youngest)?.name ?? "the youngest";
      out.push({ id: `party-${d.n}-${i.name}`, kind: "Party", day: d.n, text: `${i.name} needs ${i.minAge}+; ${kid} is ${youngest}: ${i.lane === "A" ? "adults only, " + kid + " joins Track B" : "moved to adults only"}`, why: "age limit from the operator" });
    }
    // bookings recomputed for the new dates
    if (t.id === "rockies") {
      const y = Number(start.slice(0, 4));
      out.push({ id: "bk-ohara", kind: "Bookings", day: 10, text: `Lake O'Hara lottery: apply 1-28 Feb ${y}; reminder set`, why: "window recomputed from the new dates" });
      out.push({ id: "bk-moraine", kind: "Bookings", day: 9, text: "Moraine Lake shuttle: seats release in spring and ~48 h before; two reminders set", why: "booking window" });
      out.push({ id: "bk-stays", kind: "Bookings", text: `Jasper stays: book by January ${y} for ${MONTHS[month]}`, why: "high-demand base" });
    }
    return out;
  }, [t, nights, start, who, mode, month, youngest, s.trip.travellers]);

  const kept = changes.filter(c => !skip.has(c.id));
  const groups = (["Length", "Daylight", "Season", "Party", "Bookings"] as const).map(k => [k, changes.filter(c => c.kind === k)] as const).filter(([, cs]) => cs.length);
  const create = () => { toast(`Created “${t.title.split(",")[0]}” for ${start}, ${nights} nights · ${kept.length} changes applied`); go("plan"); };

  return (
    <motion.div className="tp-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className={`tp-sheet ${phone ? "phone" : ""}`} role="dialog" aria-modal="true" aria-label={`Use ${t.title}`} onClick={e => e.stopPropagation()}
        initial={phone ? { y: 40, opacity: 0 } : { x: 40, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} exit={phone ? { y: 40, opacity: 0 } : { x: 40, opacity: 0 }} transition={{ duration: .24, ease: [.2, .8, .2, 1] }}>
        <header className="tp-sheet-head">
          <div><div className="label">Use template</div><h2 className="tp-sheet-title">{t.title}</h2><div className="muted small">Best for {t.best} · {t.party} · min {t.minNights} nights</div></div>
          <button className="btn ghost" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <AnimatePresence mode="wait" initial={false}>
          {stage === "setup" ? (
            <motion.div key="setup" className="tp-setup" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: .2 }}>
              <section><span className="label">1 · When</span>
                <div className="tp-when"><input type="date" value={start} onChange={e => setStart(e.target.value)} aria-label="Start date" />
                  <label className="tp-nights"><input type="range" min={2} max={Math.max(16, t.nights + 2)} value={nights} onChange={e => setNights(Number(e.target.value))} aria-label="Nights" style={{ ["--p" as string]: `${((nights - 2) / (Math.max(16, t.nights + 2) - 2)) * 100}%` }} />
                    <span className="num"><b>{nights}</b> nights <span className="muted">(template {t.nights})</span></span></label></div>
              </section>
              <section><span className="label">2 · Who</span>
                <div className="tp-who">{s.trip.travellers.map(x => <button key={x.id} className={`person ${who.includes(x.id) ? "on" : ""}`} aria-pressed={who.includes(x.id)} onClick={() => setWho(w => w.includes(x.id) ? w.filter(y => y !== x.id) : [...w, x.id])}>
                  <Avatar initials={x.initials} tone={who.includes(x.id) ? "ok" : "muted"} />{x.name}{x.age !== undefined && <span className="num muted">{x.age}</span>}</button>)}
                  <span className="muted small">template: {t.party}</span></div>
              </section>
              <section><span className="label">3 · Keep</span>
                <div className="radios">
                  <label className="radio"><input type="radio" name="km" checked={mode === "adapt"} onChange={() => setMode("adapt")} /> Adapt for me <span className="muted small">length, daylight, season, party, bookings</span></label>
                  <label className="radio"><input type="radio" name="km" checked={mode === "copy"} onChange={() => setMode("copy")} /> Copy exactly <span className="muted small">only dates shift; checks warn afterwards</span></label>
                </div>
              </section>
              {!t.days && mode === "adapt" && <p className="muted small">Item priorities are not set on this template yet, so only daylight, season and bookings adapt.</p>}
              <div className="tp-foot">
                <span className="muted small num">{changes.length} change{changes.length === 1 ? "" : "s"} to review</span>
                <button className="btn primary" onClick={() => setStage("changes")}>See changes <Icon name="chevron" size={14} /></button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="changes" className="tp-changes" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: .2 }}>
              <div className="tp-ch-head">
                <span><b>What will change</b> <span className="num muted">{kept.length} of {changes.length} kept</span></span>
                <button className="btn" onClick={() => setSkip(new Set())}>Accept all</button>
              </div>
              {changes.length === 0 && <p className="muted">Nothing changes: dates shift, every item is copied as it is.</p>}
              {groups.map(([k, cs]) => (
                <section key={k} className="tp-group">
                  <span className="label"><Icon name={k === "Length" ? "cal" : k === "Daylight" ? "sunset" : k === "Season" ? "flag" : k === "Party" ? "users" : "ticket"} size={12} /> {k}</span>
                  <ul>
                    {cs.map(c => {
                      const off = skip.has(c.id);
                      return (
                        <motion.li layout key={c.id} className={`tp-change ${off ? "off" : ""}`} transition={{ type: "spring", stiffness: 520, damping: 40 }}>
                          <div className="tp-ch-text"><span>{c.text}</span><small className="muted">{c.why}{c.day ? ` · day ${c.day}` : ""}</small></div>
                          <div className="tp-ch-tog" role="group" aria-label={`Change: ${c.text}`}>
                            <button className={!off ? "on" : ""} aria-pressed={!off} onClick={() => setSkip(s2 => { const n = new Set(s2); n.delete(c.id); return n; })}><Icon name="check" size={13} /> Keep</button>
                            <button className={off ? "on" : ""} aria-pressed={off} onClick={() => setSkip(s2 => new Set(s2).add(c.id))}><Icon name="x" size={13} /> Skip</button>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              <div className="tp-foot">
                <button className="btn ghost" onClick={() => setStage("setup")}>Back</button>
                <button className="btn primary" onClick={create}><Icon name="check" size={14} /> Create my trip</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
