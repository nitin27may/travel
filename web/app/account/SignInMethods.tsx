'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/auth/live';
import { googleAuthorizeUrl } from '@/lib/auth/google';
import {
  ADD_RETURN_PARAMS,
  GOOGLE_PERMISSIONS_URL,
  WAYS_COPY,
  addReturnText,
  addStartText,
  addedDate,
  removeText,
  waysView,
  type WayRow,
} from '@/lib/auth/ways';
import { listWays, markGoogleAdd, takeGoogleAdd, waysCall } from './ways-api';

interface Props {
  /** Provider and date of each way in, read on the server (`accountWays`); null when they could not be read. */
  rows: WayRow[] | null;
  /** `maskAddress(user.email)` (W6). */
  masked: string;
  /** `signInGoogle`: off leaves the rows read-only (string 50). */
  googleOn: boolean;
  /** The return of Add Google with a Google row from the last minutes (decided on the server from the rows): string 35. */
  justAdded: boolean;
  /** The privacy contact for string 51. */
  contact: string;
}

/** The masked address never breaks after its ellipsis ("n…" then "@gmail.com" on the next line), as in the landing notice. */
function keepAddress(text: string, masked: string) {
  const at = text.indexOf(masked);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="ways-address">{masked}</span>
      {text.slice(at + masked.length)}
    </>
  );
}

/**
 * Account: Ways to sign in (GSI-WAYS; copy page 2.5, strings 29 to 51; Google spec 5.1 L4 to L6). Email is always a way in (A1);
 * Password shows when Neon keeps a password row; Google shows with the date it was added, with Remove behind an inline confirm, or Add
 * Google when it is not there. The guard decides every change again on the server (the last way in is never removed there either).
 *
 * Focus: the confirm opens in place with focus on Keep Google (first in tab order, patterns 4.4); Keep and Esc close it and return
 * focus to Remove; after a removal focus goes to Add Google (string 46). Every notice is read once by the polite live region.
 */
