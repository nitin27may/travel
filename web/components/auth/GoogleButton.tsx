'use client';

import Link from 'next/link';
import { GOOGLE_COPY } from '@/lib/auth/oauth-errors';

interface Props {
  /** Between the press and leaving for Google: a spinner replaces the "G", the width stays, `aria-busy` (string 10). */
  busy: boolean;
  onPress: () => void;
  /** The consent line (string 3) and the last-used line (6), read after the name. */
  describedBy?: string;
}

/**
 * Continue with Google (GSI-1; Google spec 4.1 to 4.5, copy page string 1). A real `<button type="button">` whose visible text is its
 * name; the "G" is Google's own file, unmodified, `alt=""` (decorative), so its colours never pass through our CSS. Fill, stroke and
 * label are Google's light or dark theme as brand tokens (`--brand-google-*`, tokens.md 2.3). No popup, no Google script: the press
 * asks our proxy for Google's address and the page leaves.
 */
export function GoogleButton({ busy, onPress, describedBy }: Props) {
  return (
    <button
      type="button"
      className="auth-google"
      aria-busy={busy || undefined}
      data-loading={busy || undefined}
      aria-describedby={describedBy}
      onClick={() => {
        if (!busy) onPress();
      }}
    >
      <span className="auth-google-mark" aria-hidden="true">
        {busy ? (
          <span className="btn-spin" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a fixed 18 px brand file; next/image adds a loader for nothing here
          <img src="/brand/google-g.svg" alt="" width={18} height={18} />
        )}
      </span>
      <span className="auth-google-label">{GOOGLE_COPY.button}</span>
    </button>
  );
}

/**
 * Step 1's Google part (copy page 2.1): the button first and full width, the last-used line (6) when this browser used Google last,
 * the consent line (3) with "What we keep" (4) to the privacy page, then the divider "or" (2) above the email form. The divider is
 * text, so the order reads sensibly; its lines are CSS.
 */
export function GoogleStart({ busy, onPress, lastUsed }: { busy: boolean; onPress: () => void; lastUsed: boolean }) {
  const described = lastUsed ? 'auth-google-last auth-google-consent' : 'auth-google-consent';
  return (
    <div className="auth-google-start">
      <GoogleButton busy={busy} onPress={onPress} describedBy={described} />
      {lastUsed ? (
        <p className="auth-google-last" id="auth-google-last">
          {GOOGLE_COPY.lastUsed}
        </p>
      ) : null}
      <p className="auth-help auth-google-consent" id="auth-google-consent">
        {GOOGLE_COPY.consent} <Link href="/privacy/#accounts">{GOOGLE_COPY.consentLink}</Link>
      </p>
      <p className="auth-divider">
        <span>{GOOGLE_COPY.divider}</span>
      </p>
    </div>
  );
}
