'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ToastOptions {
  message: ReactNode;
  /** Label of the undo-style action ("Undo", "Back"). */
  actionLabel?: string;
  onAction?: () => void;
  /** Small photo in the identity ring. */
  photo?: string;
  /** ms; defaults to 6 s with an action and 4 s without (components 5.3). */
  duration?: number;
}

interface Item extends ToastOptions {
  id: number;
  leaving?: boolean;
}

interface Api {
  toast: (options: ToastOptions) => void;
}

const Ctx = createContext<Api>({ toast: () => undefined });
export const useToast = (): Api => useContext(Ctx);

const MAX = 2;
const EXIT_MS = 160;

function ToastView({ item, onDone }: { item: Item; onDone: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(item.duration ?? (item.onAction ? 6000 : 4000));
  const started = useRef(0);
  useEffect(() => {
    if (paused || item.leaving) return;
    started.current = Date.now();
    const t = setTimeout(() => onDone(item.id), left.current);
    return () => {
      clearTimeout(t);
      left.current = Math.max(1000, left.current - (Date.now() - started.current));
    };
  }, [paused, item.leaving, item.id, onDone]);
  return (
    <div
      className="toast"
      data-leaving={item.leaving || undefined}
      // a pointer that hovers pauses the clock; a touch fires the same events and never sends the leave, so a tap near the toast kept it for good
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {item.photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative
        <img src={item.photo} alt="" />
      ) : null}
      <span className="toast-msg">{item.message}</span>
      {item.onAction ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            item.onAction?.();
            onDone(item.id);
          }}
        >
          {item.actionLabel ?? 'Undo'}
        </button>
      ) : null}
    </div>
  );
}

/** Bottom-centre toasts with Undo (components 5.3). At most two; pause on hover and focus; polite live region. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = next.current++;
    // on a phone one toast at a time: the newest replaces the older (its Undo stays in the edit bar), so a stack never covers the day being edited
    const max = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? 1 : MAX;
    setItems((list) => [...list.filter((t) => !t.leaving), { ...options, id }].slice(-max));
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDone={dismiss} />
        ))}
      </div>
    </Ctx.Provider>
  );
}
