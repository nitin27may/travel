// S24/S25 admin: review queue (changeset diffs with evidence, decide per change, undo), coverage by area,
// research jobs with spend. Sample data for the prototype.
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ScreenProps } from ".";
import { Icon } from "../ui/Icon";
import "./admin.css";

type Decision = "accepted" | "rejected" | "edited";
interface Diff { field: string; old?: string; next: string }
interface Change { id: string; op: "create" | "update"; target: string; kind: string; diffs: Diff[]; source: string; sourceKind: "official" | "operator" | "community" | "agent inferred"; read: string; quote: string }
interface Changeset { id: string; title: string; author: string; client: string; job?: string; when: string; changes: Change[] }

const QUEUE: Changeset[] = [
  { id: "cs-41", title: "El Chaltén trails", author: "Claude", client: "MCP · Claude", job: "job-17", when: "today 09:12", changes: [
    { id: "c1", op: "create", target: "Laguna de los Tres", kind: "trail", source: "Parque Nacional Los Glaciares, trail guide", sourceKind: "official", read: "18 Oct 2026", quote: "Round trip from El Chaltén, last kilometre steep and loose.",
      diffs: [{ field: "distance_km", next: "21" }, { field: "gain_m", next: "1,000" }, { field: "time", next: "8-10 h" }, { field: "trailhead", next: "El Chaltén, north end of San Martín" }] },
    { id: "c2", op: "create", target: "Laguna Torre", kind: "trail", source: "Parque Nacional Los Glaciares, trail guide", sourceKind: "official", read: "18 Oct 2026", quote: "Gentle valley walk to the glacier lake below Cerro Torre.",
      diffs: [{ field: "distance_km", next: "18" }, { field: "gain_m", next: "300" }, { field: "time", next: "6-7 h" }] },
    { id: "c3", op: "update", target: "Mirador de los Cóndores", kind: "viewpoint", source: "Trip report, 2025", sourceKind: "community", read: "Mar 2025", quote: "Best at sunrise; 45 minutes from the visitor centre.",
      diffs: [{ field: "best_light", old: "—", next: "sunrise" }, { field: "time", old: "1 h", next: "45 min each way" }] },
    { id: "c4", op: "create", target: "El Pilar trailhead parking", kind: "parking", source: "Model inference from a map", sourceKind: "agent inferred", read: "18 Oct 2026", quote: "Small gravel lot by Hostería El Pilar.",
      diffs: [{ field: "capacity", next: "about 15 cars" }, { field: "fee", next: "free" }] },
  ] },
  { id: "cs-40", title: "Sorapis parking fills earlier", author: "Nitin", client: "Web · owner edit", when: "yesterday 21:40", changes: [
    { id: "c5", op: "update", target: "Passo Tre Croci roadside lot", kind: "parking", source: "Two dated reports, Jul 2026", sourceKind: "community", read: "Jul 2026", quote: "Full by 06:10 on a Saturday; full by 06:25 on a Tuesday.",
      diffs: [{ field: "fills_by", old: "07:00", next: "06:00-06:30 in July" }] },
  ] },
  { id: "cs-39", title: "Lake Louise price refresh", author: "Claude", client: "MCP · Claude Code", job: "job-16", when: "16 Oct", changes: [
    { id: "c6", op: "update", target: "Moraine Lake shuttle", kind: "offer", source: "Parks Canada reservation page", sourceKind: "official", read: "16 Oct 2026", quote: "Sample figure for the prototype.",
      diffs: [{ field: "price_read_on", old: "Mar 2026", next: "Oct 2026" }, { field: "window", old: "spring release", next: "release date not yet announced for 2027" }] },
  ] },
];
const COVERAGE = [
  { area: "Banff", region: "Alberta", kinds: { trails: 62, sights: 48, stays: 16, food: 4, adventure: 43 }, fresh: 0.71 },
  { area: "Lake Louise", region: "Alberta", kinds: { trails: 21, sights: 12, stays: 6, food: 2, adventure: 9 }, fresh: 0.64 },
  { area: "Dolomites", region: "South Tyrol / Veneto", kinds: { trails: 14, sights: 9, stays: 4, food: 2, adventure: 6 }, fresh: 0.88 },
  { area: "El Chaltén", region: "Santa Cruz", kinds: { trails: 3, sights: 2, stays: 0, food: 0, adventure: 1 }, fresh: 1 },
];
const score = (n: number) => (n >= 15 ? "good" : n >= 5 ? "usable" : "thin");
const JOBS = [
  { id: "job-17", title: "El Chaltén: trails lane", runner: "Chat client via MCP", lanes: "trails, parking", status: "waiting for review", changes: 4, spent: 0, budget: 0, note: "Runs on the user's own model; costs us nothing" },
  { id: "job-16", title: "Lake Louise: price refresh", runner: "Claude Code (owner)", lanes: "fares and costs", status: "waiting for review", changes: 2, spent: 0.84, budget: 3 },
  { id: "job-15", title: "Dolomites: conditions check", runner: "Worker (rules)", lanes: "conditions", status: "done", changes: 0, spent: 0, budget: 0 },
  { id: "job-14", title: "Banff: trails import from OSM", runner: "Importer", lanes: "geometry, trailheads", status: "done", changes: 62, spent: 0, budget: 0 },
];

