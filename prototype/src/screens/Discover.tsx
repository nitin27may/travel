// Discover: anyone can search published trips (no account needed) and open one. Published plans have no dates;
// the season says when the plan is true. A month the plan does not cover shows a warning rather than hiding the trip.
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { ScreenProps } from ".";
import { MONTH_SHORT, PUBLIC_TRIPS, setSelectedPublicTrip, type Effort, type PublicTrip } from "../data/public-trips";
import { Icon } from "../ui/Icon";
import "./discover.css";

const TYPES = ["Family", "Hiking", "Road trip", "Camper van", "Weekend", "Fall colours", "Adventure", "Couple"];
const LENGTHS: { id: string; label: string; test: (n: number) => boolean }[] = [
  { id: "any", label: "Any length", test: () => true }, { id: "short", label: "1 to 3 nights", test: n => n <= 3 },
  { id: "week", label: "4 to 8 nights", test: n => n >= 4 && n <= 8 }, { id: "long", label: "9 to 13 nights", test: n => n >= 9 && n <= 13 }, { id: "xl", label: "14+ nights", test: n => n >= 14 },
];
const EFFORTS: Effort[] = ["easy", "moderate", "hard"];
const AGES = [3, 5, 6, 8, 10, 12, 14];

export const searchText = (t: PublicTrip) => [t.title, t.region, t.country, t.summary, t.tripTypes.join(" "), ...t.days.flatMap(d => [d.title, d.base, ...d.stops.map(s => s.name)])].join(" ").toLowerCase();