export function SignInMethods({ rows: initialRows, masked, googleOn, justAdded, contact }: Props) {
  const [rows, setRows] = useState<WayRow[] | null>(initialRows);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<'add' | 'remove' | null>(null);
  const { region, announce } = useAnnouncer();
  const sectionRef = useRef<HTMLElement>(null);
  const focusNext = useRef<'add' | 'remove' | 'keep' | null>(null);
  const read = useRef(false);
  const ids = useId();
  const titleId = `${ids}-remove-title`;
  const bodyId = `${ids}-remove-body`;
  const helpId = `${ids}-add-help`;

  const show = useCallback(
    (text: string) => {
      setNotice(text);
      announce(text);
    },
    [announce],
  );

  // The return of Add Google, read once: string 35 from the server's rows, or the `error` Neon appended after this tab's press. The
  // return parameters leave the address at once; the raw `error` is never shown.
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const url = new URL(window.location.href);
    const fresh = takeGoogleAdd(Date.now());
    const returned = url.searchParams.has(ADD_RETURN_PARAMS[0]);
    const error = url.searchParams.get('error');
    let text: string | null = null;
    if (justAdded) text = WAYS_COPY.added;
    else if (fresh && error !== null) text = addReturnText(error, masked);
    else if (fresh && returned) text = WAYS_COPY.addFailed;
    let changed = false;
    for (const p of ADD_RETURN_PARAMS) {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (text) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the return (address and this tab's storage) after mount
      show(text);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      sectionRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [justAdded, masked, show]);

  // Back from Google restores this page from the back-forward cache with the spinner still on: reset it.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPending(null);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  // Focus moves after the render that shows its target.
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    sectionRef.current?.querySelector<HTMLButtonElement>(`[data-ways-focus="${target}"]`)?.focus();
  });

  const view = rows ? waysView(rows) : null;

  async function add() {
    setNotice(null);
    setPending('add');
    const a = await waysCall('link-social', { provider: 'google' });
    const url = a.status === 200 ? googleAuthorizeUrl(a.body) : null;
    if (url) {
      markGoogleAdd(Date.now());
      window.location.assign(url);
      return; // the spinner stays while the browser leaves
    }
    setPending(null);
    if (a.status === 409 && a.code === 'ALREADY_ADDED') {
      const fresh = await listWays();
      if (fresh) setRows(fresh);
      show(WAYS_COPY.added);
      return;
    }
    show(addStartText(a));
  }

  function openConfirm() {
    setNotice(null);
    setConfirming(true);
    focusNext.current = 'keep';
  }

  function keep() {
    setConfirming(false);
    focusNext.current = 'remove';
  }

  async function remove() {
    setPending('remove');
    const a = await waysCall('unlink-account', { providerId: 'google' });
    setPending(null);
    setConfirming(false);
    if (a.status === 200) {
      const fresh = await listWays();
      setRows(fresh ?? (rows ?? []).filter((r) => r.providerId !== 'google'));
      show(WAYS_COPY.removed);
      focusNext.current = 'add';
      return;
    }
    if (a.code === 'LAST_METHOD' || a.code === 'NOT_LINKED') {
      const fresh = await listWays();
      if (fresh) setRows(fresh);
    }
    show(removeText(a));
    focusNext.current = 'remove';
  }

  const googleRow = view?.google != null;

  return (
    <section className="account-ways" aria-labelledby="ways-to-sign-in" ref={sectionRef}>
      <h2 id="ways-to-sign-in" className="ways-title">
        {WAYS_COPY.title}
      </h2>
      {notice ? (
        <div className="ban ban-notice ways-notice">
          <Icon name="info" size={16} />
          <p className="ban-text">{keepAddress(notice, masked)}</p>
        </div>
      ) : null}
      {region}
      <ul className="ways-list">
        <li className="ways-row" data-way="email">
          <div className="ways-main">
            <p className="ways-name">
              <span className="ways-label">{WAYS_COPY.email}</span>
              <span className="ways-sep" aria-hidden="true">
                {' · '}
              </span>
              <span className="sr-only">, </span>
              <span className="ways-detail">{WAYS_COPY.emailDetail}</span>
            </p>
          </div>
        </li>
        {view?.password ? (
          <li className="ways-row" data-way="password">
            <div className="ways-main">
              <p className="ways-name">
                <span className="ways-label">{WAYS_COPY.password}</span>
                <span className="ways-sep" aria-hidden="true">
                  {' · '}
                </span>
                <span className="sr-only">, </span>
                <span className="ways-detail">{WAYS_COPY.passwordDetail}</span>
              </p>
            </div>
          </li>
        ) : null}
        {view ? (
          <li className="ways-row" data-way="google" data-state={googleRow ? 'added' : 'none'}>
            <div className="ways-main">
              <p className="ways-name">
                <span className="ways-label">{WAYS_COPY.google}</span>
                {googleRow ? (
                  <>
                    <span className="ways-sep" aria-hidden="true">
                      {' · '}
                    </span>
                    <span className="sr-only">, </span>
                    <span className="ways-detail">{WAYS_COPY.googleAdded(addedDate(view.google as number))}</span>
                  </>
                ) : null}
              </p>
              {!googleOn ? (
                <p className="ways-note">{WAYS_COPY.off}</p>
              ) : googleRow ? (
                <>
                  {view.googleOnly ? <p className="ways-note">{WAYS_COPY.removeLast}</p> : null}
                  <p className="ways-note">{WAYS_COPY.signOutNote}</p>
                </>
              ) : (
                <p className="ways-note" id={helpId}>
                  {keepAddress(WAYS_COPY.addHelp(masked), masked)}
                </p>
              )}
            </div>
            {googleOn ? (
              <div className="ways-action">
                {googleRow ? (
                  view.googleOnly ? null : (
                    <Button data-ways-focus="remove" variant="ghost" size="sm" onClick={openConfirm} aria-expanded={confirming}>
                      {WAYS_COPY.remove}
                      <span className="sr-only">{WAYS_COPY.removeTail}</span>
                    </Button>
                  )
                ) : (
                  <Button data-ways-focus="add" variant="secondary" onClick={add} loading={pending === 'add'} aria-describedby={helpId}>
                    {WAYS_COPY.add}
                  </Button>
                )}
              </div>
            ) : null}
            {confirming && googleRow ? (
              <div
                className="ways-confirm"
                role="dialog"
                aria-labelledby={titleId}
                aria-describedby={bodyId}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && pending !== 'remove') {
                    e.stopPropagation();
                    keep();
                  }
                }}
              >
                <p className="ways-confirm-title" id={titleId}>
                  {WAYS_COPY.removeTitle}
                </p>
                <div id={bodyId} className="ways-confirm-body">
                  <p>{WAYS_COPY.removeBody}</p>
                  <p>
                    {WAYS_COPY.removeGoogleSideBefore}
                    <a href={GOOGLE_PERMISSIONS_URL} target="_blank" rel="noopener noreferrer">
                      {WAYS_COPY.removeGoogleSideLink}
                      <span className="sr-only">{WAYS_COPY.newTab}</span>
                    </a>
                    {WAYS_COPY.removeGoogleSideAfter}
                  </p>
                </div>
                <div className="ways-confirm-actions">
                  <Button data-ways-focus="keep" variant="secondary" onClick={keep} disabled={pending === 'remove' || undefined}>
                    {WAYS_COPY.removeKeep}
                  </Button>
                  <Button variant="danger" onClick={remove} loading={pending === 'remove'}>
                    {WAYS_COPY.removeConfirm}
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ) : (
          <li className="ways-row" data-way="unreadable">
            <div className="ways-main">
              <p className="ways-note">{WAYS_COPY.unreadable}</p>
            </div>
          </li>
        )}
      </ul>
      <p className="ways-foot">
        {WAYS_COPY.deleteBefore}
        <a href={`mailto:${contact}`}>{contact}</a>
        {WAYS_COPY.deleteAfter}
      </p>
    </section>
  );
}
