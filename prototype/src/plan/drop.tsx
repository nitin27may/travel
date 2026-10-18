// Where a dragged stop will land. The page never rearranges while you drag (that moved targets under the
// pointer and looped); instead one insertion line shows the landing spot and the container is tinted.
import { createContext, useContext } from "react";
import type { SortingStrategy } from "@dnd-kit/sortable";

export interface DropMark { key: string; id?: string; edge?: "before" | "after" }
export const DropCtx = createContext<{ mark: DropMark | null; activeId?: string }>({ mark: null });
export const useDrop = () => useContext(DropCtx);
/** the edge of this item that shows the insertion line, if any */
export const useEdge = (id: string) => { const { mark } = useDrop(); return mark?.id === id ? mark.edge : undefined; };
/** sortable without shifting neighbours: rows stay put, the line shows the slot */
export const stayPut: SortingStrategy = () => null;
