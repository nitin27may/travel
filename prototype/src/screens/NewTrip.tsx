// S04 New trip intent sheet (five skippable steps, live fit line, express path) and S05 candidates compare.
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { ScreenProps } from ".";
import { PLACES } from "../data/places";
import { useStore } from "../state/store";
import { Avatar } from "../ui/bits";
import { Icon } from "../ui/Icon";
import "./newtrip.css";

const KINDS = ["Vacation", "Weekend", "Day trip", "Road trip", "Camper van", "Family", "Couple · romantic", "Friends", "Solo", "Visiting family", "Multi-generation", "Adventure", "Luxury", "Luxury adventure", "Relax", "Culture", "Food", "Nature"];
const VIBES = ["Relaxing", "Super fun", "Adventure", "Nature and scenic", "Culture", "Food", "Romantic", "Family fun"];
const ACTS = ["Hiking", "Lakes and swimming", "Lifts and viewpoints", "Via ferrata", "Bike", "Huts and food", "Museums", "Photography", "Spa"];
const AVOID = ["Unfenced cliff edges with young kids", "Long drives with no break", "Exposed scrambling", "Crowds at midday"];
const WHERE_SUGG = ["Dolomites", "Val Gardena", "Cortina d'Ampezzo", "Alta Badia", "Lake Garda"];

type When = "dates" | "month" | "weekend" | "unsure";
const STEPS = ["Where", "When", "Who", "Style", "How"] as const;

