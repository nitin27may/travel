'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ageText, partyText, PARTY_MAX_ADULTS, type Party } from '@travel/core/trips/party.ts';
import { ageNeedsCheck, ageNow, grownUp, partyOf, refreshAges, type Travellers } from '@travel/core/schema/travellers.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Menu } from '@/components/ui/Menu';
import { useToast } from '@/components/ui/Toast';
import { formFromParty, formFromTravellers, emptyForm, localDay, type TravellersForm } from '@/lib/account/travellers-form';
import { dropForeignParty, keepPartyAsOwn, prefillParty, seedParty, setAccountParty } from '@/lib/account/seed-party';
import { readParty } from '@/lib/storage/partyKey';
import { leaveSession } from '@/lib/auth/session-lost';
import { removeTravellers, saveTravellers, type TravellersResult } from './actions';
import { TravellersEditor, type EditorOutcome } from './TravellersEditor';

const EDIT_ID = 'acct-trav-edit';

interface Props {
  userId: string;
  /** `accountHash(userId)`, computed on the server: the owner tag of the party this page writes (review ACCT-PSEC B2). */
  owner: string;
  travellers: Travellers | null;
  /** A stored document no longer parses (kept in the row, never shown): offer to save again. */
  invalid: boolean;
  revision: number;
  /** The server's UTC day, for the words and ages shown at first paint. */
  today: string;
}

/** What a guarded write answered, as the editor's outcome. */
function outcomeOf(r: TravellersResult): 'saved' | 'conflict' | 'failed' | 'unauthenticated' {
  if (r.kind === 'saved') return 'saved';
  if (r.kind === 'conflict') return 'conflict';
  return r.reason === 'UNAUTHENTICATED' ? 'unauthenticated' : 'failed';
}

/**
 * Travellers, settled (spec 2.4): the party in words and a second line, Edit in place (P5), More with Remove (destructive, with Undo),
 * and the notices, each a Banner inside this section: the device party differs, a child is now 18, the ages are a year old, storage is
 * blocked, another device saved first. After hydration it seeds the device party from the account (5.2); it never writes back from the
 * device on its own (5.3).
 */
