/**
 * Back-to-top visibility rule (docs/v2/ux/screens/S28-back-to-top.md). Pure so it is unit-tested.
 * Shows once the reader is 1.5 screens down; once shown it stays until they are back within one screen of the top (no flicker at the edge).
 */
export const SHOW_AT = 1.5;
export const HIDE_AT = 1;

export function toTopVisible(wasVisible: boolean, scrollY: number, viewportH: number): boolean {
  if (viewportH <= 0) return false;
  return wasVisible ? scrollY > viewportH * HIDE_AT : scrollY >= viewportH * SHOW_AT;
}

const NON_TEXT_INPUT = /^(button|checkbox|radio|range|color|file|image|reset|submit|hidden)$/;

/** A focused real text-entry field (text-like input, textarea, contenteditable): the only case where a soft keyboard is up. Checkbox, radio, range and select are not. */
export function isTextEntry(el: { tagName: string; type?: string; isContentEditable?: boolean } | null): boolean {
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !NON_TEXT_INPUT.test(el.type ?? 'text');
}

/**
 * The keyboard counts as up only while a text field has focus. A visual-viewport ratio test is deliberately absent:
 * pinch zoom and page zoom shrink the visual viewport too, and hid the button for the people who need it most.
 */
export function keyboardUp(active: Parameters<typeof isTextEntry>[0]): boolean {
  return isTextEntry(active);
}
