import { describe, expect, it } from 'vitest';
import { keyboardUp, toTopVisible } from '@/lib/to-top';

describe('back-to-top visibility (S28)', () => {
  const vh = 800;
  it('stays hidden near the top and shows from 1.5 screens down', () => {
    expect(toTopVisible(false, 0, vh)).toBe(false);
    expect(toTopVisible(false, 1199, vh)).toBe(false);
    expect(toTopVisible(false, 1200, vh)).toBe(true);
  });
  it('once shown, hides only within one screen of the top (no flicker at the edge)', () => {
    expect(toTopVisible(true, 1000, vh)).toBe(true);
    expect(toTopVisible(true, 801, vh)).toBe(true);
    expect(toTopVisible(true, 800, vh)).toBe(false);
    expect(toTopVisible(true, 0, vh)).toBe(false);
  });
  it('is hidden with no viewport', () => expect(toTopVisible(true, 5000, 0)).toBe(false));
  it('counts the keyboard as up only for a focused text-entry field', () => {
    for (const type of ['text', 'search', 'email', 'url', 'tel', 'password', 'number']) expect(keyboardUp({ tagName: 'INPUT', type })).toBe(true);
    expect(keyboardUp({ tagName: 'TEXTAREA' })).toBe(true);
    expect(keyboardUp({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    for (const type of ['checkbox', 'radio', 'range', 'button', 'submit', 'color', 'file']) expect(keyboardUp({ tagName: 'INPUT', type })).toBe(false);
    expect(keyboardUp({ tagName: 'SELECT' })).toBe(false);
    expect(keyboardUp({ tagName: 'BUTTON' })).toBe(false);
    expect(keyboardUp(null)).toBe(false);
  });
  it('does not hide for pinch zoom: only the focused field decides, never the viewport size', () => {
    // visual viewport 562 of 844 (1.5x pinch) and nothing focused: visible
    expect(keyboardUp(null)).toBe(false);
    expect(keyboardUp.length).toBe(1);
  });
});
