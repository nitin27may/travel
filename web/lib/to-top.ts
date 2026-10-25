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

/** The on-screen keyboard is up when the visual viewport lost a quarter of the layout viewport, or a text field has focus. */
export function keyboardUp(visualH: number, layoutH: number, typing: boolean): boolean {
  return typing || visualH < layoutH * 0.75;
}
