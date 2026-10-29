/*
 * The one door to localStorage and sessionStorage (review NAV-2 C1). Browsers that block all site data throw on ACCESS to
 * `window.localStorage`, not only on the call, so the property read sits inside the try. No imports: it lives in the start chunk.
 * Every reader and writer in web/ uses this file (an ESLint rule enforces it), except lib/mine/storage.ts, which keeps its own probe.
 */
export const readLocal = (k: string): string | null => { try { return window.localStorage.getItem(k); } catch { return null; } };
export const writeLocal = (k: string, v: string): boolean => { try { window.localStorage.setItem(k, v); return true; } catch { return false; } };
export const removeLocal = (k: string): boolean => { try { window.localStorage.removeItem(k); return true; } catch { return false; } };
/** The Storage object itself, for readers that scan keys (the access sits in the try); null where site data is blocked. */
export const localStore = (): Storage | null => { try { return window.localStorage; } catch { return null; } };
export const readSession = (k: string): string | null => { try { return window.sessionStorage.getItem(k); } catch { return null; } };
export const writeSession = (k: string, v: string): boolean => { try { window.sessionStorage.setItem(k, v); return true; } catch { return false; } };
export const removeSession = (k: string): boolean => { try { window.sessionStorage.removeItem(k); return true; } catch { return false; } };
/** Removes every sessionStorage key that starts with `prefix` (sign-out clears the tab's undo stacks). Returns how many went. */
export const removeSessionWithPrefix = (prefix: string): number => {
  try {
    const s = window.sessionStorage;
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k !== null && k.startsWith(prefix)) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
    return keys.length;
  } catch {
    return 0;
  }
};
