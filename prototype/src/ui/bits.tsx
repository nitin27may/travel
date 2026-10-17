import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import { Icon } from "./Icon";
import { fmtMin } from "../lib/geo";

/** a number that counts from its old value to its new one, so changes are noticed */
export function Num({ value, format = (v: number) => String(Math.round(v)), className = "" }: { value: number; format?: (v: number) => string; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, v => format(v));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; mv.set(value); return; }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const c = animate(mv, value, { duration: reduce ? 0 : 0.3, ease: "easeOut" });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={`num ${className}`}>{text}</motion.span>;
}
export const DriveNum = ({ min }: { min: number }) => <Num value={min} format={v => fmtMin(Math.round(v))} />;

/** a change of value shown once as a delta chip */
export function Delta({ value, unit = "min" }: { value: number; unit?: string }) {
  const prev = useRef(value);
  const [d, setD] = useState(0);
  useEffect(() => {
    const diff = value - prev.current; prev.current = value;
    if (!diff) return;
    setD(diff); const h = setTimeout(() => setD(0), 2600); return () => clearTimeout(h);
  }, [value]);
  return (
    <AnimatePresence>
      {d !== 0 && (
        <motion.span key={`${value}`} className={`chip ${d > 0 ? "warn" : "ok"} num`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {d > 0 ? "+" : "−"}{unit === "min" ? fmtMin(Math.abs(d)) : `${Math.abs(d)} ${unit}`}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function Toast() {
  const { s, undo, toast } = useStore();
  const t = s.toast;
  useEffect(() => { if (!t) return; const h = setTimeout(() => toast(undefined), 6000); return () => clearTimeout(h); }, [t?.id]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !(e.target as HTMLElement)?.closest?.("input,textarea")) { e.preventDefault(); undo(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [undo]);
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence>
        {t && (
          <motion.div key={t.id} className="toast" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ type: "spring", stiffness: 520, damping: 40 }}>
            <span>{t.text}</span>
            {t.undo && <button className="btn ghost toast-undo" onClick={undo}><Icon name="undo" /> Undo</button>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Avatar({ initials, tone = "ok", title }: { initials: string; tone?: "ok" | "crit" | "muted"; title?: string }) {
  return <span className={`avatar ${tone}`} title={title} aria-label={title}>{initials}</span>;
}
