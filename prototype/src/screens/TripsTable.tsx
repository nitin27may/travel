// Trips as a data grid: sortable columns, one search box over every column, and an inline advanced filter panel.
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { ScreenProps } from ".";
import { PHASE_LABEL, type Phase, type TripCard } from "../data/trips";
import { Icon } from "../ui/Icon";
import { fmtDate } from "./tripsutil";

type Col = "title" | "phase" | "start" | "nights" | "region" | "kind" | "plan" | "book" | "next";
const COLS: { id: Col; label: string; num?: boolean }[] = [
  { id: "title", label: "Trip" }, { id: "phase", label: "Status" }, { id: "start", label: "Start" }, { id: "nights", label: "Nights", num: true },
  { id: "region", label: "Region" }, { id: "kind", label: "Trip type" }, { id: "plan", label: "Plan %", num: true }, { id: "book", label: "Book %", num: true }, { id: "next", label: "Next action" },
];
const PHASE_ORDER: Phase[] = ["idea", "plan", "book", "prepare", "go", "done"];
const val = (t: TripCard, c: Col): string | number => {
  switch (c) {
    case "title": return t.title.toLowerCase();
    case "phase": return PHASE_ORDER.indexOf(t.phase);
    case "start": return t.start ?? "9999";
    case "nights": return t.nights ?? -1;
    case "region": return t.region.toLowerCase();
    case "kind": return t.kind.toLowerCase();
    case "plan": return t.ready[0];
    case "book": return t.ready[1];
    case "next": return (t.next ?? "").toLowerCase();
  }
};
const tags = (kind: string) => kind.split(" · ").map(k => k[0].toUpperCase() + k.slice(1));
const pct = (n: number) => Math.round(n * 100);
const haystack = (t: TripCard) => [t.title, PHASE_LABEL[t.phase], t.start ?? "", t.start ? fmtDate(t.start, { day: "numeric", month: "long", year: "numeric" }) : "", String(t.nights ?? ""), t.region, t.kind, `${pct(t.ready[0])}`, `${pct(t.ready[1])}`, t.next ?? ""].join(" ").toLowerCase();

interface Adv { phases: Phase[]; kinds: string[]; from: string; to: string; minN: string; maxN: string; region: string; done: boolean }
const NO_ADV: Adv = { phases: [], kinds: [], from: "", to: "", minN: "", maxN: "", region: "", done: false };