export function NewTrip({ phone, go }: ScreenProps) {
  const { s, toast } = useStore();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [where, setWhere] = useState("Dolomites");
  const [mode, setMode] = useState<"place" | "unsure" | "surprise">("place");
  const [kinds, setKinds] = useState<string[]>(["Vacation", "Family", "Adventure"]);
  const [when, setWhen] = useState<When>("dates");
  const [start, setStart] = useState("2027-07-13");
  const [end, setEnd] = useState("2027-07-26");
  const [month, setMonth] = useState("2027-07");
  const [nightsRange, setNightsRange] = useState(13);
  const [radius, setRadius] = useState(120);
  const [who, setWho] = useState<string[]>(s.trip.travellers.map(t => t.id));
  const [guests, setGuests] = useState<{ name: string; age: number }[]>([]);
  const [vibes, setVibes] = useState<string[]>(["Nature and scenic", "Family fun"]);
  const [acts, setActs] = useState<string[]>(["Hiking", "Lakes and swimming", "Lifts and viewpoints"]);
  const [avoid, setAvoid] = useState<string[]>([AVOID[0], AVOID[1]]);
  const [pace, setPace] = useState<"Slow" | "Balanced" | "Packed">("Balanced");
  const [walk, setWalk] = useState(12);
  const [gain, setGain] = useState(800);
  const [budget, setBudget] = useState("Mid-range");
  const [transport, setTransport] = useState("Fly + car");
  const [bases, setBases] = useState("Move between bases");
  const dayTrip = kinds.includes("Day trip");
  const nights = when === "dates" ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000)) : nightsRange;

  // live fit line: what the catalog has for this party and these limits
  const fit = useMemo(() => {
    const ages = [...s.trip.travellers.filter(t => who.includes(t.id)).map(t => t.age), ...guests.map(g => g.age)].filter((a): a is number => a !== undefined);
    const youngest = ages.length ? Math.min(...ages) : undefined;
    const pool = PLACES.filter(p => p.kind !== "airport" && p.kind !== "stay" && p.kind !== "town" && p.kind !== "parking");
    const things = pool.filter(p => (p.km ?? 0) <= walk && Math.max(0, p.gain ?? 0) <= gain);
    const kid = youngest !== undefined ? things.filter(p => !p.minAge || p.minAge <= youngest) : things;
    return { all: pool.length, fit: things.length, kid: kid.length, youngest, youngestName: s.trip.travellers.find(t => t.age === youngest)?.name ?? guests.find(g => g.age === youngest)?.name };
  }, [who, guests, walk, gain, s.trip.travellers]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const goStep = (n: number) => { setDir(n > step ? 1 : -1); setStep(Math.max(0, Math.min(STEPS.length - 1, n))); };
  const create = () => { toast(`Created “${mode === "unsure" ? "Fall colours 2027" : where}”: draft trip with ${who.length + guests.length} travellers`); go("plan"); };

  if (mode === "unsure" && step === 0) {
    return <div className="page newtrip"><div className="page-inner nt-inner wide"><Candidates phone={phone} onBack={() => setMode("place")} onChoose={c => { setWhere(c); setMode("place"); goStep(1); toast(`Chose ${c}; the other candidates stay folded under the trip`); }} /></div></div>;
  }

  return (
    <div className="page newtrip">
      <div className="page-inner nt-inner">
        <header className="nt-head">
          <button className="btn ghost" onClick={() => go("home")} aria-label="Close"><Icon name="x" /></button>
          <h1 className="sign page-title">New trip</h1>
          <ol className="nt-progress" aria-label="Steps">
            {STEPS.map((l, i) => (
              <li key={l}><button className={`nt-dot ${i === step ? "on" : ""} ${i < step ? "done" : ""}`} onClick={() => goStep(i)} aria-current={i === step ? "step" : undefined}>
                <span className="num">{i + 1}</span><span className="nt-dot-l">{l}</span></button></li>
            ))}
          </ol>
        </header>
        <div className="nt-sheet panelbox">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir} initial={{ opacity: 0, x: 24 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 * dir }} transition={{ duration: .22, ease: [.2, .8, .2, 1] }} className="nt-step">
              {step === 0 && <>
                <h2 className="nt-q">Where?</h2>
                <label className="nt-field"><Icon name="search" /><input aria-label="Destination" value={where} onChange={e => { setWhere(e.target.value); setMode("place"); }} placeholder="A region, park, town, or country" /></label>
                <div className="chips-row"><span className="muted small">Suggestions:</span>{WHERE_SUGG.filter(w => w !== where).map(w => <button key={w} className="chip" onClick={() => setWhere(w)}>{w}</button>)}</div>
                <div className="radios">
                  <label className="radio"><input type="radio" name="wm" checked={mode === "place"} onChange={() => setMode("place")} /> I know where</label>
                  <label className="radio"><input type="radio" name="wm" checked={false} onChange={() => setMode("unsure")} /> Not sure yet — compare a few places</label>
                  <label className="radio"><input type="radio" name="wm" checked={mode === "surprise"} onChange={() => setMode("surprise")} /> Surprise me within
                    <select value={radius} onChange={e => setRadius(Number(e.target.value))} aria-label="Drive radius">{[60, 120, 180, 300].map(m => <option key={m} value={m}>{m / 60} h</option>)}</select> of Whitby</label>
                </div>
                <h3 className="label">What kind of trip? Pick any</h3>
                <div className="chips-row">{KINDS.map(k => <Toggle key={k} on={kinds.includes(k)} onClick={() => toggle(kinds, setKinds, k)}>{k}</Toggle>)}</div>
                {dayTrip && <p className="hint"><Icon name="clock" size={14} /> Day trip: next you'll pick the day and how far you'll drive each way. No stays, no bookings windows.</p>}
              </>}
              {step === 1 && <>
                <h2 className="nt-q">When?</h2>
                {dayTrip ? <>
                  <label className="nt-row">Which day <input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
                  <Slider label="Drive each way, at most" value={radius} min={30} max={240} step={15} fmt={v => v < 60 ? `${v} min` : `${Math.floor(v / 60)} h${v % 60 ? ` ${v % 60}` : ""}`} onChange={setRadius} />
                </> : <div className="radios">
                  <label className="radio"><input type="radio" name="when" checked={when === "dates"} onChange={() => setWhen("dates")} /> Dates
                    {when === "dates" && <span className="inline"><input type="date" value={start} onChange={e => setStart(e.target.value)} aria-label="Start" /> → <input type="date" value={end} onChange={e => setEnd(e.target.value)} aria-label="End" /> <span className="num chip act">{nights} nights</span></span>}</label>
                  <label className="radio"><input type="radio" name="when" checked={when === "month"} onChange={() => setWhen("month")} /> A month
                    {when === "month" && <span className="inline"><input type="month" value={month} onChange={e => setMonth(e.target.value)} aria-label="Month" /> for <input type="number" min={2} max={30} value={nightsRange} onChange={e => setNightsRange(Number(e.target.value))} aria-label="Nights" className="n3" /> nights</span>}</label>
                  <label className="radio"><input type="radio" name="when" checked={when === "weekend"} onChange={() => setWhen("weekend")} /> A long weekend
                    {when === "weekend" && <select aria-label="Long weekend"><option>Victoria Day · 22-24 May 2027</option><option>Canada Day · 1-4 Jul 2027</option><option>Civic · 31 Jul-2 Aug 2027</option><option>Thanksgiving · 9-11 Oct 2027</option></select>}</label>
                  <label className="radio"><input type="radio" name="when" checked={when === "unsure"} onChange={() => setWhen("unsure")} /> Not sure</label>
                </div>}
                {!dayTrip && <p className="hint"><Icon name="sun" size={14} /> July in the Dolomites: all lifts and high routes open (Fedare chairlift from 13 Jul); peak crowds from 25 Jul. Sunset ~20:59.</p>}
              </>}
              {step === 2 && <>
                <h2 className="nt-q">Who's going?</h2>
                <div className="people">
                  {s.trip.travellers.map(t => {
                    const on = who.includes(t.id);
                    return <button key={t.id} className={`person ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(who, setWho, t.id)}>
                      <Avatar initials={t.initials} tone={on ? "ok" : "muted"} /><span>{t.name}</span>{t.age !== undefined && <span className="num muted">{t.age} in Jul 2027</span>}<Icon name={on ? "check" : "plus"} size={14} />
                    </button>;
                  })}
                  {guests.map((g, i) => <span key={i} className="person on"><Avatar initials={g.name[0]} /><span>{g.name}</span><span className="num muted">{g.age}</span>
                    <button className="btn ghost" aria-label={`Remove ${g.name}`} onClick={() => setGuests(guests.filter((_, k) => k !== i))}><Icon name="x" size={14} /></button></span>)}
                </div>
                <GuestAdd onAdd={g => setGuests([...guests, g])} />
                <p className="hint"><Icon name="shield" size={14} /> Ages stay private to your household; they only decide what fits.</p>
              </>}
              {step === 3 && <>
                <h2 className="nt-q">What's it for?</h2>
                <h3 className="label">Feel</h3>
                <div className="chips-row">{VIBES.map(v => <Toggle key={v} on={vibes.includes(v)} onClick={() => toggle(vibes, setVibes, v)}>{v}</Toggle>)}</div>
                <h3 className="label">Things you like</h3>
                <div className="chips-row">{ACTS.map(v => <Toggle key={v} on={acts.includes(v)} onClick={() => toggle(acts, setActs, v)}>{v}</Toggle>)}</div>
                <h3 className="label">Avoid <span className="muted">· from your household</span></h3>
                <div className="chips-row">{AVOID.map(v => <Toggle key={v} on={avoid.includes(v)} tone="crit" onClick={() => toggle(avoid, setAvoid, v)}>{v}</Toggle>)}</div>
              </>}
              {step === 4 && <>
                <h2 className="nt-q">How?</h2>
                <div className="seg3" role="radiogroup" aria-label="Pace">{(["Slow", "Balanced", "Packed"] as const).map(p => <button key={p} role="radio" aria-checked={pace === p} className={pace === p ? "on" : ""} onClick={() => setPace(p)}>{p}</button>)}</div>
                <Slider label="Walking per day, at most" value={walk} min={2} max={25} step={1} fmt={v => `${v} km`} onChange={setWalk} />
                <Slider label="Climb per day, at most" value={gain} min={100} max={1600} step={50} fmt={v => `${v} m`} onChange={setGain} />
                <div className="nt-grid">
                  <Pick label="Budget" value={budget} set={setBudget} opts={["Budget", "Mid-range", "Comfortable", "Splurge"]} />
                  <Pick label="Getting around" value={transport} set={setTransport} opts={["Car", "Fly + car", "Transit", "Camper van", "Mixed"]} />
                  {!dayTrip && <Pick label="Bases" value={bases} set={setBases} opts={["One base, day trips", "Move between bases", "Decide later"]} />}
                </div>
              </>}
            </motion.div>
          </AnimatePresence>
          <footer className="nt-foot">
            <div className="fitline" aria-live="polite">
              <Icon name="layers" size={14} />
              <span><b className="num">{fit.fit}</b> things in {mode === "surprise" ? `${radius / 60} h of Whitby` : where || "this area"} fit your limits
                {fit.youngest !== undefined && <> · <b className="num">{fit.kid}</b> suit {fit.youngestName} ({fit.youngest})</>} · coverage: <span className="ok-text">good</span></span>
            </div>
            <div className="nt-btns">
              {step > 0 && <button className="btn ghost" onClick={() => goStep(step - 1)}>Back</button>}
              {step >= 1 && step < 4 && <button className="btn" onClick={create}>Just start</button>}
              {step < 4 ? <>
                <button className="btn ghost" onClick={() => goStep(step + 1)}>Skip</button>
                <button className="btn primary" onClick={() => goStep(step + 1)}>Next <Icon name="chevron" size={14} /></button>
              </> : <button className="btn primary" onClick={create}><Icon name="check" size={14} /> Create trip</button>}
            </div>
          </footer>
        </div>
        {!phone && <aside className="nt-summary muted small">
          <span className="label">So far</span>
          <span>{mode === "surprise" ? `Within ${radius / 60} h of Whitby` : where} · {dayTrip ? "day trip" : when === "dates" ? `${nights} nights from ${start}` : when === "month" ? `${month}, ~${nightsRange} nights` : when}</span>
          <span>{who.length + guests.length} people · {pace.toLowerCase()} · ≤ {walk} km, {gain} m</span>
          <span>{kinds.join(", ")}</span>
        </aside>}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, children, tone = "act" }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: "act" | "crit" }) {
  return <button className={`chip tog ${on ? tone : ""}`} aria-pressed={on} onClick={onClick}>{on && <Icon name="check" size={12} />}{children}</button>;
}
function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span className="slider-top"><span>{label}</span><b className="num">{fmt(value)}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ ["--p" as string]: `${((value - min) / (max - min)) * 100}%` }} />
    </label>
  );
}
function Pick({ label, value, set, opts }: { label: string; value: string; set: (v: string) => void; opts: string[] }) {
  return <div className="pick"><span className="label">{label}</span><div className="chips-row">{opts.map(o => <Toggle key={o} on={value === o} onClick={() => set(o)}>{o}</Toggle>)}</div></div>;
}
function GuestAdd({ onAdd }: { onAdd: (g: { name: string; age: number }) => void }) {
  const [name, setName] = useState(""); const [age, setAge] = useState(40);
  return (
    <form className="guest" onSubmit={e => { e.preventDefault(); if (name.trim()) { onAdd({ name: name.trim(), age }); setName(""); } }}>
      <input id="guest-name" placeholder="Add a guest: name" value={name} onChange={e => setName(e.target.value)} aria-label="Guest name" />
      <input id="guest-age" type="number" min={0} max={110} value={age} onChange={e => setAge(Number(e.target.value))} aria-label="Guest age" className="n3" />
      <button className="btn" type="submit"><Icon name="plus" size={14} /> Guest</button>
    </form>
  );
}

// ---------- S05 candidates ----------
interface Cand { id: string; name: string; drive: number; best: string; days: string; cost: number; fit: number; pros: string; cons: string; votes: string[] }
const CANDS: Cand[] = [
  { id: "stowe", name: "Stowe, Vermont", drive: 340, best: "early Oct", days: "3-4", cost: 1400, fit: 46, pros: "Covered bridges, the gondola, Smugglers' Notch", cons: "Leaf-peeper traffic on Route 108", votes: ["t1", "t2"] },
  { id: "whites", name: "White Mountains, NH", drive: 370, best: "early Oct", days: "3-4", cost: 1300, fit: 38, pros: "Kancamagus Highway, Flume Gorge for kids", cons: "Longer drive; lodging books out", votes: ["t3"] },
  { id: "finger", name: "Finger Lakes, NY", drive: 245, best: "mid Oct", days: "3", cost: 1100, fit: 29, pros: "Watkins Glen gorge, short drive", cons: "Colour later and patchier", votes: [] },
  { id: "shen", name: "Shenandoah, VA", drive: 530, best: "mid Oct", days: "2-3", cost: 1200, fit: 22, pros: "Skyline Drive overlooks", cons: "8-9 h each way for 3 days", votes: [] },
];
const hm = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;

function Candidates({ phone, onBack, onChoose }: { phone: boolean; onBack: () => void; onChoose: (name: string) => void }) {
  const { s } = useStore();
  const [rows, setRows] = useState(CANDS);
  const [sort, setSort] = useState<"votes" | "drive" | "cost">("votes");
  const [open, setOpen] = useState<string | undefined>("stowe");
  const sorted = [...rows].sort((a, b) => sort === "votes" ? b.votes.length - a.votes.length : sort === "drive" ? a.drive - b.drive : a.cost - b.cost);
  const vote = (id: string, t: string) => setRows(rs => rs.map(r => r.id !== id ? r : { ...r, votes: r.votes.includes(t) ? r.votes.filter(x => x !== t) : [...r.votes, t] }));
  return (
    <>
      <header className="nt-head">
        <button className="btn ghost" onClick={onBack} aria-label="Back"><Icon name="chevron" className="flip" /></button>
        <h1 className="sign page-title">Fall colours 2027</h1>
        <span className="muted">Choose where · Thanksgiving weekend, from Whitby</span>
      </header>
      <div className="cand-bar">
        <button className="btn"><Icon name="plus" size={14} /> Add a candidate</button>
        <label className="muted small">Sort <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="votes">votes</option><option value="drive">drive time</option><option value="cost">cost</option></select></label>
      </div>
      {!phone ? (
        <table className="cand-table">
          <thead><tr><th>Place</th><th>Drive</th><th>Best</th><th>Days</th><th>Cost</th><th>Fit</th><th>Votes</th><th /></tr></thead>
          <tbody>
            {sorted.map(c => (
              <CandRow key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? undefined : c.id)} onVote={t => vote(c.id, t)} onChoose={() => onChoose(c.name)} travellers={s.trip.travellers} />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="cand-cards">
          {sorted.map(c => (
            <motion.div layout key={c.id} className="panelbox cand-card" transition={{ type: "spring", stiffness: 520, damping: 40 }}>
              <div className="cc-top"><b>{c.name}</b><Votes c={c} travellers={s.trip.travellers} onVote={t => vote(c.id, t)} /></div>
              <div className="num muted small">{hm(c.drive)} drive · {c.days} days · {c.best} · ~${(c.cost / 1000).toFixed(1)}k</div>
              <div className="small"><b className="num">{c.fit}</b> things fit everyone</div>
              <div className="small"><span className="ok-text">+</span> {c.pros}</div>
              <div className="small"><span className="crit-text">−</span> {c.cons}</div>
              <button className="btn primary" onClick={() => onChoose(c.name)}>Choose {c.name.split(",")[0]}</button>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}
function Votes({ c, travellers, onVote }: { c: Cand; travellers: { id: string; initials: string; name: string }[]; onVote: (t: string) => void }) {
  return <span className="votes">{travellers.map(t => <button key={t.id} className={`vote ${c.votes.includes(t.id) ? "on" : ""}`} aria-pressed={c.votes.includes(t.id)} aria-label={`${t.name} votes for ${c.name}`} onClick={e => { e.stopPropagation(); onVote(t.id); }}>{t.initials}</button>)}</span>;
}
function CandRow({ c, open, onToggle, onVote, onChoose, travellers }: { c: Cand; open: boolean; onToggle: () => void; onVote: (t: string) => void; onChoose: () => void; travellers: { id: string; initials: string; name: string }[] }) {
  return (
    <>
      <motion.tr layout="position" className={`cand-row ${open ? "open" : ""}`} onClick={onToggle} transition={{ type: "spring", stiffness: 520, damping: 40 }}>
        <td><b>{c.name}</b></td><td className="num">{hm(c.drive)}</td><td>{c.best}</td><td className="num">{c.days}</td><td className="num">${(c.cost / 1000).toFixed(1)}k</td>
        <td><span className="num">{c.fit}</span> <span className="fitbar"><span style={{ width: `${(c.fit / 46) * 100}%` }} /></span></td>
        <td><Votes c={c} travellers={travellers} onVote={onVote} /></td>
        <td><Icon name={open ? "down" : "chevron"} size={14} /></td>
      </motion.tr>
      {open && <tr className="cand-detail"><td colSpan={8}>
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="cand-detail-in">
          <span><span className="ok-text">Pros</span> {c.pros}</span><span><span className="crit-text">Cons</span> {c.cons}</span>
          <button className="btn primary" onClick={onChoose}>Choose {c.name.split(",")[0]}</button>
        </motion.div></td></tr>}
    </>
  );
}
