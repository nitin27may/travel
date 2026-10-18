// The Plan screen: outline · plan document · live map (desktop), or day pager + map sheet (phone).
// Drag state is kept locally while dragging so legs, totals and the map preview update before the drop.
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, pointerWithin, useDroppable, useSensor, useSensors, type CollisionDetection,
  type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent, type Announcements, type Modifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PLACES, type Place } from "../data/places";
import { dayDate, fmtDay, type Trip } from "../data/trip";
import { km, fmtMin } from "../lib/geo";
import { MapView, dayColour, type Pin } from "../map/MapView";
import { planDay, useStore, type Target } from "../state/store";
import { Icon } from "../ui/Icon";
import { DaySection } from "./DaySection";
import { KindGlyph } from "./ItemCard";
import { ListSection } from "./ListSection";
import { Outline } from "./Outline";
import { PlacePanel } from "./PlacePanel";
import { BottomSheet } from "../ui/BottomSheet";
import { PlaceSearch } from "./PlaceSearch";
import { DropCtx, type DropMark } from "./drop";

type Containers = Record<string, string[]>;
// what is under the pointer wins (small outline rows); otherwise the nearest container by corners
const collide: CollisionDetection = args => { const hit = pointerWithin(args); return hit.length ? hit : closestCorners(args); };
// the drag preview is a compact pill held just left of the pointer, so the insertion line stays visible
const besidePointer: Modifier = ({ activatorEvent, draggingNodeRect, overlayNodeRect, transform }) => {
  if (!activatorEvent || !draggingNodeRect || !overlayNodeRect || !("clientX" in activatorEvent)) return transform;
  const ev = activatorEvent as PointerEvent;
  const px = ev.clientX + transform.x;                       // pointer x now
  const left = px - overlayNodeRect.width + 8 >= 8;          // room on the left; otherwise flip to the right
  return { ...transform, x: transform.x + ev.clientX - draggingNodeRect.left + (left ? -overlayNodeRect.width + 8 : 18), y: transform.y + ev.clientY - draggingNodeRect.top - overlayNodeRect.height / 2 };
};
const toTarget = (key: string): Target => key.startsWith("day:") ? { day: Number(key.slice(4)) } : { list: key.slice(5) };

