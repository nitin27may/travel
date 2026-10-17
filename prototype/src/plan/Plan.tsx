// The Plan screen: outline · plan document · live map (desktop), or day pager + map sheet (phone).
// Drag state is kept locally while dragging so legs, totals and the map preview update before the drop.
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent, type Announcements,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PLACES, type Place } from "../data/places";
import { dayDate, fmtDay, type Trip } from "../data/trip";
import { km, fmtMin } from "../lib/geo";
import { MapView, type Pin } from "../map/MapView";
import { planDay, useStore, type Target } from "../state/store";
import { Icon } from "../ui/Icon";
import { DaySection } from "./DaySection";
import { ItemCard } from "./ItemCard";
import { ListSection } from "./ListSection";
import { Outline } from "./Outline";
import { PlacePanel } from "./PlacePanel";
import { BottomSheet } from "../ui/BottomSheet";

type Containers = Record<string, string[]>;
const toTarget = (key: string): Target => key.startsWith("day:") ? { day: Number(key.slice(4)) } : { list: key.slice(5) };

export function PlanScreen({ theme, phone, onOpenPlace, onShare }: { theme: "light" | "dark"; phone: boolean; onOpenPlace: (p: Place) => void; onShare: () => void }) {
  const st = useStore();
  const { s, place, select, focus, move, add, movePin } = st;
  const fromStore = useCallback((t: Trip): Containers => ({
    ...Object.fromEntries(t.lists.map(l => [`list:${l.id}`, l.itemIds])),
    ...Object.fromEntries(t.days.map(d => [`day:${d.n}`, d.itemIds])),
  }), []);
  const [containers, setContainers] = useState<Containers>(() => fromStore(s.trip));
  const [activeId, setActiveId] = useState<string>();
  const [pinDrag, setPinDrag] = useState<{ id: string; lng: number; lat: number } | null>(null);
  const [addHere, setAddHere] = useState<{ lng: number; lat: number; x: number; y: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [fit, setFit] = useState(0);
  const docRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef(0);
  useEffect(() => { if (!activeId) setContainers(fromStore(s.trip)); }, [s.trip, activeId, fromStore]);

  const placeLive = useCallback((id: string) => {
    const p = place(id); return p && pinDrag && pinDrag.id === id ? { ...p, lng: pinDrag.lng, lat: pinDrag.lat } : p;
  }, [place, pinDrag]);
  const liveTrip: Trip = useMemo(() => ({
    ...s.trip,
    days: s.trip.days.map(d => ({ ...d, itemIds: containers[`day:${d.n}`] ?? d.itemIds })),
    lists: s.trip.lists.map(l => ({ ...l, itemIds: containers[`list:${l.id}`] ?? l.itemIds })),
  }), [s.trip, containers]);
  const plans = useMemo(() => s.trip.days.map(d => planDay(liveTrip, d.n, placeLive)), [liveTrip, placeLive, s.trip.days]);
  const storePlans = useMemo(() => s.trip.days.map(d => planDay(s.trip, d.n, place)), [s.trip, place]);

  // ---------- drag and drop ----------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const findKey = (id?: string | number | null): string | undefined => {
    if (id == null) return; const k = String(id);
    if (k.startsWith("ol-day:")) return `day:${k.slice(7)}`;
    if (k.startsWith("ol-list:")) return `list:${k.slice(8)}`;
    if (k in containers) return k;
    return Object.keys(containers).find(c => containers[c].includes(k));
  };
  function onStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    try { navigator.vibrate?.(8); } catch { /* not supported */ }
  }
  function onOver(e: DragOverEvent) {
    const id = String(e.active.id);
    const from = findKey(id), to = findKey(e.over?.id);
    if (!from || !to || from === to) return;
    setContainers(c => {
      const src = c[from].filter(x => x !== id);
      const dst = [...c[to]];
      const overIdx = dst.indexOf(String(e.over!.id));
      dst.splice(overIdx >= 0 ? overIdx : dst.length, 0, id);
      return { ...c, [from]: src, [to]: dst };
    });
    if (to.startsWith("day:")) { const n = Number(to.slice(4)); if (collapsed[n]) setCollapsed(c => ({ ...c, [n]: false })); }
  }
  function onEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const to = findKey(e.over?.id);
    if (!to) { setActiveId(undefined); return; }
    let list = containers[to];
    const overId = String(e.over?.id ?? "");
    const a = list.indexOf(id), b = list.indexOf(overId);
    if (a >= 0 && b >= 0 && a !== b) list = arrayMove(list, a, b);
    const index = list.indexOf(id);
    setContainers(c => ({ ...c, [to]: list }));
    setActiveId(undefined);
    const before = JSON.stringify(s.trip.days.find(d => d.itemIds.includes(id))?.n ?? s.trip.lists.find(l => l.itemIds.includes(id))?.id);
    const orig = Object.entries(fromStore(s.trip)).find(([, ids]) => ids.includes(id));
    if (orig && orig[0] === to && orig[1].indexOf(id) === index) return; // dropped where it was
    void before;
    move(id, toTarget(to), index);
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${place(s.trip.items[String(active.id)]?.placeId)?.name}.`,
    onDragOver: ({ over }) => over ? `Over ${labelFor(String(over.id))}.` : "Not over a day or list.",
    onDragEnd: ({ over }) => over ? `Dropped in ${labelFor(String(over.id))}.` : "Dropped back where it was.",
    onDragCancel: () => "Move cancelled.",
  };
  const labelFor = (id: string) => { const k = findKey(id); return k ? (k.startsWith("day:") ? `Day ${k.slice(4)}` : s.trip.lists.find(l => `list:${l.id}` === k)?.name ?? "") : ""; };

  // live prediction while dragging: change in that day's driving, and a dashed leg on the map
  const dragTo = activeId ? findKey(activeId) : undefined;
  const dragPlace = activeId ? place(s.trip.items[activeId]?.placeId) : undefined;
  let predicted: { day: number; delta: number } | undefined;
  let preview: { from: Place; to: Place; back?: Place } | null = null;
  if (activeId && dragTo?.startsWith("day:") && dragPlace) {
    const n = Number(dragTo.slice(4));
    const live = plans.find(p => p.n === n)!, was = storePlans.find(p => p.n === n)!;
    predicted = { day: n, delta: live.driveMin - was.driveMin };
    const ids = containers[dragTo]; const k = ids.indexOf(activeId);
    const prevP = k > 0 ? place(s.trip.items[ids[k - 1]].placeId) : live.start;
    const nextP = k < ids.length - 1 ? place(s.trip.items[ids[k + 1]].placeId) : live.end;
    if (prevP) preview = { from: prevP, to: dragPlace, back: nextP };
  }

  // ---------- focus, scroll spy, map ----------
  const jump = (id: string) => {
    const el = document.getElementById(id); if (!el) return;
    scrolling.current = Date.now();
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    if (id.startsWith("day-")) focus(Number(id.slice(4)));
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

  const pins: Pin[] = useMemo(() => {
    const out: Pin[] = []; const seenBase = new Set<string>();
    for (const d of plans) {
      const isF = d.n === s.focusDay;
      let k = 0;
      for (const x of d.stops) {
        const lab = x.item.variant === "B" ? "B" : String(++k);
        out.push({ id: x.item.id, itemId: x.item.id, place: x.place, label: isF ? lab : "", kind: "stop", day: d.n, dim: !isF, draggable: x.place.catalog === false, lane: x.item.variant });
      }
      for (const b of [d.end]) if (b && !seenBase.has(b.id)) { seenBase.add(b.id); out.push({ id: `base-${b.id}`, place: b, label: "", kind: "base", dim: !(d.n === s.focusDay || d.n === (s.focusDay ?? 0) - 1) }); }
    }
    for (const l of liveTrip.lists) for (const id of l.itemIds) { const it = s.trip.items[id]; const p = it && placeLive(it.placeId); if (p) out.push({ id, itemId: id, place: p, label: "", kind: "idea", dim: true, draggable: p.catalog === false }); }
    return out;
  }, [plans, s.focusDay, liveTrip.lists, s.trip.items, placeLive]);

  const nearest = addHere ? PLACES.map(p => ({ p, d: km(addHere, p) })).filter(x => x.d < 6).sort((a, b) => a.d - b.d).slice(0, 4) : [];
  const focusPlan = plans.find(p => p.n === s.focusDay) ?? plans[0];

  const map = (
    <div className="map-wrap">
      <MapView theme={theme} plans={plans} focusDay={s.focusDay} pins={pins} selectedItem={s.selected} preview={preview} fit={fit} compact={phone}
        onPick={pin => { if (pin.itemId) { const n = pin.day; select(pin.itemId, n); if (n) { const el = document.querySelector(`[data-item="${pin.itemId}"]`); el?.scrollIntoView({ behavior: "smooth", block: "center" }); } } }}
        onPinDrag={(id, lng, lat, done) => { if (done) { setPinDrag(null); movePin(id, lng, lat); } else setPinDrag({ id, lng, lat }); }}
        onAddHere={(lng, lat, x, y) => setAddHere({ lng, lat, x, y })} />
      {pinDrag && <div className="map-hint">Moving your pin · day legs update as you drag</div>}
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
    <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }}>
      {activeId && dragPlace ? (
        <div className="overlay-wrap">
          <ItemCard item={s.trip.items[activeId]} place={dragPlace} overlay />
          {predicted && predicted.delta !== 0 && <span className={`chip ${predicted.delta > 0 ? "warn" : "ok"} num predict`}>Day {predicted.day}: {predicted.delta > 0 ? "+" : "−"}{fmtMin(Math.abs(predicted.delta))} driving</span>}
        </div>
      ) : null}
    </DragOverlay>
  );

  if (phone) {
    const n = s.focusDay ?? 1;
    return (
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => setActiveId(undefined)} accessibility={{ announcements }}>
        <div className="phone-plan">
          <div className="daystrip" role="tablist" aria-label="Days">
            {plans.map(p => (
              <button key={p.n} role="tab" aria-selected={p.n === n} className={`daypill ${p.n === n ? "on" : ""}`} onClick={() => { focus(p.n); setFit(f => f + 1); }}>
                <span className="sign">{p.n}</span><span className="num">{dayDate(s.trip.start, p.n).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
                {p.warnings.length > 0 && <span className="dot warn" />}
              </button>
            ))}
            <button className={`daypill ${n === 0 ? "on" : ""}`} onClick={() => focus(0)}><span className="sign">Ideas</span></button>
          </div>
          <motion.div className="phone-day" key={n} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .18 }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={.18} dragDirectionLock
            onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 70) { const next = Math.min(s.trip.days.length, Math.max(1, n + (info.offset.x < 0 ? 1 : -1))); focus(next); setFit(f => f + 1); } }}>
            {n === 0 ? s.trip.lists.map(l => <ListSection key={l.id} listId={l.id} ids={containers[`list:${l.id}`] ?? []} activeId={activeId} />)
              : <DaySection plan={plans.find(p => p.n === n)!} ids={containers[`day:${n}`] ?? []} activeId={activeId} />}
          </motion.div>
          <BottomSheet title={focusPlan ? `Day ${focusPlan.n} · ${fmtMin(focusPlan.driveMin)} driving` : "Map"}>{map}</BottomSheet>
          <AnimatePresence>{s.selected && s.trip.items[s.selected] && <div className="phone-panel"><PlacePanel key={s.selected} itemId={s.selected} onClose={() => select(undefined)} onOpenPage={onOpenPlace} /></div>}</AnimatePresence>
        </div>
        {overlay}
      </DndContext>
    );
  }

  const booked = s.trip.reservations.filter(r => r.status === "booked").length;
  const next = s.trip.reservations.find(r => r.id === "r-auronzo");
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => setActiveId(undefined)} accessibility={{ announcements }}>
      <div className="plan">
        <Outline plans={plans} lists={containers} onJump={jump} />
        <div className="doc" ref={docRef}>
          <header className="trip-head" id="overview">
            <div className="trip-title-row">
              <h1 className="sign trip-title">Dolomites</h1>
              <div className="trip-sub num">{fmtDay(dayDate(s.trip.start, 1))} – {fmtDay(dayDate(s.trip.start, 14))} 2027 · 13 nights · car</div>
              <button className="btn" onClick={onShare}><Icon name="share" /> Share</button>
            </div>
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
          {s.trip.lists.map(l => <ListSection key={l.id} listId={l.id} ids={containers[`list:${l.id}`] ?? []} activeId={activeId} />)}
          {plans.map(p => <DaySection key={p.n} plan={p} ids={containers[`day:${p.n}`] ?? []} activeId={activeId} collapsed={collapsed[p.n]} onToggle={() => setCollapsed(c => ({ ...c, [p.n]: !c[p.n] }))} />)}
          <div className="doc-end muted">End of the plan · Budget, tasks and bookings are in their own views.</div>
        </div>
        {map}
      </div>
      {overlay}
    </DndContext>
  );
}
