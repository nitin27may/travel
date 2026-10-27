/**
 * What the sign-in card reads on its first render (GSI-UXF M1): the banner a return from Google brings (copy page 2.3 and string 16)
 * and the way in to show as "last used". A READ ONLY: it runs inside a `useState` initialiser, and React may run a first render more
 * than once before it commits (a concurrent render it throws away and starts again), so it must never write storage. The mark is
 * dropped, and the way in from before the press put back, after the first commit (`SignInCard`'s mount effect, `undoGooglePress`).
 *
 * Before this split the initialiser itself called `undoGooglePress()`: when React restarted the first render, the second pass found
 * the mark already gone and the "didn't finish" banner never appeared (4 of 6 loads in the GSI-UX-R review).
 */
import { didNotFinish, pendingFresh, readReturn } from '@/lib/auth/google';
import { GOOGLE_COPY, googleReturnNotice, type GoogleNotice } from '@/lib/auth/oauth-errors';
import { lastMethod, methodBeforePress, peekGooglePending, type Method } from './memory';

export interface CardStart {
  /** The banner for this return from Google, or null. */
  returned: GoogleNotice | null;
  /** The way in to show as "last used": the one from before the press when this load is a return that did not sign in. */
  last: Method | null;
}

/** True when this load is a Back or Forward to the page (the way back from Google's screen). */
function backForwardLoad(): boolean {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === 'back_forward';
  } catch {
    return false;
  }
}

export function readCardStart(googleOn: boolean, now: number = Date.now()): CardStart {
  if (!googleOn) return { returned: null, last: lastMethod() };
  const r = readReturn(window.location.search);
  let returned: GoogleNotice | null = null;
  if (r.error !== null) returned = googleReturnNotice(r.error);
  else {
    const fresh = pendingFresh(peekGooglePending(), now);
    if (didNotFinish({ fresh, error: r.error, failedExchange: r.failedExchange, backForward: backForwardLoad() })) returned = { tone: 'notice', message: GOOGLE_COPY.didNotFinish };
  }
  // A press that came back here did not sign in, so show the way in remembered before it (GSI-2); `undoGooglePress` writes it later.
  return { returned, last: returned ? methodBeforePress() : lastMethod() };
}