export function PlanScreen({ theme, phone, onOpenPlace, onShare, switcher }: { theme: "light" | "dark"; phone: boolean; onOpenPlace: (p: Place) => void; onShare: () => void; switcher?: React.ReactNode }) {
  const st = useStore();
  const { s, place, select, focus, showDay, move, add, movePin } = st;
  const fromStore = useCallback((t: Trip): Containers => ({
    ...Object.fromEntries(t.lists.map(l => [`list:${l.id}`, l.itemIds])),
    ...Object.fromEntries(t.days.map(d => [`day:${d.n}`, d.itemIds])),
  }), []);
  const containers = useMemo(() => fromStore(s.trip), [s.trip, fromStore]);
  const [activeId, setActiveId] = useState<string>();
  const [drop, setDrop] = useState<{ key: string; at: number } | null>(null);
  const [hint, setHint] = useState(() => { try { return localStorage.getItem("proto.dndHint") !== "off"; } catch { return true; } });
  const [pinDrag, setPinDrag] = useState<{ id: string; lng: number; lat: number } | null>(null);
  const [addHere, setAddHere] = useState<{ lng: number; lat: number; x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [fit, setFit] = useState(0);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [peek, setPeek] = useState<Place | undefined>();
  const docRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef(0);

  const placeLive = useCallback((id: string) => {
    const p = place(id); return p && pinDrag && pinDrag.id === id ? { ...p, lng: pinDrag.lng, lat: pinDrag.lat } : p;
  }, [place, pinDrag]);
  const liveTrip: Trip = s.trip;
  const plans = useMemo(() => s.trip.days.map(d => planDay(s.trip, d.n, placeLive)), [s.trip, placeLive]);

  // ---------- drag and drop ----------
  // Only the handle starts a drag (mouse, pen and touch alike). Nothing in the page moves while dragging:
  // the landing spot is an insertion line, the move is applied once on drop, and Undo reverses it.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const firstList = s.trip.lists[0]?.id;
  const findKey = (id?: string | number | null): string | undefined => {
    if (id == null) return; const k = String(id);
    if (k === "shelf") return firstList ? `list:${firstList}` : undefined;
    if (k.startsWith("ol-day:")) return `day:${k.slice(7)}`;
    if (k.startsWith("ol-list:")) return `list:${k.slice(8)}`;
    if (k in containers) return k;
    return Object.keys(containers).find(c => containers[c].includes(k));
  };
  const origin = activeId ? findKey(activeId) : undefined;
  const originIdx = activeId && origin ? containers[origin].indexOf(activeId) : -1;
  const isNoop = (d: { key: string; at: number } | null) => !d || (d.key === origin && (d.at === originIdx || d.at === originIdx + 1));
  function onStart(e: DragStartEvent) {
    setActiveId(String(e.active.id)); setDrop(null);
    try { navigator.vibrate?.(8); } catch { /* not supported */ }
  }
  function track(e: DragMoveEvent | DragOverEvent) {
    const overId = e.over?.id; const key = findKey(overId);
    if (!overId || !key) { setDrop(d => (d ? null : d)); return; }
    const ids = containers[key]; const idx = ids.indexOf(String(overId));
    let at = ids.length;
    if (idx >= 0) {
      const r = e.over!.rect, me = e.active.rect.current.translated;
      const y = me ? me.top + me.height / 2 : r.top;
      at = y > r.top + r.height / 2 ? idx + 1 : idx;
    }
    setDrop(d => (d && d.key === key && d.at === at ? d : { key, at }));
  }
  function onEnd(e: DragEndEvent) {
    const id = String(e.active.id); const d = drop;
    setActiveId(undefined); setDrop(null);
    if (!d || isNoop(d)) return;
    const index = d.key === origin && d.at > originIdx ? d.at - 1 : d.at;
    move(id, toTarget(d.key), index);
    if (String(e.over?.id ?? "").startsWith("ol-")) setTimeout(() => jump(d.key.startsWith("day:") ? `day-${d.key.slice(4)}` : `list-${d.key.slice(5)}`), 60);
  }
  const labelFor = (id: string) => { const k = findKey(id); return k ? (k.startsWith("day:") ? `Day ${k.slice(4)}` : s.trip.lists.find(l => `list:${l.id}` === k)?.name ?? "") : ""; };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${place(s.trip.items[String(active.id)]?.placeId)?.name}.`,
    onDragOver: ({ over }) => over ? `Over ${labelFor(String(over.id))}.` : "Not over a day or list.",
    onDragEnd: ({ over }) => over ? `Dropped in ${labelFor(String(over.id))}.` : "Dropped back where it was.",
    onDragCancel: () => "Move cancelled.",
  };

  // where the line goes: before the item now at that slot, or after the last one; none when it would not move
  const mark: DropMark | null = useMemo(() => {
    if (!activeId || !drop || isNoop(drop)) return drop && activeId ? { key: drop.key } : null;
    const ids = containers[drop.key];
    if (!ids.length) return { key: drop.key };
    return drop.at < ids.length ? { key: drop.key, id: ids[drop.at], edge: "before" } : { key: drop.key, id: ids[ids.length - 1], edge: "after" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, drop, containers]);

  // prediction for the overlay chip and the dashed map leg, computed on a copy; the page itself does not change
  const dragPlace = activeId ? place(s.trip.items[activeId]?.placeId) : undefined;
  let predicted: { day: number; delta: number; where: string } | undefined;
  let preview: { from: Place; to: Place; back?: Place } | null = null;
  const dragTo = drop?.key;
  if (activeId && drop && dragPlace && !isNoop(drop)) {
    const ids = containers[drop.key].filter(x => x !== activeId);
    const index = drop.key === origin && drop.at > originIdx ? drop.at - 1 : drop.at;
    ids.splice(index, 0, activeId);
    const where = drop.key.startsWith("day:") ? `Day ${drop.key.slice(4)}` : s.trip.lists.find(l => `list:${l.id}` === drop.key)?.name ?? "";
    if (drop.key.startsWith("day:")) {
      const n = Number(drop.key.slice(4));
      const strip = (t: Trip) => ({ ...t, days: t.days.map(d => ({ ...d, itemIds: d.itemIds.filter(x => x !== activeId) })), lists: t.lists.map(l => ({ ...l, itemIds: l.itemIds.filter(x => x !== activeId) })) });
      const hyp = strip(s.trip); hyp.days = hyp.days.map(d => d.n === n ? { ...d, itemIds: ids } : d);
      const live = planDay(hyp, n, place), was = plans.find(p => p.n === n)!;
      predicted = { day: n, delta: live.driveMin - was.driveMin, where };
      const k = ids.indexOf(activeId);
      const prevP = k > 0 ? place(s.trip.items[ids[k - 1]].placeId) : live.start;
      const nextP = k < ids.length - 1 ? place(s.trip.items[ids[k + 1]].placeId) : live.end;
      if (prevP) preview = { from: prevP, to: dragPlace, back: nextP };
    } else predicted = { day: 0, delta: 0, where };
  }

  // while dragging over another day, bring that day onto the map so the dashed preview leg is visible
  useEffect(() => {
    if (!activeId || !dragTo?.startsWith("day:")) return;
    const n = Number(dragTo.slice(4)); if (n === s.focusDay) return;
    const h = setTimeout(() => focus(n), 280); return () => clearTimeout(h);
  }, [activeId, dragTo, s.focusDay, focus]);

  // ---------- focus, scroll spy, map ----------
  const jump = (id: string) => {
    const el = document.getElementById(id); if (!el) return;
    scrolling.current = Date.now();
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if (id.startsWith("day-")) showDay(Number(id.slice(4)));
    if (id === "shelf") setShelfOpen(true);
  };
  useEffect(() => {
    const root = docRef.current; if (!root || phone) return;
    const io = new IntersectionObserver(entries => {
      if (Date.now() - scrolling.current < 900 || activeId) return;
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) { const n = Number((vis.target as HTMLElement).dataset.day); if (n && n !== s.focusDay) focus(n); }
    }, { root, rootMargin: "-15% 0px -70% 0px" });
    root.querySelectorAll("section.day").forEach(x => io.observe(x));
    return () => io.disconnect();
  }, [phone, activeId, s.focusDay, focus]);

  // map filter: every day by default (each day its own colour, pins labelled with the day), one day when picked
  const mapDay = s.mapDay;
  const pins: Pin[] = useMemo(() => {
    const out: Pin[] = []; const seenBase = new Set<string>();
    for (const d of plans) {
      if (mapDay !== undefined && d.n !== mapDay) continue;
      let k = 0;
      for (const x of d.stops) {
        const lab = mapDay === undefined ? String(d.n) : x.item.variant === "B" ? "B" : String(++k);
        out.push({ id: x.item.id, itemId: x.item.id, place: x.place, label: lab, kind: "stop", day: d.n, dim: false, draggable: x.place.catalog === false, lane: x.item.variant, color: mapDay === undefined ? dayColour(d.n) : undefined, quiet: mapDay === undefined });
      }
      for (const b of mapDay === undefined ? [d.end] : [d.start, d.end]) if (b && !seenBase.has(b.id)) { seenBase.add(b.id); out.push({ id: `base-${b.id}`, place: b, label: "", kind: "base", dim: false, quiet: mapDay === undefined }); }
    }
    if (peek) out.push({ id: "peek", place: peek, label: "", kind: "suggest" });
    if (mapDay === undefined) for (const l of liveTrip.lists) for (const id of l.itemIds) { const it = s.trip.items[id]; const p = it && placeLive(it.placeId); if (p) out.push({ id, itemId: id, place: p, label: "", kind: "idea", dim: true, draggable: p.catalog === false }); }
    return out;
  }, [plans, mapDay, liveTrip.lists, s.trip.items, placeLive, peek]);

  const nearest = addHere ? PLACES.map(p => ({ p, d: km(addHere, p) })).filter(x => x.d < 6).sort((a, b) => a.d - b.d).slice(0, 4) : [];
  const focusPlan = plans.find(p => p.n === s.focusDay) ?? plans[0];

  const map = (
    <div className="map-wrap">
      <MapView theme={theme} plans={plans} focusDay={mapDay} pins={pins} selectedItem={s.selected} preview={preview} fit={fit} compact={phone} peek={peek}
        onPick={pin => { if (pin.itemId) { const n = pin.day; select(pin.itemId, n); if (n) { const el = document.querySelector(`[data-item="${pin.itemId}"]`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); } } }}
        onPinDrag={(id, lng, lat, done) => { if (done) { setPinDrag(null); movePin(id, lng, lat); } else setPinDrag({ id, lng, lat }); }}
        onAddHere={(lng, lat, x, y) => setAddHere({ lng, lat, x, y })} />
      {pinDrag && <div className="map-hint">Moving your pin · day legs update as you drag</div>}
      <div className="map-filter" role="status">
        {mapDay === undefined
          ? <><span className="mf-title">All {plans.length} days</span><span className="muted small">Pick a day to see only its route</span></>
          : <><span className="mf-dot" style={{ background: dayColour(mapDay) }} /><span className="mf-title">Day {mapDay} only</span>
              <button className="btn small" onClick={() => { showDay(undefined); setFit(f => f + 1); }}><Icon name="map" size={14} />Show all days</button></>}
      </div>
      <AnimatePresence>
        {addHere && (
          <motion.div className="addhere" style={{ left: Math.min(addHere.x, 9999), top: addHere.y }} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="label">Add to day {s.focusDay}</div>
            {nearest.map(({ p, d }) => <button key={p.id} className="addbox-row" onClick={() => { add(p, { day: s.focusDay ?? 1 }); setAddHere(null); }}><span className="addbox-name">{p.name}</span><span className="num muted">{d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`}</span></button>)}
            <button className="addbox-row" onClick={() => { add({ id: `c${Date.now()}`, name: "Pinned place", kind: "sight", area: "My places", lng: addHere.lng, lat: addHere.lat, catalog: false, summary: "Dropped on the map. Drag the pin to adjust." }, { day: s.focusDay ?? 1 }); setAddHere(null); }}>
              <span className="glyph"><Icon name="pin" /></span><span className="addbox-name">Add a pin here as my own place</span></button>
            <button className="btn ghost small" onClick={() => setAddHere(null)}>Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>{s.selected && !phone && s.trip.items[s.selected] && <PlacePanel key={s.selected} itemId={s.selected} onClose={() => select(undefined)} onOpenPage={onOpenPlace} />}</AnimatePresence>
    </div>
  );

  const overlay = (
    <DragOverlay modifiers={[besidePointer]} dropAnimation={null}>
      {activeId && dragPlace ? (
        <div className="drag-pill" role="presentation">
          <span className="dp-glyph"><KindGlyph kind={dragPlace.kind} /></span>
          <span className="dp-name">{dragPlace.name}</span>
          {predicted ? <span className={`dp-to ${predicted.delta > 0 ? "warn" : predicted.delta < 0 ? "ok" : ""}`}>
            to {predicted.where}{predicted.delta !== 0 ? ` · ${predicted.delta > 0 ? "+" : "−"}${fmtMin(Math.abs(predicted.delta))} driving` : ""}</span>
            : <span className="dp-to muted">back where it was</span>}
          <span className="dp-grip"><Icon name="grip" size={16} /></span>
        </div>
      ) : null}
    </DragOverlay>
  );

  if (phone) {
    const n = s.focusDay ?? 1;
    return (
      <DndContext sensors={sensors} collisionDetection={collide} onDragStart={onStart} onDragMove={track} onDragOver={track} onDragEnd={onEnd} onDragCancel={() => { setActiveId(undefined); setDrop(null); }} accessibility={{ announcements }}>
      <DropCtx.Provider value={{ mark, activeId }}>
        <div className="phone-plan">
          <div className="daystrip" role="tablist" aria-label="Days">
            {plans.map(p => (
              <DayPill key={p.n} id={`ol-day:${p.n}`} on={p.n === n} over={mark?.key === `day:${p.n}`} onClick={() => { showDay(p.n); setFit(f => f + 1); }}>
                <span className="sign">{p.n}</span><span className="num">{dayDate(s.trip.start, p.n).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
                {p.warnings.length > 0 && <span className="dot warn" />}
              </DayPill>
            ))}
            {firstList && <DayPill id={`ol-list:${firstList}`} on={n === 0} over={mark?.key === `list:${firstList}`} onClick={() => focus(0)}><span className="sign">Ideas</span></DayPill>}
          </div>
          <div className="phone-search"><PlaceSearch plans={plans} onPreview={setPeek} onJumpDay={d => { showDay(d); setFit(f => f + 1); }} /></div>
          <motion.div className="phone-day" key={n} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .18 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={.18} dragDirectionLock
            onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 70) { const next = Math.min(s.trip.days.length, Math.max(1, n + (info.offset.x < 0 ? 1 : -1))); showDay(next); setFit(f => f + 1); } }}>
            {n === 0 ? s.trip.lists.map(l => <ListSection key={l.id} listId={l.id} ids={containers[`list:${l.id}`] ?? []} activeId={activeId} />)
              : <DaySection plan={plans.find(p => p.n === n)!} ids={containers[`day:${n}`] ?? []} activeId={activeId} />}
          </motion.div>
          <BottomSheet title={mapDay === undefined ? `All ${plans.length} days` : (() => { const d = plans.find(x => x.n === mapDay); return d ? `Day ${d.n} · ${fmtMin(d.driveMin)} driving` : "Map"; })()}>{map}</BottomSheet>
          <AnimatePresence>{s.selected && s.trip.items[s.selected] && <div className="phone-panel"><PlacePanel key={s.selected} itemId={s.selected} onClose={() => select(undefined)} onOpenPage={onOpenPlace} /></div>}</AnimatePresence>
        </div>
        {overlay}
      </DropCtx.Provider>
      </DndContext>
    );
  }

  const booked = s.trip.reservations.filter(r => r.status === "booked").length;
  const next = s.trip.reservations.find(r => r.id === "r-auronzo");
  return (
    <DndContext sensors={sensors} collisionDetection={collide} onDragStart={onStart} onDragMove={track} onDragOver={track} onDragEnd={onEnd} onDragCancel={() => { setActiveId(undefined); setDrop(null); }} accessibility={{ announcements }}>
      <DropCtx.Provider value={{ mark, activeId }}>
      <div className="plan">
        <Outline plans={plans} lists={containers} onJump={jump} />
        <div className="doc" ref={docRef}>
          <header className="trip-head" id="overview">
            <div className="trip-title-row">
              <h1 className="trip-title">{switcher ?? <span className="sign">Dolomites</span>}</h1>
              <div className="trip-sub num">{fmtDay(dayDate(s.trip.start, 1))} – {fmtDay(dayDate(s.trip.start, 14))} 2027 · 13 nights · car</div>
              <button className="btn" onClick={onShare}><Icon name="share" /> Share</button>
            </div>
            <PlaceSearch plans={plans} onPreview={setPeek} onJumpDay={n => jump(`day-${n}`)} />
            <div className="next-action"><Icon name="clock" /><span><b>Next:</b> {next?.title} — {next?.opensAt}. Sells out fast for midday slots.</span></div>
            <div className="strip" aria-label="Bookings">
              {(["flight", "stay", "car", "parking", "lift", "activity"] as const).map(k => {
                const rs = s.trip.reservations.filter(r => r.kind === k); if (!rs.length) return null;
                const todo = rs.filter(r => r.status === "to_book").length;
                return <span key={k} className={`chip ${todo ? "warn" : "ok"}`}><Icon name={k === "flight" ? "plane" : k === "stay" ? "bed" : k === "car" ? "car" : k === "parking" ? "parking" : "ticket"} size={13} />{k === "stay" ? "Stays" : k[0].toUpperCase() + k.slice(1)} {rs.length - todo}/{rs.length}</span>;
              })}
              <span className="chip"><Icon name="inbox" size={13} />Forward an email</span>
              <span className="muted small num">{booked} of {s.trip.reservations.length} booked</span>
            </div>
          </header>
          {hint && (
            <div className="dnd-hint" role="note">
              <span className="drag-handle demo" aria-hidden="true"><Icon name="grip" size={16} /></span>
              <span>Drag the handle to reorder a day, move a stop to another day, or drop it on <b>Ideas</b> or a day in the left column. Ctrl+Z undoes.</span>
              <button className="btn ghost small" aria-label="Hide tip" onClick={() => { setHint(false); try { localStorage.setItem("proto.dndHint", "off"); } catch { /* storage blocked */ } }}><Icon name="x" /></button>
            </div>
          )}
          <Shelf open={shelfOpen} onToggle={() => setShelfOpen(o => !o)} containers={containers} activeId={activeId} over={mark?.key === `list:${firstList}` && !shelfOpen} />
          {plans.map(p => <DaySection key={p.n} plan={p} ids={containers[`day:${p.n}`] ?? []} activeId={activeId} collapsed={collapsed[p.n]} onToggle={() => setCollapsed(c => ({ ...c, [p.n]: !c[p.n] }))} />)}
          <div className="doc-end muted">End of the plan · Budget, tasks and bookings are in their own views.</div>
        </div>
        {map}
      </div>
      {overlay}
      </DropCtx.Provider>
    </DndContext>
  );
}

