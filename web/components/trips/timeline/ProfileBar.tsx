'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { serialiseTimelineUrl } from '@travel/core/schedule/profileCodec.ts';
import type { Profile } from '@travel/core/schedule/types.ts';
import type { Party } from '@travel/core/trips/party.ts';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { registerParty } from '@/lib/export/timelineState';
import { PARTY_KEY, TRIPUI_KEY } from '@/lib/storage/deviceKeys';
import { readLocal } from '@/lib/storage/safe';
import '@/styles/party-bar.css';
import { useTripUrl } from '../useTripUrl';
import { railOpen, setRailParty } from './railWords';
import { serverBarWords } from './serverWords';
import type { TimelineModel } from './model';
import type { TimelineApi } from './useTimeline';

// The bar imports no runtime code from core `party.ts` (Turbopack does not tree-shake it, and it is about 1.7 KB gzipped): the words, the
// landing rule and the device keys live in `partyLogic`, one lazy chunk loaded only when the bar has something to say. The editor is a second
// lazy chunk, loaded on Edit (spec 5.5). A first-time visitor on the plan's own settings loads neither; the server's words stay on screen.
type Logic = typeof import('./partyLogic');
const logicChunk = (): Promise<Logic> => import('./partyLogic');
const editorChunk = () => import('./PartyEditor').then((m) => m.PartyEditor);
const prefetch = () => {
  void editorChunk();
  void logicChunk();
};
const toggleEl = () => document.querySelector<HTMLButtonElement>('#plan-for .pb-edit');
const PartyEditor = dynamic(editorChunk, {
  ssr: false,
  loading: () => (
    <p role="status" className="pb-loading">
      Loading the editor
    </p>
  ),
});

const DEVICE_KEYS = [PARTY_KEY, TRIPUI_KEY] as const;

type Mode = 'written' | 'device' | 'shared';

/** The party a profile implies, with no richer knowledge: the adults and one child of the youngest age (10 when unset: DEFAULT_CHILD_AGE, FAMAGE10; a unit test pins the two together). */
const impliedParty = (p: Pick<Profile, 'party' | 'youngest' | 'adults'>): Party => ({ adults: p.adults, children: p.party === 'family' ? [p.youngest ?? 10] : [] });

/**
 * "Plan it for": one 56 px line with the party in words and a pencil Edit (spec 5.2, wireframe W3). The editor opens inline under it and
 * grows from the bar. The party is household data: it is kept on this device only (`travel.party`, through safe.ts), the link carries
 * the youngest age and the adult count, and nothing here reaches the export, analytics or a request.
 */
