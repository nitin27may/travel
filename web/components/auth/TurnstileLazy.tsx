'use client';

import { useCallback, useEffect, useRef } from 'react';
import { TURNSTILE } from '@travel/core/config/auth-limits.ts';

/**
 * Cloudflare Turnstile for the sign-in card (email spec 5.3). Nothing loads until `prime()` runs, on the first focus of the email
 * field, so no page pays for it at start and pages without the card never load it (P8, P9; budget.test). Managed widget,
 * "interaction-only": it stays invisible unless Cloudflare needs the person to tick a box. Action `auth_send`, as the guard checks.
 * Tokens are single use: `token()` hands one out and resets the widget for the next call. With no site key (local runs) there is no
 * widget and `token()` is null; the guard skips Turnstile only under NODE_ENV test or development.
 */
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}


let loading: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE.widgetScript;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')));
    s.onerror = () => {
      loading = null;
      reject(new Error('turnstile failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface Turnstile {
  /** Start loading; safe to call often. */
  prime: () => void;
  /** A fresh token, or null (no site key, blocked script, or no answer in 15 s: the guard then refuses with a clear message). */
  token: () => Promise<string | null>;
}

/** `slotRef`: the element the widget renders into (it shows itself only when a person must interact). */
export function useTurnstile(siteKey: string | null, slotRef: React.RefObject<HTMLDivElement | null>): Turnstile {
  const widget = useRef<string | null>(null);
  const current = useRef<string | null>(null);
  const waiters = useRef<((t: string | null) => void)[]>([]);
  const ready = useRef<Promise<void> | null>(null);

  const settle = (t: string | null) => {
    current.current = t;
    if (t) for (const w of waiters.current.splice(0)) w(t);
  };

  const prime = useCallback(() => {
    if (!siteKey || ready.current || typeof window === 'undefined') return;
    ready.current = loadScript()
      .then((api) => {
        if (!slotRef.current || widget.current) return;
        widget.current = api.render(slotRef.current, {
          sitekey: siteKey,
          action: TURNSTILE.action,
          appearance: 'interaction-only',
          theme: 'auto',
          callback: (t: string) => settle(t),
          'expired-callback': () => settle(null),
          'error-callback': () => settle(null),
        });
      })
      .catch(() => {
        ready.current = null;
      });
  }, [siteKey, slotRef]);

  const token = useCallback(async (): Promise<string | null> => {
    if (!siteKey) return null;
    prime();
    await ready.current;
    if (!widget.current) return null;
    const t =
      current.current ??
      (await new Promise<string | null>((resolve) => {
        const timer = window.setTimeout(() => resolve(null), TURNSTILE.tokenWaitMs);
        waiters.current.push((v) => {
          window.clearTimeout(timer);
          resolve(v);
        });
      }));
    // Single use: hand it out, then ask for the next one.
    current.current = null;
    if (widget.current) window.turnstile?.reset(widget.current);
    return t;
  }, [siteKey, prime]);

  useEffect(
    () => () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    },
    [],
  );

  return { prime, token };
}
