// @vitest-environment node
// The Google round trip in the browser (GSI-2): the press keeps the way in from before it, a failed return puts it back (string 6
// stays true), and Account reads whether there was one (string 24). Only method words and a time; never an address.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearGooglePending, dropHandedOffEmail, handOffEmail, lastMethod, markGooglePending, methodBeforePress, peekGooglePending, peekHandedOffEmail,
  rememberMethod, takeGoogleRoundTrip, undoGooglePress,
} from '@/components/auth/memory';

let local: Map<string, string>;
let session: Map<string, string>;
function fakeWindow(blocked = false) {
  local = new Map();
  session = new Map();
  const store = (data: Map<string, string>) => ({ getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) });
  const w = {} as Record<string, unknown>;
  const deny = { get: () => { throw new DOMException('denied', 'SecurityError'); } };
  Object.defineProperty(w, 'localStorage', blocked ? deny : { value: store(local) });
  Object.defineProperty(w, 'sessionStorage', blocked ? deny : { value: store(session) });
  vi.stubGlobal('window', w);
}
beforeEach(() => fakeWindow());
afterEach(() => vi.unstubAllGlobals());

/** The card's press, in its order: the mark first, then `google` as the last way in. */
function press(now = 1_000) {
  markGooglePending(now);
  rememberMethod('google');
}

describe('the Google round trip', () => {
  it('the press keeps the earlier way in beside the mark, and writes google', () => {
    rememberMethod('code');
    press(1234);
    expect(lastMethod()).toBe('google');
    expect(peekGooglePending()).toBe('1234');
    expect(session.get('auth.googleBefore')).toBe('code');
  });
  it('a failed return puts the earlier way back and drops the round trip', () => {
    rememberMethod('password');
    press();
    undoGooglePress();
    expect(lastMethod()).toBe('password');
    expect(session.size).toBe(0);
  });
  it('a failed return with no earlier way leaves none (no false "Last used")', () => {
    press();
    undoGooglePress();
    expect(lastMethod()).toBeNull();
    expect(local.has('auth.lastMethod')).toBe(false);
  });
  it('two presses, the first one failed: the earlier way survives', () => {
    rememberMethod('code');
    press();
    undoGooglePress();
    press();
    undoGooglePress();
    expect(lastMethod()).toBe('code');
  });
  it('without a mark, undo changes nothing (an ?error= link opened cold)', () => {
    rememberMethod('google');
    undoGooglePress();
    expect(lastMethod()).toBe('google');
  });
  it('a hostile stored value is never written back as a way in', () => {
    rememberMethod('code');
    press();
    session.set('auth.googleBefore', 'n@gmail.com');
    undoGooglePress();
    expect(lastMethod()).toBeNull();
    expect([...local.values()].join()).not.toContain('@');
  });
  it('Account reads the round trip once: had a way in before, then nothing', () => {
    rememberMethod('google'); // a different Google account last time
    press(5);
    expect(takeGoogleRoundTrip()).toEqual({ mark: '5', hadMethod: true });
    expect(takeGoogleRoundTrip()).toEqual({ mark: null, hadMethod: false });
    expect(lastMethod()).toBe('google');
  });
  it('Account: no way in before the press means no hint', () => {
    press(5);
    expect(takeGoogleRoundTrip()).toEqual({ mark: '5', hadMethod: false });
  });
  it('a leftover "before" without a mark does not count', () => {
    session.set('auth.googleBefore', 'code');
    expect(takeGoogleRoundTrip()).toEqual({ mark: null, hadMethod: false });
  });
  it('clear drops both keys', () => {
    rememberMethod('code');
    press();
    clearGooglePending();
    expect(session.size).toBe(0);
    expect(lastMethod()).toBe('google');
  });
  it('blocked storage: every call fails quietly', () => {
    fakeWindow(true);
    expect(() => {
      press();
      undoGooglePress();
      clearGooglePending();
    }).not.toThrow();
    expect(takeGoogleRoundTrip()).toEqual({ mark: null, hadMethod: false });
    expect(lastMethod()).toBeNull();
  });
  it('methodBeforePress reads what undo would leave, and writes nothing (GSI-UXF M1)', () => {
    rememberMethod('code');
    press();
    const before = [new Map(local), new Map(session)];
    expect(methodBeforePress()).toBe('code');
    expect(methodBeforePress()).toBe('code');
    expect([local, session]).toEqual(before);
    undoGooglePress();
    expect(lastMethod()).toBe('code');
    expect(methodBeforePress()).toBe('code');
  });
  it('methodBeforePress with no mark is the last way in; a hostile "before" is none', () => {
    rememberMethod('google');
    expect(methodBeforePress()).toBe('google');
    press();
    session.set('auth.googleBefore', 'n@gmail.com');
    expect(methodBeforePress()).toBeNull();
  });
});

describe('the reset hand-off (GSI-UXF M1: a render reads, the effect removes)', () => {
  it('peek reads without removing, drop removes', () => {
    handOffEmail('nitin@example.com');
    expect(peekHandedOffEmail()).toBe('nitin@example.com');
    expect(peekHandedOffEmail()).toBe('nitin@example.com');
    dropHandedOffEmail();
    expect(peekHandedOffEmail()).toBe('');
  });
});
