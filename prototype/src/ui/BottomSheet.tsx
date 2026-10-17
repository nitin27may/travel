// Phone map sheet with three snap points (peek, half, full). Dragging the handle never scrolls the page.
import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

export function BottomSheet({ title, children }: { title: string; children: ReactNode }) {
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => { const r = () => setH(window.innerHeight); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, []);
  const snaps = [h - 150, h * 0.48, h * 0.1];             // top offset for peek, half, full
  const y = useMotionValue(snaps[1]);
  const [at, setAt] = useState(1);
  const go = (k: number) => { setAt(k); animate(y, snaps[k], { type: "spring", stiffness: 420, damping: 42 }); };
  useEffect(() => { y.set(snaps[at]); }, [h]);
  return (
    <motion.div className="sheet" style={{ y, height: h }} aria-label="Map">
      <motion.div className="sheet-handle" drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0} dragMomentum={false}
        onDrag={(_, i) => y.set(Math.min(snaps[0], Math.max(snaps[2], snaps[at] + i.offset.y)))}
        onDragEnd={(_, i) => { const target = y.get() + i.velocity.y * 0.15; let best = 0; snaps.forEach((s, k) => { if (Math.abs(s - target) < Math.abs(snaps[best] - target)) best = k; }); go(best); }}
        onClick={() => go(at === 0 ? 1 : at === 1 ? 2 : 0)} role="button" aria-label="Resize map" tabIndex={0}
        onKeyDown={e => { if (e.key === "ArrowUp") go(Math.min(2, at + 1)); if (e.key === "ArrowDown") go(Math.max(0, at - 1)); }}>
        <span className="grabber" />
        <span className="sheet-title num">{title}</span>
      </motion.div>
      <div className="sheet-body">{children}</div>
    </motion.div>
  );
}
