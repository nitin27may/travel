'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { capabilities } from '@/lib/capabilities';
import { mineCurrent } from '@/lib/mine/current';
import { watchDot } from '@/lib/mine/dot';

/**
 * The header's Mine button from 640 px (spec 4): icon and label from 900 px, icon only below. Loaded after hydration into `.mine-slot`,
 * which reserves its width, so nothing moves when it appears. Hidden on phones, where the bottom bar holds Mine; it still mounts there,
 * because it also owns the dot on the bar's Mine item.
 */
export default function MineLink() {
  const path = usePathname() ?? '/';
  const [dot, setDot] = useState(false);
  useEffect(
    () =>
      watchDot((on) => {
        setDot(on);
        // The phone bar's Mine item gets the same dot from here: the bar ships no storage code (start-JS budget). Its `data-dot` and
        // `aria-label` are not React props, so a re-render of the bar never undoes them.
        const bar = document.querySelector<HTMLElement>('.bottom-bar a[href="/mine/"]');
        if (!bar) return;
        if (on) {
          bar.setAttribute('data-dot', 'true');
          bar.setAttribute('aria-label', 'Mine, new items');
        } else {
          bar.removeAttribute('data-dot');
          bar.removeAttribute('aria-label');
        }
      }),
    [],
  );
  // Current states of the server-rendered bar item and phone account links, set here for the same reason as the dot (start-JS budget).
  // They are not React props of those elements, so a re-render never undoes them. Applied after hydration, so they appear a beat later.
  useEffect(() => {
    const set = (el: Element | null, v: string | undefined) => (v ? el?.setAttribute('aria-current', v) : el?.removeAttribute('aria-current'));
    set(document.querySelector('.bottom-bar a[href="/mine/"]'), mineCurrent(path, capabilities.signIn));
    for (const a of document.querySelectorAll('.phone-acct')) set(a, path.startsWith(a.getAttribute('href') ?? '/\0') ? 'page' : undefined);
  }, [path]);
  return (
    <Link
      className="btn btn-ghost mine-link"
      href="/mine/"
      aria-label={dot ? 'Mine, new items' : 'Mine'}
      aria-current={path.startsWith('/mine/') ? 'page' : undefined}
      data-dot={dot || undefined}
    >
      <i className="mi mi-layers" />
      <span className="mine-link-label">Mine</span>
    </Link>
  );
}
