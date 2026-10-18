'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiFailure, apiBase, loadProposals, loadSummary, runOp } from './api';
import type { Summary } from './api';
import { ENTITY_LABEL, FIELD_KIND_LABEL, FLAG_LABEL, areaLabel, groupItems, labelOf, lowRisk, provenanceBadges, show, toItems } from './model';
import type { Change, FieldChange, Item, Proposal } from './model';
import './review.css';

// the coverage and backlog tables are heavier than the queue and only open on request
const CoverageView = dynamic(() => import('./CoverageView'), { loading: () => <p className="rv-note">Loading coverage</p> });

type Tab = 'queue' | 'coverage' | 'backlog';

interface UndoStep {
  label: string;
  steps: { proposal: string; ids: string[] }[];
}

const SHORTCUTS: [string, string][] = [
  ['J K', 'next, previous'],
  ['A', 'accept'],
  ['R', 'reject'],
  ['E', 'edit, then accept'],
  ['Shift A', 'accept all low-risk'],
  ['U', 'undo'],
];

export function ProvenanceBadge({ v }: { v: string }) {
  return (
    <span className="pv" data-v={v}>
      <i aria-hidden="true" />
      {v}
    </span>
  );
}

function Value({ v, tone }: { v: unknown; tone?: 'none' }) {
  const text = show(v);
  return <span className={`rv-val${text === 'none' || tone === 'none' ? ' rv-none' : ''}`}>{text}</span>;
}

function DiffRow({ f, op }: { f: FieldChange; op: Change['op'] }) {
  const kind = f.kind;
  const was = op === 'add' ? null : f.before;
  let nowCell: ReactNode;
  if (kind === 'alternative') nowCell = (
    <>
      <Value v={f.incoming} />
      <span className="rv-tag">kept as an alternative; stored value stays</span>
    </>
  );
  else if (kind === 'conflict') nowCell = (
    <>
      <Value v={f.incoming} />
      <span className="rv-tag" data-warn="">same strength, different value</span>
    </>
  );
  else if (kind === 'corroborate') nowCell = <span className="rv-tag">same value, one more source</span>;
  else if (kind === 'gap') nowCell = <span className="rv-tag">not found: {show(f.incoming)}</span>;
  else nowCell = <Value v={f.after} />;
  return (
    <tr data-kind={kind}>
      <th scope="row">
        <span className="rv-field">{labelOf(f.field)}</span>
        <span className="rv-fkind">{FIELD_KIND_LABEL[kind]}</span>
      </th>
      <td data-label="Was" className="rv-was">
        {kind === 'corroborate' || kind === 'gap' ? <Value v={f.before} /> : <Value v={was} />}
      </td>
      <td data-label="Now" className="rv-now">
        {nowCell}
      </td>
    </tr>
  );
}

function Sources({ c }: { c: Change }) {
  return (
    <section className="rv-sources" aria-label="Sources">
      <h4>Sources</h4>
      <ul>
        {c.sources.map((s) => (
          <li key={s.id}>
            <span className="rv-kind" data-kind={s.kind}>{s.kind}</span>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title || s.url}
            </a>
            <span className="rv-pub">{s.publisher}</span>
            <time dateTime={s.read}>read {s.read}</time>
          </li>
        ))}
        {c.sources.length === 0 ? <li className="rv-note">No source recorded.</li> : null}
      </ul>
    </section>
  );
}

