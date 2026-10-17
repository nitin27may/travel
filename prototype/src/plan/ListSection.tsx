import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { AnimatePresence } from "motion/react";
import { useStore } from "../state/store";
import { AddBox } from "./AddBox";
import { ItemCard, MotionShell } from "./ItemCard";

export function ListSection({ listId, ids, activeId }: { listId: string; ids: string[]; activeId?: string }) {
  const { s, place } = useStore();
  const list = s.trip.lists.find(l => l.id === listId)!;
  const { setNodeRef, isOver } = useDroppable({ id: `list:${listId}` });
  const base = place("hotel-cortina");
  return (
    <section className={`list ${isOver ? "over" : ""}`} id={`list-${listId}`} ref={setNodeRef}>
      <header className="list-head"><h2 className="sign list-title">{list.name}</h2><span className="num muted">{ids.length}</span></header>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="items" role="list">
          <AnimatePresence initial={false}>
            {ids.map(id => s.trip.items[id]).filter(Boolean).map(item => {
              const p = place(item.placeId); if (!p) return null;
              return <MotionShell key={item.id} id={item.id} enabled={!activeId}><ItemCard item={item} place={p} dragging={activeId === item.id} /></MotionShell>;
            })}
          </AnimatePresence>
          {ids.length === 0 && <div className="empty-day">Empty. Drop places here to keep them for later.</div>}
        </div>
      </SortableContext>
      <AddBox target={{ list: listId }} base={base} placeholder={`Add to ${list.name}`} />
    </section>
  );
}