export function Discover({ phone, go }: ScreenProps) {
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [month, setMonth] = useState(0);
  const [showOut, setShowOut] = useState(false);
  const [len, setLen] = useState("any");
  const [age, setAge] = useState(0);
  const [effort, setEffort] = useState<Effort | "">("");
  const [more, setMore] = useState(false);

  const L = LENGTHS.find(l => l.id === len)!;
  const matched = useMemo(() => PUBLIC_TRIPS.filter(t =>
    (!q || searchText(t).includes(q.toLowerCase().trim())) &&
    (!types.length || types.every(x => t.tripTypes.includes(x))) &&
    L.test(t.nights) && (!age || t.ageFit <= age) && (!effort || t.effort === effort),
  ), [q, types, L, age, effort]);
  const inSeason = (t: PublicTrip) => !month || t.season.months.includes(month);
  const shown = matched.filter(t => showOut || inSeason(t));
  const hiddenOut = matched.length - matched.filter(inSeason).length;
  const reset = () => { setQ(""); setTypes([]); setMonth(0); setLen("any"); setAge(0); setEffort(""); setShowOut(false); };
  const open = (t: PublicTrip) => { setSelectedPublicTrip(t.id); go("publictrip"); };
  const filtered = !!(q || types.length || month || len !== "any" || age || effort);

  return (
    <div className="page discover">
      <div className="page-inner">
        <header className="dc-head">
          <div>
            <h1 className="sign page-title">Discover</h1>
            <p className="muted dc-lede">Published trips from other families. Open one to read every day. No account needed.</p>
          </div>
          <span className="chip dc-public"><Icon name="link" size={12} /> Public</span>
        </header>

        <section className="dc-filters panelbox" aria-label="Search and filters">
          <label className="dc-search"><Icon name="search" size={18} /><span className="sr">Search published trips</span>
            <input type="search" placeholder="Search a place, region or trail: Tre Cime, Jasper, Reykjavik" value={q} onChange={e => setQ(e.target.value)} />
          </label>

          <div className="dc-block">
            <span className="label" id="dc-when">When do you want to go?</span>
            <div className="dc-months" role="group" aria-labelledby="dc-when">
              {MONTH_SHORT.slice(1).map((m, i) => (
                <button key={m} className={`chip ${month === i + 1 ? "act" : ""}`} aria-pressed={month === i + 1} onClick={() => setMonth(month === i + 1 ? 0 : i + 1)}>{m}</button>
              ))}
            </div>
            <AnimatePresence initial={false}>
              {month > 0 && (
                <motion.label className="dc-check" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: .18 }}>
                  <input type="checkbox" checked={showOut} onChange={e => setShowOut(e.target.checked)} /> Show out-of-season trips with a warning{hiddenOut ? ` (${hiddenOut} hidden)` : ""}
                </motion.label>
              )}
            </AnimatePresence>
          </div>

          <div className="dc-block">
            <span className="label" id="dc-type">Trip type</span>
            <div className="dc-chips" role="group" aria-labelledby="dc-type">
              {TYPES.map(x => <button key={x} className={`chip ${types.includes(x) ? "act" : ""}`} aria-pressed={types.includes(x)} onClick={() => setTypes(types.includes(x) ? types.filter(y => y !== x) : [...types, x])}>{x}</button>)}
            </div>
          </div>

          <button className="dc-more btn ghost" aria-expanded={more} onClick={() => setMore(m => !m)}><Icon name={more ? "down" : "chevron"} size={14} /> Length, children, effort</button>
          <AnimatePresence initial={false}>
            {more && (
              <motion.div className="dc-extra" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .2 }} style={{ overflow: "hidden" }}>
                <div className="dc-extra-in">
                  <label className="dc-field"><span className="label">Length</span>
                    <select value={len} onChange={e => setLen(e.target.value)}>{LENGTHS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
                  </label>
                  <label className="dc-field"><span className="label">Travelling with a child of</span>
                    <select value={age} onChange={e => setAge(Number(e.target.value))}><option value={0}>No child or any age</option>{AGES.map(a => <option key={a} value={a}>{a} years old</option>)}</select>
                  </label>
                  <div className="dc-field"><span className="label" id="dc-eff">Effort</span>
                    <div className="dc-chips" role="group" aria-labelledby="dc-eff">
                      {EFFORTS.map(e => <button key={e} className={`chip ${effort === e ? "act" : ""}`} aria-pressed={effort === e} onClick={() => setEffort(effort === e ? "" : e)}>{e[0].toUpperCase() + e.slice(1)}</button>)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <div className="dc-count muted num" aria-live="polite">{shown.length} of {PUBLIC_TRIPS.length} published trips{filtered ? <> · <button className="linkish" onClick={reset}>Clear filters</button></> : null}</div>

        {shown.length > 0 ? (
          <motion.div layout className={`dc-grid ${phone ? "one" : ""}`}>
            <AnimatePresence initial={false}>
              {shown.map(t => <DCard key={t.id} t={t} month={month} age={age} onOpen={() => open(t)} />)}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div className="dc-empty panelbox" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Icon name="compass" size={22} />
            <div>
              <strong>Nothing matches all of that.</strong>
              <p className="muted">{hiddenOut && !showOut ? `${hiddenOut} trip${hiddenOut > 1 ? "s" : ""} fit your other filters but run in a different season.` : "Try fewer filters, or search for a country instead of a trail."}</p>
              <div className="dc-empty-actions">
                {hiddenOut > 0 && !showOut && <button className="btn primary" onClick={() => setShowOut(true)}>Show out-of-season trips</button>}
                {month > 0 && <button className="btn" onClick={() => setMonth(0)}>Any month</button>}
                <button className="btn" onClick={reset}>Clear all filters</button>
                <button className="btn" onClick={() => go("new")}>Plan from scratch</button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function DCard({ t, month, age, onOpen }: { t: PublicTrip; month: number; age: number; onOpen: () => void }) {
  const out = month > 0 && !t.season.months.includes(month);
  return (
    <motion.button layout="position" className={`dc-card ${out ? "out" : ""}`} onClick={onOpen} aria-label={`${t.title}, ${t.season.label}`}
      initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 520, damping: 40 }}>
      <div className={`dc-hero tone-${t.tone}`} aria-hidden="true">
        <span className="chip dc-nights num">{t.nights} nights</span>
        {out && <span className="chip warn"><Icon name="alert" size={12} /> Out of season for {MONTH_SHORT[month]}</span>}
        {month > 0 && !out && <span className="chip ok dc-ok"><Icon name="check" size={12} /> In season</span>}
      </div>
      <div className="dc-body">
        <div className="dc-title">{t.title}</div>
        <div className="dc-meta muted">{t.region} · {t.country}</div>
        <div className="dc-season"><Icon name="cal" size={14} /> {t.season.label}</div>
        <div className="dc-fits">
          <span className="chip">{t.group}</span>
          <span className={`chip ${age && t.ageFit <= age ? "ok" : ""}`}>Age {t.ageFit}+</span>
          <span className={`chip ${t.effort === "hard" ? "warn" : ""}`}>{t.effort[0].toUpperCase() + t.effort.slice(1)}</span>
        </div>
        <div className="dc-foot muted"><span>by {t.by}</span><span className="num">Copied {t.copies} times</span></div>
      </div>
    </motion.button>
  );
}