function EditForm({ c, onCancel, onSave }: { c: Change; onCancel: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const fields = Object.entries(c.after).filter(([k, v]) => !['id', 'area_id'].includes(k) && (typeof v !== 'object' || v === null || Array.isArray(v)));
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(([k, v]) => [k, Array.isArray(v) ? JSON.stringify(v) : v === null ? '' : String(v)])));
  const save = () => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of fields) {
      const raw = draft[k] ?? '';
      const orig = Array.isArray(v) ? JSON.stringify(v) : v === null ? '' : String(v);
      if (raw === orig) continue;
      if (Array.isArray(v)) {
        try {
          patch[k] = JSON.parse(raw);
        } catch {
          patch[k] = raw.split(',').map((x) => x.trim()).filter(Boolean);
        }
      } else if (typeof v === 'number') patch[k] = raw === '' ? null : Number(raw);
      else if (typeof v === 'boolean') patch[k] = raw === 'true';
      else patch[k] = raw === '' ? null : raw;
    }
    onSave(patch);
  };
  return (
    <form
      className="rv-edit"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p className="rv-note">Change what you disagree with. The change is accepted first, then your edits are saved on top with their own log entry.</p>
      <div className="rv-edit-grid">
        {fields.map(([k]) => (
          <label key={k}>
            <span>{labelOf(k)}</span>
            <input value={draft[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} autoFocus={k === fields[0]?.[0]} />
          </label>
        ))}
      </div>
      <div className="rv-actions">
        <button type="submit" className="btn btn-primary">Accept with edits</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function Card({ it, current, editing, busy, onSelect, onAccept, onReject, onEdit, onCancelEdit, onSaveEdit }: {
  it: Item;
  current: boolean;
  editing: boolean;
  busy: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (patch: Record<string, unknown>) => void;
}) {
  const c = it.change;
  const rows = c.fields.filter((f) => f.field !== 'external');
  const shown = current ? rows : rows.slice(0, 3);
  const bestKind = c.sources[0]?.kind ?? 'none';
  const flags = c.flags.filter((f) => FLAG_LABEL[f]);
  return (
    <article className="rv-card" data-current={current ? '' : undefined} data-change={it.key} data-op={c.op} data-flags={c.flags.join(' ')} aria-current={current ? 'true' : undefined} onClick={onSelect}>
      <header className="rv-card-head">
        <div className="rv-title">
          <span className="rv-entity">{ENTITY_LABEL[c.entity] ?? c.entity}</span>
          <h3>{c.name}</h3>
          <span className="rv-op">{c.op === 'add' ? 'New row' : 'Edit'}</span>
        </div>
        <div className="rv-badges">
          {provenanceBadges(c).map((b) => (
            <ProvenanceBadge key={b} v={b} />
          ))}
          {flags.map((f) => (
            <span key={f} className="rv-flag" data-flag={f}>{FLAG_LABEL[f]}</span>
          ))}
          {c.auto ? <span className="rv-flag" data-flag="auto">Policy allows</span> : null}
        </div>
      </header>
      <p className="rv-reason">{c.reason}</p>
      {c.match && c.match.kind === 'possible' ? (
        <p className="rv-dup">
          Looks like <code>{c.duplicate_of ?? c.id}</code>
          {c.match.similarity !== null ? `, name match ${Math.round(c.match.similarity * 100)} percent` : ''}
          {c.match.distance_m !== null ? `, ${c.match.distance_m} m apart` : ''}.
        </p>
      ) : null}
      {c.question ? <p className="rv-question">{c.question}</p> : null}
      {rows.length > 0 ? (
        <table className="rv-diff">
          <caption className="sr-only">Fields this change touches, before and after</caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Was</th>
              <th scope="col">Now</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <DiffRow key={f.field} f={f} op={c.op} />
            ))}
          </tbody>
        </table>
      ) : null}
      {!current ? (
        <p className="rv-collapsed">
          {rows.length > shown.length ? `${rows.length - shown.length} more field${rows.length - shown.length === 1 ? '' : 's'}; ` : ''}
          {c.sources.length} source{c.sources.length === 1 ? '' : 's'}, best {bestKind}
        </p>
      ) : null}
      <div className="rv-more" aria-hidden={current ? undefined : true}>
        <div>
          {current ? <Sources c={c} /> : null}
          {current && c.warnings.length ? (
            <ul className="rv-warnings">
              {c.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          {current && c.depends_on.length ? <p className="rv-note">Accepting this also accepts {c.depends_on.join(', ')}, which it needs.</p> : null}
          {current && c.excludes.length ? <p className="rv-note">Accepting this replaces {c.excludes.join(', ')}: they are two readings of the same entity.</p> : null}
          {current && c.missing.length ? <p className="rv-note" data-warn="">Missing {c.missing.join(', ')}. Edit it in before accepting, or the catalog will refuse it.</p> : null}
          {current && editing ? (
            <EditForm c={c} onCancel={onCancelEdit} onSave={onSaveEdit} />
          ) : current ? (
            <div className="rv-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onAccept}>
                <kbd>A</kbd> Accept
              </button>
              <button type="button" className="btn" disabled={busy} onClick={onEdit}>
                <kbd>E</kbd> Edit, then accept
              </button>
              <button type="button" className="btn" data-danger="" disabled={busy} onClick={onReject}>
                <kbd>R</kbd> Reject
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function ReviewApp() {
  const [base] = useState(() => (typeof window === 'undefined' ? '' : apiBase(window.location.search)));
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('queue');
  const [area, setArea] = useState<string | null>(null);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo: UndoStep | null } | null>(null);
  const [handled, setHandled] = useState(0);
  const undoRef = useRef<UndoStep | null>(null);

  const reload = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([loadProposals(base), loadSummary(base)]);
      setProposals(p);
      setSummary(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The server did not answer.');
    }
  }, [base]);

  useEffect(() => {
    let live = true;
    Promise.all([loadProposals(base), loadSummary(base)]).then(
      ([p, s]) => {
        if (!live) return;
        setProposals(p);
        setSummary(s);
      },
      (e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : 'The server did not answer.');
      },
    );
    return () => {
      live = false;
    };
  }, [base]);

  const areaNames = useMemo(() => new Map((summary?.coverage ?? []).filter((a) => a.level === 'area').map((a) => [a.area_id, a.name])), [summary]);
  const nameOf = useCallback((id: string | null) => (id ? (areaNames.get(id) ?? areaLabel(id)) : 'No area'), [areaNames]);

  const open = useMemo(() => toItems(proposals ?? []).filter((i) => i.change.status === 'open'), [proposals]);
  const visible = useMemo(() => (area ? open.filter((i) => i.change.area_id === area) : open), [open, area]);
  const groups = useMemo(() => groupItems(visible, nameOf), [visible, nameOf]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const index = flat.findIndex((i) => i.key === currentKey);
  const current = index >= 0 ? flat[index]! : (flat[0] ?? null);
  const low = useMemo(() => flat.filter((i) => lowRisk(i.change)), [flat]);

  const perArea = useMemo(() => {
    const m = new Map<string, { open: number; low: number }>();
    for (const i of open) {
      const k = i.change.area_id ?? '';
      const e = m.get(k) ?? { open: 0, low: 0 };
      e.open++;
      if (lowRisk(i.change)) e.low++;
      m.set(k, e);
    }
    return [...m].sort(([a], [b]) => nameOf(a).localeCompare(nameOf(b)));
  }, [open, nameOf]);

  const say = useCallback((text: string, undo: UndoStep | null) => {
    undoRef.current = undo;
    setToast({ text, undo });
  }, []);

  /** the changes an accept has to carry: the ones this depends on that are still open */
  const withDeps = useCallback(
    (it: Item): string[] => {
      const p = proposals?.find((x) => x.id === it.proposal);
      const open = new Set((p?.changes ?? []).filter((c) => c.status === 'open').map((c) => c.change_id));
      return [...it.change.depends_on.filter((d) => open.has(d)), it.change.change_id];
    },
    [proposals],
  );

  const fail = useCallback(
    (e: unknown) => {
      say(e instanceof ApiFailure || e instanceof Error ? e.message : 'Something went wrong.', null);
    },
    [say],
  );

  const accept = useCallback(
    async (items: Item[], label: string, edits?: Record<string, unknown>) => {
      if (busy || items.length === 0) return;
      setBusy(true);
      try {
        const byProposal = new Map<string, string[]>();
        for (const it of items) byProposal.set(it.proposal, [...new Set([...(byProposal.get(it.proposal) ?? []), ...withDeps(it)])]);
        const done: UndoStep['steps'] = [];
        for (const [proposal, ids] of byProposal) {
          await runOp(base, 'catalog.apply', { proposal_id: proposal, change_ids: ids });
          done.push({ proposal, ids });
        }
        if (edits && Object.keys(edits).length && items[0]) {
          const c = items[0].change;
          await runOp(base, 'catalog.edit', { entity: c.entity, id: c.id, patch: edits, reason: `Reviewer edit while accepting ${c.change_id} of ${items[0].proposal}` });
        }
        setHandled((n) => n + items.length);
        setEditing(false);
        say(label, { label, steps: done });
        await reload();
      } catch (e) {
        fail(e);
        await reload();
      } finally {
        setBusy(false);
      }
    },
    [base, busy, reload, withDeps, say, fail],
  );

  const reject = useCallback(
    async (it: Item) => {
      if (busy) return;
      setBusy(true);
      try {
        await runOp(base, 'catalog.reject', { proposal_id: it.proposal, change_ids: [it.change.change_id] });
        setHandled((n) => n + 1);
        say(`Rejected ${it.change.name}.`, { label: 'reject', steps: [{ proposal: it.proposal, ids: [it.change.change_id] }] });
        await reload();
      } catch (e) {
        fail(e);
      } finally {
        setBusy(false);
      }
    },
    [base, busy, reload, say, fail],
  );

  const undo = useCallback(async () => {
    const u = undoRef.current;
    if (!u || busy) return;
    setBusy(true);
    try {
      for (const s of u.steps) await runOp(base, 'catalog.undo', { proposal_id: s.proposal, change_ids: s.ids });
      setHandled((n) => Math.max(0, n - u.steps.reduce((m, s) => m + s.ids.length, 0)));
      say('Undone. The change is back in the queue.', null);
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }, [base, busy, reload, say, fail]);

  // keyboard: j k a r e u, Shift A for the low-risk batch
  useEffect(() => {
    if (tab !== 'queue') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const move = (d: number) => {
        if (flat.length === 0) return;
        const i = Math.min(flat.length - 1, Math.max(0, (index < 0 ? 0 : index) + d));
        setCurrentKey(flat[i]!.key);
        setEditing(false);
      };
      if (k === 'j' || k === 'arrowdown') move(1);
      else if (k === 'k' || k === 'arrowup') move(-1);
      else if (k === 'a' && e.shiftKey) void accept(low, `Accepted ${low.length} low-risk change${low.length === 1 ? '' : 's'}.`);
      else if (k === 'a' && current) void accept([current], `Accepted ${current.change.name}.`);
      else if (k === 'r' && current) void reject(current);
      else if (k === 'e' && current) setEditing(true);
      else if (k === 'u') void undo();
      else if (k === 'escape') setEditing(false);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, flat, index, current, low, accept, reject, undo]);

  // keep the current card in view when it changes
  const curKey = current?.key;
  useEffect(() => {
    if (!curKey) return;
    const el = document.querySelector<HTMLElement>(`[data-change="${CSS.escape(curKey)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [curKey]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  const total = open.length;
  const backlogCount = summary?.backlog_total ?? 0;

  return (
    <div className="rv">
      <div className="page-head rv-top">
        <h1>Review</h1>
        <p className="lede">
          {proposals === null && !error
            ? 'Reading the proposals on this machine.'
            : total === 0
              ? 'Nothing is waiting.'
              : `${total} change${total === 1 ? '' : 's'} waiting, ${low.length} of them low-risk. Research never lands as verified: accepting a change keeps it proposed until you verify it.`}
        </p>
      </div>

      <div className="rv-bar" role="tablist" aria-label="Review views">
        {(['queue', 'coverage', 'backlog'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} className="rv-tab" onClick={() => setTab(t)}>
            {t === 'queue' ? 'Queue' : t === 'coverage' ? 'Coverage' : 'Backlog'}
            <span className="rv-count">{t === 'queue' ? total : t === 'backlog' ? backlogCount : (summary?.coverage.filter((a) => a.level === 'area').length ?? 0)}</span>
          </button>
        ))}
        <span className="rv-session" aria-live="polite">{handled > 0 ? `${handled} handled this session` : ''}</span>
      </div>

      {error ? (
        <div className="rv-error" role="alert">
          <strong>Cannot load the queue.</strong> {error}
          <button type="button" className="btn" onClick={() => void reload()}>Try again</button>
        </div>
      ) : null}

      {tab === 'queue' ? (
        <div className="rv-body" role="tabpanel" id="panel-queue" aria-labelledby="tab-queue">
          <aside className="rv-rail" aria-label="Pending by area">
            <button type="button" className="rv-area" aria-pressed={area === null} onClick={() => setArea(null)}>
              <span>All areas</span>
              <span className="rv-n">{total}</span>
            </button>
            {perArea.map(([id, e]) => (
              <button key={id} type="button" className="rv-area" aria-pressed={area === id} onClick={() => setArea(area === id ? null : id)}>
                <span>{nameOf(id || null)}</span>
                <span className="rv-n">{e.open}</span>
                <span className="rv-meter" aria-hidden="true">
                  <i style={{ width: `${(e.low / e.open) * 100}%` }} />
                </span>
              </button>
            ))}
            <dl className="rv-keys">
              {SHORTCUTS.map(([k, d]) => (
                <div key={k}>
                  <dt><kbd>{k}</kbd></dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
          </aside>
          <section className="rv-main" aria-label="Changes">
            <div className="rv-tools">
              <button type="button" className="btn btn-primary" disabled={busy || low.length === 0} onClick={() => void accept(low, `Accepted ${low.length} low-risk change${low.length === 1 ? '' : 's'}.`)}>
                <kbd>Shift A</kbd> Accept {low.length} low-risk
              </button>
              <span className="rv-pos num">{flat.length ? `${(index < 0 ? 0 : index) + 1} of ${flat.length}` : ''}</span>
            </div>
            {proposals !== null && flat.length === 0 && !error ? (
              <div className="rv-empty">
                <h2>Nothing to review{area ? ' in this area' : ''}.</h2>
                <p>
                  Proposals appear here after a research run. Make one with <code>node core/bin/catalog.ts propose research/trips/&lt;trip&gt;/&lt;lane&gt;.json</code>.
                </p>
              </div>
            ) : null}
            {groups.map((g) => (
              <section key={g.key} className="rv-group" data-bucket={g.bucket} aria-label={g.label}>
                <h2 className="rv-group-head">
                  {g.label}
                  <span className="rv-count">{g.items.length}</span>
                </h2>
                {g.items.map((it) => (
                  <Card
                    key={it.key}
                    it={it}
                    current={current?.key === it.key}
                    editing={editing && current?.key === it.key}
                    busy={busy}
                    onSelect={() => {
                      setCurrentKey(it.key);
                      if (current?.key !== it.key) setEditing(false);
                    }}
                    onAccept={() => void accept([it], `Accepted ${it.change.name}.`)}
                    onReject={() => void reject(it)}
                    onEdit={() => setEditing(true)}
                    onCancelEdit={() => setEditing(false)}
                    onSaveEdit={(patch) => void accept([it], `Accepted ${it.change.name} with your edits.`, patch)}
                  />
                ))}
              </section>
            ))}
          </section>
        </div>
      ) : (
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {summary ? <CoverageView summary={summary} mode={tab} nameOf={nameOf} /> : <p className="rv-note">Loading.</p>}
        </div>
      )}

      <div className="rv-toast" role="status" aria-live="polite" data-open={toast ? '' : undefined}>
        {toast ? (
          <>
            <span>{toast.text}</span>
            {toast.undo ? (
              <button type="button" className="btn" onClick={() => void undo()}>
                <kbd>U</kbd> Undo
              </button>
            ) : null}
            <button type="button" className="link-btn" onClick={() => setToast(null)}>Dismiss</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