export function ProfileBar({ model, api, edit, setEdit }: { model: TimelineModel; api: TimelineApi; edit: boolean; setEdit: (v: boolean) => void; label?: string }) {
  const url = useTripUrl();
  const p = api.state.profile;
  const slug = model.slug;
  const defaults = useMemo(() => ({ ...model.defaultProfile, adults: 2 }), [model.defaultProfile]);
  /** The party this visitor is working with (kept on the device, or set in the editor); null while the plan's own or a link's party stands. */
  const [work, setWork] = useState<Party | null>(null);
  const [mode, setMode] = useState<Mode>('written');
  /** Opened from Mine (`mine=1`): the shared plan is the visitor's own copy. */
  const [own, setOwn] = useState(false);
  const [offer, setOffer] = useState<Party | null>(null);
  const [kept, setKept] = useState(true);
  const [need, setNeed] = useState(false);
  const [logic, setLogic] = useState<Logic | null>(null);
  const [opened, setOpened] = useState(false);
  const [arrived, setArrived] = useState(false);
  const seen = useRef(false);
  const restored = useRef(false);
  /** An editing session: the first change pushes a history entry, the rest replace it (Back leaves the trip, not each keystroke). */
  const session = useRef(false);
  const fromRail = useRef(false);

  // Landing (Q295), after hydration: a link with party keys is a shared plan; storage that holds something asks for the logic chunk.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of browser-only state (the address bar, localStorage) after hydration */
  useEffect(() => {
    const shared = /[?&](p|a)=/.test(window.location.search);
    if (shared) setMode('shared');
    if (/[?&]mine=1(&|$)/.test(window.location.search)) setOwn(true);
    if (shared || DEVICE_KEYS.some((k) => readLocal(k) !== null)) setNeed(true);
  }, []);
  // the logic loads when something needs words other than the server's: a changed plan, a shared link, a kept party, the editor
  const want = need || edit || api.changed;
  useEffect(() => {
    if (!want || logic) return;
    let live = true;
    void logicChunk().then((m) => live && setLogic(m));
    return () => {
      live = false;
    };
  }, [want, logic]);
  useEffect(() => {
    if (!logic || arrived) return;
    setArrived(true);
    const a = logic.arrive(slug, defaults);
    setMode(a.land.mode);
    setOffer(a.land.offer);
    if (a.useDevice) setWork(a.device);
    // a replace, not a push: Back from the applied party must leave the page, not land on the link that applies it again
    if (a.timeline !== null) url.go({ hash: url.hash || undefined, timeline: a.timeline }, 'replace');
    if (a.open) {
      restored.current = true;
      setEdit(true);
    }
    // once, when the logic first arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logic]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // the editor chunk loads on the first open; it stays mounted so the close can animate
  if (edit && !opened) setOpened(true);
  useEffect(() => {
    if (seen.current) void logicChunk().then((m) => m.rememberOpen(edit));
    seen.current = true;
    session.current = false; // an open or a close ends the session
    if (edit) {
      fromRail.current = railOpen.from;
      railOpen.from = false;
    }
  }, [edit]);
  // opened from the sticky rail: focus lands on Done, where Escape and Done will return it
  useEffect(() => {
    if (restored.current) {
      restored.current = false; // reopened from the last visit: nothing was asked for, so focus stays where it is
      return;
    }
    // Safari does not focus a button on click, so "not inside the bar" is the test, not "something else has focus"
    if (edit && !document.activeElement?.closest('#plan-for')) toggleEl()?.focus({ preventScroll: true });
  }, [edit]);

  const party = logic ? logic.effectiveParty(work, p) : impliedParty(p);
  const shared = mode === 'shared' && !work;
  // the sticky day rail says the same party, in its own words (it owns them)
  const railKey = JSON.stringify(party);
  useEffect(() => {
    setRailParty({ ...(JSON.parse(railKey) as Party), pace: p.pace, shared, own: shared && own });
    return () => setRailParty(null);
  }, [railKey, p.pace, shared, own]);

  /** A profile change from the editor, the offer or the copy sheet: push on the first of an editing session, replace after (review UXB-2 S2). */
  const writeProfile = (patch: Partial<Profile>) => {
    const profile = { ...p, ...patch };
    if (profile.party === 'adults') profile.youngest = null;
    else profile.youngest ??= defaults.youngest ?? 10;
    url.go({ hash: url.hash || undefined, timeline: serialiseTimelineUrl({ ...api.state, profile }, defaults) }, session.current ? 'replace' : 'push');
    session.current = true;
  };

  /** The editor chose a party (it has kept it on the device and written the profile): the bar follows. */
  const chosen = useCallback((next: Party, keptNow: boolean) => {
    setWork(next);
    setMode('written');
    setOffer(null);
    setKept(keptNow);
  }, []);
  const takeOffer = (o: Party) =>
    void logicChunk().then((m) => {
      const r = m.keep(o, slug);
      if (!r.party) return;
      chosen(r.party, r.kept);
      writeProfile(m.whoOf(r.party, p));
    });
  // a party chosen in the copy sheet is the page's party too: kept on the device, then planned for (the sheet's tap is its own session)
  const fromSheet = useRef<(next: Party) => void>(() => undefined);
  useEffect(() => {
    fromSheet.current = (next) =>
      void logicChunk().then((m) => {
        const r = m.keep(next, slug);
        if (!r.party) return;
        chosen(r.party, r.kept);
        session.current = false;
        writeProfile(m.whoOf(r.party, p));
      });
  });
  useEffect(() => {
    registerParty((next) => fromSheet.current(next));
    return () => registerParty(null);
  }, []);
  // Reset is "Plan as written": the plan's own party and settings, and the kept party is not applied again to this trip
  const reset = useCallback(() => {
    void logicChunk().then((m) => m.asWritten(slug));
    setWork(null);
    setMode('written');
    setOffer(null);
    session.current = false;
    api.reset();
  }, [api, slug]);
  const close = useCallback(() => {
    setEdit(false);
    // back where the visitor opened it: the sticky rail's Edit when it was opened from there (review S5), else the bar's own button
    const rail = fromRail.current ? document.querySelector<HTMLButtonElement>('.tl-planbar .tl-railedit') : null;
    fromRail.current = false;
    if (rail) {
      rail.focus({ preventScroll: true });
      rail.scrollIntoView({ block: 'nearest' });
    } else toggleEl()?.focus();
  }, [setEdit]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && edit && !e.defaultPrevented) {
      e.stopPropagation();
      close();
    }
  };

  // Until the logic is here the server's words stand: the spans are given an empty string and React leaves the text it hydrated (suppressHydrationWarning);
  // they are hidden meanwhile when the plan is not the server's, so a shared link never flashes the default party.
  const server = (short: boolean): string => (typeof window === 'undefined' ? serverBarWords(p, p.pace, short) : '');
  const pending = !logic && (api.changed || mode === 'shared');
  return (
    <section className="pb" aria-labelledby="plan-for-h" id="plan-for" data-print="hide" data-open={edit || undefined} onKeyDown={onKeyDown}>
      <div className="pb-row">
        <h2 id="plan-for-h" className="pb-label">
          Plan it for{work ? <span className="pb-yours"> · Your party</span> : null}
        </h2>
        <p className="pb-val num" data-testid="party-line" data-pending={pending || undefined} aria-live="polite" aria-atomic="true">
          <span className="pb-long" suppressHydrationWarning>{logic ? logic.barWords(shared, party, p, p.pace, false, own) : server(false)}</span>
          <span className="pb-short" suppressHydrationWarning>{logic ? logic.barWords(shared, party, p, p.pace, true, own) : server(true)}</span>
        </p>
        {shared ? null : (
          <p className="pb-note">
            {work ? 'Your party' : `Plan as written: ${model.writtenFor}`}
          </p>
        )}
        {offer ? (
          <button type="button" className="pb-offer" onClick={() => takeOffer(offer)}>
            Use my party<span className="pb-offer-w">: {logic?.shortWords(offer)}</span>
          </button>
        ) : null}
        <div className="pb-actions">
          {api.changed ? (
            <button type="button" className="tl-reset pb-reset" title="Reset to the plan as written" onClick={reset}>
              Reset
            </button>
          ) : null}
          <Button
            size="sm"
            className="pb-edit"
            aria-expanded={edit}
            aria-controls="plan-for-controls"
            onClick={() => (edit ? close() : setEdit(true))}
            onPointerEnter={prefetch}
            onFocus={prefetch}
          >
            <Icon name="pencil" size={14} /> {edit ? 'Done' : 'Edit'}
          </Button>
        </div>
      </div>
      <div id="plan-for-controls" className="pb-body" data-open={edit || undefined} inert={!edit}>
        <div className="pb-body-in">{opened ? <PartyEditor model={model} api={api} party={party} onChosen={chosen} onProfile={writeProfile} kept={kept} /> : null}</div>
      </div>
      {api.droppedAdds > 0 ? (
        <p className="tl-profile-note" role="status">
          {api.droppedAdds} added {api.droppedAdds === 1 ? 'place is' : 'places are'} no longer available.
        </p>
      ) : null}
    </section>
  );
}
