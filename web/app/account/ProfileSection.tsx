'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { Banner } from '@/components/ui/Banner';
import { useToast } from '@/components/ui/Toast';
import { checkName, nameError, NAME_COPY } from '@/lib/account/name';
import { leaveSession } from '@/lib/auth/session-lost';
import { saveName } from './actions';

// A paste far past the limit is cut by the browser; the check still says 'too long' for anything the box lets through.
const NAME_MAX_INPUT = 120;
const EDIT_ID = 'acct-name-edit';

/**
 * Profile (spec 2.4): the name row, with the editor opening in place under it (P5). The saved name is the one the action validated and
 * returned: the SDK's answer carries no user, and re-reading the session would still show the old name for up to five minutes (spec 4.3).
 */
export function ProfileSection({ userId, initialName }: { userId: string; initialName: string }) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function open() {
    setDraft(name);
    setError(null);
    setFailed(false);
    setEditing(true);
  }
  function close() {
    setEditing(false);
    returnFocus.current = true; // the Edit button is drawn again by this change; focus goes back to it once it is there
  }
  const returnFocus = useRef(false);
  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      document.getElementById(EDIT_ID)?.focus();
    }
  }, [editing]);

  const check = checkName(draft);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (!check.ok) {
      setError(nameError(check.reason));
      return;
    }
    if (check.name === name) {
      close();
      return;
    }
    setError(null);
    setFailed(false);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveName>>;
      try {
        result = await saveName(userId, { name: check.name });
      } catch {
        setFailed(true);
        return;
      }
      if (result.kind === 'saved') {
        setName(result.name);
        toast({ message: 'Name saved.' });
        close();
      } else if (result.reason === 'UNAUTHENTICATED') {
        leaveSession();
      } else if (result.reason === 'INVALID_INPUT') {
        setError(nameError(result.field));
      } else if (result.reason === 'RATE_LIMITED') {
        setError(NAME_COPY.rate);
      } else {
        setFailed(true);
      }
    });
  }

  return (
    <div className="acct-card">
      <div className="acct-row">
        <div className="acct-row-main">
          <span className="acct-label">Name</span>
          <span className={name ? 'acct-value' : 'acct-value acct-value-empty'}>{name || 'Not set'}</span>
        </div>
        {editing ? null : (
          <Button id={EDIT_ID} className="acct-row-action" size="sm" onClick={open} aria-label={name ? 'Edit name' : 'Add a name'}>
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <form className="acct-editor" onSubmit={onSubmit} noValidate>
          <Field label="Your name" help="Shown only to you, here and in the menu." error={error ?? undefined}>
            {(a) => (
              <Input
                autoFocus
                name="name"
                autoComplete="name"
                value={draft}
                maxLength={NAME_MAX_INPUT}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    close();
                  }
                }}
                {...a}
                error={error !== null}
              />
            )}
          </Field>
          {failed ? <Banner kind="notice">We couldn&apos;t save. Your changes are still here; try again.</Banner> : null}
          <div className="acct-editor-actions">
            <Button type="submit" variant="primary" loading={pending}>
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
