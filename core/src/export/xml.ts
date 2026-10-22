export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** XML 1.0 forbids most control characters; they would make the file unreadable, so they go. */
export const clean = (s: string): string => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
export const x = (s: string): string => esc(clean(s));
export const coord = (n: number): string => String(Math.round(n * 1e6) / 1e6);
