/**
 * Where to go after signing in (Google spec 7.4, owned here because EML-1 lands first). One pure function: it returns the path
 * when it is a safe, same-site page under an allowed prefix, and the account page otherwise. A rejected value is never echoed.
 */
export const DEFAULT_RETURN = '/account/';

const MAX = 512;
const PREFIXES = ['/trips/', '/places/', '/globe/', '/favourites/', '/mine/', '/suggest/', '/t/', '/account/'];
const BASE = 'https://placeholder.invalid';

export function returnPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX) return DEFAULT_RETURN;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return DEFAULT_RETURN;
  }
  // Exactly one leading slash; no backslash, no control character, no scheme, no encoded second decode.
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_RETURN;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return DEFAULT_RETURN;
  if (/%(?:2f|5c|25)/i.test(value)) return DEFAULT_RETURN;
  const firstSlash = value.indexOf('/');
  const colon = value.indexOf(':');
  if (colon >= 0 && colon < firstSlash) return DEFAULT_RETURN;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return DEFAULT_RETURN;
  }
  if (url.origin !== BASE) return DEFAULT_RETURN;
  const path = url.pathname;
  if (path.startsWith('/api/')) return DEFAULT_RETURN;
  if (path !== '/' && !PREFIXES.some((p) => path.startsWith(p))) return DEFAULT_RETURN;
  return `${path}${url.search}${url.hash}`;
}

/** The `next` parameter of a location search string, checked. */
export function returnPathFromSearch(search: string): string {
  try {
    return returnPath(new URLSearchParams(search).get('next'));
  } catch {
    return DEFAULT_RETURN;
  }
}
