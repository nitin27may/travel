'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/Icon';

export const THEME_KEY = 'travel:v1:theme';
const EVENT = 'travel:theme';

const read = () => (document.documentElement.dataset.theme === 'shell-light' ? 'light' : 'dark');
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

/** Dark is the default; the choice is remembered on this device. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => 'dark');
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => {
        document.documentElement.dataset.theme = next === 'light' ? 'shell-light' : 'shell';
        try {
          window.localStorage.setItem(THEME_KEY, next);
        } catch {
          /* private mode: lasts until reload */
        }
        window.dispatchEvent(new Event(EVENT));
      }}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  );
}

/** Runs before first paint so a returning visitor never sees the wrong theme flash. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light')document.documentElement.dataset.theme='shell-light'}catch(e){}`;