export function TravellersSection({ userId, owner, travellers, invalid, revision: initialRevision, today }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [doc, setDoc] = useState(travellers);
  const [revision, setRevision] = useState(initialRevision);
  const [editing, setEditing] = useState<TravellersForm | null>(null);
  const [lead, setLead] = useState<string | null>(null);
  const [editorDay, setEditorDay] = useState(today);
  const [confirming, setConfirming] = useState(false);
  const [differs, setDiffers] = useState<Party | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [kept, setKept] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const returnFocus = useRef(false);

  // Seed the device from the account once the page is hydrated (spec 5.2). A party this browser chose itself is left alone; one another
  // account wrote is replaced, or removed when this account has nothing saved (B2).
  useEffect(() => {
    if (!travellers) {
      dropForeignParty(owner);
      return;
    }
    const out = seedParty(partyOf(travellers, today), owner);
    /* eslint-disable react-hooks/set-state-in-effect -- the seed reads this browser's storage, which only exists after mount */
    if (out === 'blocked') setBlocked(true);
    else if (out === 'differs') setDiffers(readParty());
    /* eslint-enable react-hooks/set-state-in-effect */
    // seeded once per page load: the props are the server's read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      document.getElementById(EDIT_ID)?.focus();
    }
  }, [editing]);

  const open = (form: TravellersForm, line: string | null = null) => {
    setEditorDay(localDay(new Date()));
    setLead(line);
    setFailed(false);
    setEditing(form);
  };
  const close = () => {
    setEditing(null);
    returnFocus.current = true;
  };

  /** Apply the answer of a write to this page. Returns false when the page should stop (the session ended). */
  function settle(r: TravellersResult, next: Travellers | null): boolean {
    const o = outcomeOf(r);
    if (o === 'unauthenticated') {
      leaveSession();
      return false;
    }
    if (o === 'conflict') {
      setConflict(true);
      return false;
    }
    if (o === 'failed' || r.kind !== 'saved') {
      setFailed(true);
      return false;
    }
    setConflict(false);
    setFailed(false);
    setDoc(next);
    setRevision(r.revision);
    return true;
  }

  async function saveFromEditor(next: Travellers): Promise<EditorOutcome> {
    const r = await saveTravellers(userId, { doc: next, revision });
    if (outcomeOf(r) === 'unauthenticated') {
      leaveSession();
      return 'handled';
    }
    if (r.kind === 'conflict') {
      setConflict(true);
      return 'conflict';
    }
    if (r.kind !== 'saved') return 'failed';
    setConflict(false);
    setDoc(next);
    setRevision(r.revision);
    setBlocked(!setAccountParty(partyOf(next, editorDay), owner));
    setDiffers(null);
    close();
    return 'saved';
  }

  /** "Looks right", "Move to adults", Undo: a save that is not the editor's. */
  async function saveDirect(next: Travellers, atRevision = revision): Promise<boolean> {
    setBusy(true);
    try {
      const r = await saveTravellers(userId, { doc: next, revision: atRevision });
      if (!settle(r, next)) return false;
      const out = seedParty(partyOf(next, localDay(new Date())), owner);
      setBlocked(out === 'blocked');
      setDiffers(out === 'differs' ? readParty() : null);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!doc) return;
    const before = doc;
    setBusy(true);
    try {
      const r = await removeTravellers(userId, { revision });
      if (!settle(r, null) || r.kind !== 'saved') return;
      keepPartyAsOwn(owner);
      setConfirming(false);
      setDiffers(null);
      returnFocus.current = true;
      const gone = r.revision;
      toast({ message: 'Travellers removed.', actionLabel: 'Undo', onAction: () => void saveDirect(before, gone) });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const party = doc ? partyOf(doc, today) : null;
  const grown = doc ? grownUp(doc, today).filter((i) => !kept.includes(i)) : [];
  const first = grown[0];
  const check = doc && grown.length === 0 && ageNeedsCheck(doc, today);

  const notices = (
    <>
      {differs && doc ? (
        <Banner
          kind="notice"
          className="acct-notice"
          action={
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  setBlocked(!setAccountParty(partyOf(doc, today), owner));
                  setDiffers(null);
                }}
              >
                Use saved travellers here
              </Button>
              <Button size="sm" onClick={() => open(formFromParty(differs))}>
                Save this browser&apos;s party
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDiffers(null)}>
                Dismiss
              </Button>
            </>
          }
        >
          This browser plans for {partyText(differs, ' and ')}. Your saved travellers: {partyText(party as Party, ' and ')}.
        </Banner>
      ) : null}
      {doc && first !== undefined ? (
        <Banner
          kind="notice"
          className="acct-notice"
          action={
            <>
              {doc.adults < PARTY_MAX_ADULTS ? (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void saveDirect({ ...doc, adults: doc.adults + 1, children: doc.children.filter((_, i) => i !== first) })}
                >
                  Move to adults
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setKept((k) => [...k, first])}>
                Keep as a child
              </Button>
            </>
          }
        >
          Child {first + 1} is now {ageNow(doc.children[first], today)}. Count them as an adult?
        </Banner>
      ) : null}
      {doc && check ? (
        <Banner
          kind="notice"
          className="acct-notice"
          action={
            <>
              <Button size="sm" variant="primary" disabled={busy} onClick={() => void saveDirect(refreshAges(doc, localDay(new Date())))}>
                Looks right
              </Button>
              <Button size="sm" onClick={() => open(formFromTravellers(doc, localDay(new Date())))}>
                Edit
              </Button>
            </>
          }
        >
          Are these ages still right? {party && party.children.length ? party.children.map(ageText).join(', ') : 'Adults'}.
        </Banner>
      ) : null}
      {blocked ? <Banner kind="notice" className="acct-notice">Saved to your account. This browser can&apos;t keep a copy, so trip pages here use the trip as written.</Banner> : null}
      {conflict ? (
        <Banner
          kind="notice"
          className="acct-notice"
          action={
            <Button size="sm" onClick={() => router.refresh()}>
              Show the latest
            </Button>
          }
        >
          Your travellers were changed on another device.
        </Banner>
      ) : null}
      {invalid && !doc ? <Banner kind="notice" className="acct-notice">Your saved travellers could not be read. Add them again.</Banner> : null}
      {failed && !editing ? <Banner kind="notice" className="acct-notice">We couldn&apos;t save. Your changes are still here; try again.</Banner> : null}
    </>
  );

  const editor = editing ? (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }}
    >
      <TravellersEditor
        initial={editing}
        today={editorDay}
        autoFocus
        lead={lead ? <p className="acct-note">{lead}</p> : undefined}
        onSave={saveFromEditor}
        actions={
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
        }
      />
    </div>
  ) : null;

  if (!doc) {
    return (
      <>
        {notices}
        {editing ? (
          <div className="acct-card">{editor}</div>
        ) : (
          <EmptyState
            glyph="user"
            as="h3"
            title="No travellers saved."
            why="Add who usually travels with you, and every trip starts from it."
            action={
              <Button
                id={EDIT_ID}
                variant="primary"
                onClick={() => {
                  const device = prefillParty(owner);
                  open(device ? formFromParty(device) : emptyForm(), device ? `Filled in from this browser: ${partyText(device, ', ')}. Check the ages and save.` : null);
                }}
              >
                Add travellers
              </Button>
            }
          />
        )}
      </>
    );
  }

  return (
    <>
      {notices}
      <div className="acct-card">
        <div className="acct-row">
          <div className="acct-row-main">
            <span className="acct-label">Party</span>
            <span className="acct-value">{partyText(party as Party)}</span>
            <span className="acct-note">Ages today. Trips use these, and you can change the party on any trip.</span>
          </div>
          {editing ? null : (
            <div className="acct-row-actions">
              <Button id={EDIT_ID} className="acct-row-action" size="sm" onClick={() => open(formFromTravellers(doc, localDay(new Date())))} aria-label="Edit travellers">
                Edit
              </Button>
              <Menu
                triggerClassName="btn btn-sm acct-more"
                triggerLabel="More"
                trigger={<span>More</span>}
                align="end"
                entries={[{ label: 'Remove saved travellers', destructive: true, separatorBefore: true, onSelect: () => setConfirming(true) }]}
              />
            </div>
          )}
        </div>
        {confirming && !editing ? (
          <div className="acct-editor" role="group" aria-label="Remove saved travellers">
            <p className="acct-line">Remove your saved travellers? This browser keeps its party until you change it.</p>
            <div className="acct-editor-actions">
              <Button variant="danger" loading={busy} onClick={() => void remove()}>
                Remove
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {editor}
      </div>
    </>
  );
}
