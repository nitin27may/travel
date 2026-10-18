'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

export const THEME_KEY = 'travel:v1:theme';
const EVENT = 'travel:theme';

const read = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

/** Light is the default on public pages; the choice is remembered on this device (tokens 1). */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => 'light');
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant="ghost"
      icon
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => {
        const root = document.documentElement;
        // surfaces cross-fade for 200 ms; images are excluded in app.css so they do not flash
        root.classList.add('theme-fade');
        root.dataset.theme = next;
        window.setTimeout(() => root.classList.remove('theme-fade'), 260);
        try {
          window.localStorage.setItem(THEME_KEY, next);
        } catch {
          /* private mode: lasts until reload */
        }
        window.dispatchEvent(new Event(EVENT));
      }}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </Button>
  );
}

/** Runs before first paint so a returning visitor never sees the wrong theme flash. */
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('${THEME_KEY}')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;