/** lists live on a shelf above the days: collapsed it shows what is waiting; it opens while you drag */
function Shelf({ open, onToggle, containers, activeId, over }: { open: boolean; onToggle: () => void; containers: Containers; activeId?: string; over?: boolean }) {
  const { s, place } = useStore();
  const { setNodeRef } = useDroppable({ id: "shelf", disabled: open });
  const all = s.trip.lists.flatMap(l => (containers[`list:${l.id}`] ?? []).map(id => ({ l, id })));
  return (
    <section className="shelf" id="shelf">
      <div className={`shelf-head ${over ? "over" : ""} ${activeId && !open ? "dropzone" : ""}`} ref={setNodeRef}>
        <button className="shelf-toggle" onClick={onToggle} aria-expanded={open}><Icon name={open ? "down" : "chevron"} /><span className="sign">Ideas and lists</span><span className="num muted">{all.length}</span></button>
        {!open && activeId && <span className="shelf-drop muted small">Drop here to keep it in Ideas</span>}
        {!open && !activeId && <div className="shelf-peek">{all.slice(0, 6).map(({ id }) => <span key={id} className="chip">{place(s.trip.items[id]?.placeId)?.name}</span>)}{all.length > 6 && <span className="chip">+{all.length - 6}</span>}</div>}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="shelf-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .22 }}>
            {s.trip.lists.map(l => <ListSection key={l.id} listId={l.id} ids={containers[`list:${l.id}`] ?? []} activeId={activeId} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function DayPill({ id, on, over, onClick, children }: { id: string; on: boolean; over: boolean; onClick: () => void; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return <button ref={setNodeRef} role="tab" aria-selected={on} className={`daypill ${on ? "on" : ""} ${over ? "over" : ""}`} onClick={onClick}>{children}</button>;
}