export function Admin({ phone }: ScreenProps) {
  const [tab, setTab] = useState<"queue" | "coverage" | "jobs">("queue");
  const [open, setOpen] = useState(QUEUE[0].id);
  const [dec, setDec] = useState<Record<string, Decision>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string>();
  const [last, setLast] = useState<{ ids: string[]; prev: Record<string, Decision> } | null>(null);
  const cs = QUEUE.find(c => c.id === open)!;
  const decide = (ids: string[], d: Decision) => { setLast({ ids, prev: dec }); setDec(x => ({ ...x, ...Object.fromEntries(ids.map(i => [i, d])) })); };
  const undo = () => { if (last) { setDec(last.prev); setLast(null); } };
  const pendingIn = (c: Changeset) => c.changes.filter(x => !dec[x.id]).length;

  return (
    <div className="page adm">
      <div className="page-inner">
        <header className="adm-head">
          <h1 className="sign page-title">Review</h1>
          <span className="chip">Sample data for the prototype</span>
          <div className="adm-tabs" role="tablist">
            {(["queue", "coverage", "jobs"] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={`adm-tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
              {t === "queue" ? <>Queue <span className="num">{QUEUE.reduce((a, c) => a + pendingIn(c), 0)}</span></> : t === "coverage" ? "Coverage" : "Research jobs"}</button>)}
          </div>
        </header>

        {tab === "queue" && (
          <div className={`adm-queue ${phone ? "one" : ""}`}>
            <ul className="adm-list">
              {QUEUE.map(c => (
                <li key={c.id}><button className={`adm-cs ${open === c.id ? "on" : ""}`} onClick={() => setOpen(c.id)}>
                  <span className="adm-cs-title">{c.title}</span>
                  <span className="muted small">{c.author} · {c.client} · {c.when}</span>
                  <span className="adm-cs-count num">{pendingIn(c) ? `${pendingIn(c)} to review` : "done"}</span>
                </button></li>
              ))}
            </ul>
            <section className="adm-detail">
              <header className="adm-detail-head">
                <div><div className="label">{cs.job ? `Research job ${cs.job}` : "Owner edit"}</div><h2 className="adm-h">{cs.title}</h2>
                  <div className="muted small">{cs.changes.length} change{cs.changes.length > 1 ? "s" : ""} by {cs.author} through {cs.client}</div></div>
                <div className="adm-bulk">
                  <button className="btn" onClick={() => decide(cs.changes.filter(c => c.sourceKind === "official" && !dec[c.id]).map(c => c.id), "accepted")}>Accept all with official sources</button>
                  {last && <button className="btn ghost" onClick={undo}><Icon name="undo" />Undo</button>}
                </div>
              </header>
              <AnimatePresence initial={false}>
                {cs.changes.map(c => {
                  const d = dec[c.id];
                  return (
                    <motion.article key={c.id} layout className={`adm-change ${d ?? ""}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 520, damping: 40 }}>
                      <header className="adm-change-head">
                        <span className={`chip ${c.op === "create" ? "act" : ""}`}>{c.op === "create" ? "new" : "update"}</span>
                        <b>{c.target}</b><span className="muted small">{c.kind}</span>
                        {d && <span className={`chip ${d === "rejected" ? "crit" : "ok"} adm-dec`}>{d}</span>}
                      </header>
                      <table className="adm-diff">
                        <tbody>{c.diffs.map(x => (
                          <tr key={x.field}><td className="muted num">{x.field}</td>
                            <td>{x.old && <del className="adm-old">{x.old}</del>}{x.old && <span className="muted"> → </span>}
                              {editing === `${c.id}:${x.field}` ? <input autoFocus className="adm-edit" defaultValue={edits[`${c.id}:${x.field}`] ?? x.next}
                                onBlur={e => { setEdits(m => ({ ...m, [`${c.id}:${x.field}`]: e.target.value })); setEditing(undefined); decide([c.id], "edited"); }} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                                : <ins className="adm-new">{edits[`${c.id}:${x.field}`] ?? x.next}</ins>}</td>
                            <td>{!d && <button className="btn ghost small" onClick={() => setEditing(`${c.id}:${x.field}`)} aria-label={`Edit ${x.field}`}><Icon name="edit" size={13} /></button>}</td></tr>
                        ))}</tbody>
                      </table>
                      <div className="adm-ev">
                        <span className={`chip src-${c.sourceKind.replace(" ", "-")}`}>{c.sourceKind}</span>
                        <span className="small">{c.source}, read {c.read}</span>
                        <q className="muted small">{c.quote}</q>
                        {c.sourceKind === "agent inferred" && <span className="small warn-text">Agent-inferred values stay unverified until a source is found.</span>}
                      </div>
                      <footer className="adm-actions">
                        {d ? <button className="btn ghost small" onClick={() => setDec(x => { const y = { ...x }; delete y[c.id]; return y; })}><Icon name="undo" size={13} />Undo</button> : <>
                          <button className="btn primary small" onClick={() => decide([c.id], "accepted")}><Icon name="check" size={13} />Accept</button>
                          <button className="btn small" onClick={() => setEditing(`${c.id}:${c.diffs[0].field}`)}><Icon name="edit" size={13} />Edit then accept</button>
                          <button className="btn ghost small danger" onClick={() => decide([c.id], "rejected")}><Icon name="x" size={13} />Reject</button></>}
                      </footer>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </section>
          </div>
        )}

        {tab === "coverage" && (
          <section className="panelbox adm-cov">
            <div className="adm-cov-legend small"><span className="chip crit">thin &lt; 5</span><span className="chip warn">usable 5-14</span><span className="chip ok">good 15+</span><span className="muted">per kind, published entities</span></div>
            <div className="adm-scroll">
              <table className="adm-covtable">
                <thead><tr><th>Area</th>{["trails", "sights", "stays", "food", "adventure"].map(k => <th key={k}>{k}</th>)}<th>fresh</th><th /></tr></thead>
                <tbody>{COVERAGE.map(a => (
                  <tr key={a.area}><td><b>{a.area}</b><div className="muted small">{a.region}</div></td>
                    {Object.entries(a.kinds).map(([k, n]) => <td key={k}><span className={`chip num cov-${score(n)}`}>{n} · {score(n)}</span></td>)}
                    <td className="num"><span className="adm-bar"><span style={{ width: `${a.fresh * 100}%` }} /></span>{Math.round(a.fresh * 100)}%</td>
                    <td><button className="btn small">Research gaps</button></td></tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "jobs" && (
          <section className="adm-jobs">
            {JOBS.map(j => (
              <article key={j.id} className="panelbox adm-job">
                <div><div className="label">{j.id} · {j.runner}</div><b>{j.title}</b><div className="muted small">Lanes: {j.lanes} · {j.changes} change{j.changes === 1 ? "" : "s"}</div>{j.note && <div className="muted small">{j.note}</div>}</div>
                <span className={`chip ${j.status === "done" ? "ok" : "warn"}`}>{j.status}</span>
                <div className="adm-spend num">{j.budget ? <><span className="adm-bar"><span style={{ width: `${(j.spent / j.budget) * 100}%` }} /></span>US${j.spent.toFixed(2)} of ${j.budget}</> : <span className="muted">no spend</span>}</div>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
