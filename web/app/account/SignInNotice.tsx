'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ButtonLink } from '@/components/ui/Button';
import { useAnnouncer } from '@/components/auth/live';
import { takeGoogleRoundTrip } from '@/components/auth/memory';
import { LANDING_COPY, landingHint, landingText } from '@/lib/auth/landing';

interface Props {
  /** Decided on the server from the account rows (`accountLanding`), never from the address. */
  kind: 'new' | 'linked';
  /** `maskAddress(user.email)` (W6). */
  masked: string;
  /** The checked `next` when it is not this page: the Continue button goes there. Null: no button. */
  next: string | null;
}

/**
 * The stop on Account after Continue with Google (GSI-2; copy page W3, Q-GC3, strings 23 to 27): a new account, or Google just added
 * to an existing one, is told once here before the visitor moves on, and Continue goes on to the page they started from. A returning
 * sign-in never renders this (string 28).
 *
 * The banner is the components 5.4 notice, without its `role="status"`: a status node rendered with its text is often skipped, and
 * string 24 joins after mount. The whole message is read once through a polite live region instead, and the h1 keeps focus.
 *
 * After mount it reads the Google round trip once (the press mark and whether this browser had a way in before it) and removes it:
 * string 24 shows only for a new account, after a recent press, when there was an earlier way in. The address never leaves the server
 * unmasked, and nothing new is stored.
 */
/** The masked address never breaks after its ellipsis ("n…" then "@gmail.com" on the next line). */
function keepTogether(text: string, masked: string) {
  const at = text.indexOf(masked);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="account-landing-address">{masked}</span>
      {text.slice(at + masked.length)}
    </>
  );
}

export function SignInNotice({ kind, masked, next }: Props) {
  const [hint, setHint] = useState(false);
  const { region, announce } = useAnnouncer();
  const read = useRef(false);
  useEffect(() => {
    // Once per landing: the round trip is removed when read, so a second run (Strict Mode) would lose the hint.
    if (read.current) return;
    read.current = true;
    const showHint = landingHint(kind, takeGoogleRoundTrip(), Date.now());
    setHint(showHint);
    announce(landingText(kind, masked, showHint));
  }, [kind, masked, announce]);

  return (
    <div className="ban ban-notice account-landing" data-landing={kind}>
      <Icon name="info" size={16} />
      <p className="ban-text">
        {keepTogether(landingText(kind, masked, hint), masked)}
        {kind === 'linked' ? (
          <>
            {' '}
            {/* 26: the way to undo, now that "Ways to sign in" is on this page (GSI-WAYS). */}
            <a className="account-landing-undo" href="#ways-to-sign-in">
              {LANDING_COPY.linkedUndo}
            </a>
          </>
        ) : null}
      </p>
      {next ? (
        <span className="ban-action">
          <ButtonLink href={next} variant="primary">
            {LANDING_COPY.continue}
            <span className="sr-only">{LANDING_COPY.continueTail}</span>
          </ButtonLink>
        </span>
      ) : null}
      {region}
    </div>
  );
}