export function TripsTable({ trips, phone, go }: { trips: TripCard[]; phone: boolean; go: ScreenProps["go"] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [adv, setAdv] = useState<Adv>(NO_ADV);
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "start", dir: 1 });
  const kinds = useMemo(() => [...new Set(trips.flatMap(t => tags(t.kind)))].sort(), [trips]);
  const set = <K extends keyof Adv>(k: K, v: Adv[K]) => setAdv(a => ({ ...a, [k]: v }));
  const toggle = <T,>(arr: T[], v: T) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  const active = [adv.phases.length, adv.kinds.length, adv.from || adv.to, adv.minN || adv.maxN, adv.region, adv.done].filter(Boolean).length;

  const eligible = trips.filter(t => adv.done || t.phase !== "done");
  const rows = eligible.filter(t =>
    (!q || haystack(t).includes(q.toLowerCase().trim())) &&
    (!adv.phases.length || adv.phases.includes(t.phase)) && (!adv.kinds.length || tags(t.kind).some(k => adv.kinds.includes(k))) &&
    (!adv.from || (t.start ?? "") >= adv.from) && (!adv.to || (!!t.start && t.start <= adv.to)) &&
    (!adv.minN || (t.nights ?? -1) >= Number(adv.minN)) && (!adv.maxN || (t.nights ?? 99) <= Number(adv.maxN)) &&
    (!adv.region || t.region.toLowerCase().includes(adv.region.toLowerCase())),
  ).sort((a, b) => {
    const x = val(a, sort.col), y = val(b, sort.col);
    const c = x < y ? -1 : x > y ? 1 : 0;
    return (c || a.title.localeCompare(b.title)) * sort.dir;
  });
  const clickSort = (col: Col) => setSort(s => s.col === col ? { col, dir: (s.dir * -1) as 1 | -1 } : { col, dir: 1 });
  const clear = () => { setAdv(NO_ADV); setQ(""); };

  return (
    <div className="ttable">
      <div className="tt-tools">
        <label className="tt-search"><Icon name="search" size={16} /><span className="sr">Search trips</span>
          <input type="search" placeholder="Search any column" value={q} onChange={e => setQ(e.target.value)} />
        </label>
        <button className={`btn ${open ? "on" : ""}`} aria-expanded={open} aria-controls="tt-adv" onClick={() => setOpen(o => !o)}>
          <Icon name="layers" size={14} /> Advanced{active ? <span className="chip glow tt-n">{active}</span> : null}
        </button>
        <span className="muted num tt-count" aria-live="polite">{rows.length} of {eligible.length} trips{!adv.done && trips.length > eligible.length ? ` · ${trips.length - eligible.length} done hidden` : ""}</span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id="tt-adv" className="tt-adv panelbox" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .22 }} style={{ overflow: "hidden" }}>
            <div className="tt-adv-grid">
              <fieldset><legend className="label">Status</legend>
                <div className="tt-chips">{(["idea", "plan", "book", "prepare", "go", "done"] as Phase[]).map(p => <button key={p} className={`chip ${adv.phases.includes(p) ? "act" : ""}`} aria-pressed={adv.phases.includes(p)} onClick={() => set("phases", toggle(adv.phases, p))}>{PHASE_LABEL[p]}</button>)}</div>
              </fieldset>
              <fieldset><legend className="label">Trip type</legend>
                <div className="tt-chips">{kinds.map(k => <button key={k} className={`chip ${adv.kinds.includes(k) ? "act" : ""}`} aria-pressed={adv.kinds.includes(k)} onClick={() => set("kinds", toggle(adv.kinds, k))}>{k}</button>)}</div>
              </fieldset>
              <fieldset><legend className="label">Start date</legend>
                <div className="tt-pair"><input type="date" aria-label="Start from" value={adv.from} onChange={e => set("from", e.target.value)} /><span className="muted">to</span><input type="date" aria-label="Start to" value={adv.to} onChange={e => set("to", e.target.value)} /></div>
              </fieldset>
              <fieldset><legend className="label">Nights</legend>
                <div className="tt-pair"><input type="number" min={0} inputMode="numeric" placeholder="Min" aria-label="Minimum nights" value={adv.minN} onChange={e => set("minN", e.target.value)} /><span className="muted">to</span><input type="number" min={0} inputMode="numeric" placeholder="Max" aria-label="Maximum nights" value={adv.maxN} onChange={e => set("maxN", e.target.value)} /></div>
              </fieldset>
              <fieldset><legend className="label">Region contains</legend>
                <input type="text" placeholder="Italy, Alberta, Ontario" aria-label="Region contains" value={adv.region} onChange={e => set("region", e.target.value)} />
              </fieldset>
              <fieldset><legend className="label">Done trips</legend>
                <label className="tt-check"><input type="checkbox" checked={adv.done} onChange={e => set("done", e.target.checked)} /> Include done trips</label>
              </fieldset>
            </div>
            <div className="tt-adv-foot"><button className="btn ghost" onClick={clear}><Icon name="undo" size={14} /> Clear all</button></div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`tt-scroll ${phone ? "phone" : ""}`} role="region" aria-label="Trips table" tabIndex={0}>
        <table className="tt">
          <thead><tr>
            {COLS.map(c => {
              const on = sort.col === c.id;
              return (
                <th key={c.id} scope="col" className={`${c.num ? "r" : ""} ${on ? "sorted" : ""}`} aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button onClick={() => clickSort(c.id)}>{c.label}<span className="tt-arrow" aria-hidden="true">{on ? (sort.dir === 1 ? "↑" : "↓") : ""}</span></button>
                </th>
              );
            })}
          </tr></thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id} className={t.phase === "done" ? "done" : ""}>
                <td className="tt-title"><button onClick={() => go("plan", t.id)}>{t.title}</button></td>
                <td><span className="chip">{PHASE_LABEL[t.phase]}</span></td>
                <td className="num nowrap">{t.start ? fmtDate(t.start, { day: "numeric", month: "short", year: "numeric" }) : <span className="muted">Open</span>}</td>
                <td className="num r">{t.nights ?? <span className="muted">-</span>}</td>
                <td className="nowrap">{t.region}</td>
                <td className="nowrap">{t.kind}</td>
                <td className="r"><Meter v={t.ready[0]} /></td>
                <td className="r"><Meter v={t.ready[1]} /></td>
                <td className="tt-next">{t.next ?? <span className="muted">Nothing pending</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="tt-empty"><p className="muted">No trips match.</p><button className="btn" onClick={clear}>Clear search and filters</button></div>}
      </div>
    </div>
  );
}

function Meter({ v }: { v: number }) {
  return <span className="tt-meter num"><span className="tt-bar" aria-hidden="true"><span style={{ width: `${pct(v)}%` }} /></span>{pct(v)}%</span>;
}
