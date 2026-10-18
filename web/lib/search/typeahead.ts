/**
 * The search dialog is a lazy chunk and its input takes a moment to focus, so keys typed right after "/"
 * would be lost. `startBuffer` catches them from the moment "/" is pressed; the dialog takes what was typed,
 * receives later keys through `setSink` until its input has focus, then calls `stopBuffer`.
 */
let keys = '';
let listening = false;
let sink: ((apply: (q: string) => string) => void) | null = null;

const onKey = (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const edit = e.key.length === 1 ? (q: string) => q + e.key : e.key === 'Backspace' ? (q: string) => q.slice(0, -1) : null;
  if (!edit) return;
  e.preventDefault();
  if (sink) sink(edit);
  else keys = edit(keys);
};

export function startBuffer(): void {
  keys = '';
  sink = null;
  if (listening) return;
  listening = true;
  window.addEventListener('keydown', onKey, true);
}

/** What was typed before the dialog mounted. Read-only: React may render the dialog more than once. */
export function takeBuffer(): string {
  return keys;
}

export function setSink(fn: ((apply: (q: string) => string) => void) | null): void {
  sink = fn;
  if (fn) keys = '';
}

export function stopBuffer(): void {
  if (listening) window.removeEventListener('keydown', onKey, true);
  listening = false;
  sink = null;
  keys = '';
}
