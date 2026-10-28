'use client';

import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { sizedImage } from '@/lib/format/image';
import type { SyncWord } from '@/lib/trip-edit/open';
import { Icon } from '@/components/ui/Icon';
import './shell.css';

/** The sync word of edit-mode-spec 12: one quiet word with a dot, "Not synced · Retry" as a 44 px button, never colour alone. */
export function SyncState({ word, onRetry }: { word: SyncWord; onRetry: (() => void) | null }) {
  const retry = word === 'Not synced · Retry';
  return (
    <span className="own-sync num" data-busy={word === 'Syncing' || undefined} data-retry={retry || undefined} role="status">
      {word === 'In your account' ? <Icon name="cloud" size={14} className="own-sync-ico" /> : word === 'On this device' ? <Icon name="device" size={14} className="own-sync-ico" /> : <span className="own-dot" aria-hidden="true" />}
      {retry && onRetry ? (
        <>
          Not synced
          <button type="button" className="own-retry" onClick={onRetry}>Retry</button>
        </>
      ) : (
        word
      )}
    </span>
  );
}

/** A 32 px cell with the trip's photo in its colour ring, then its title: the sticky bar's lead (scenario rule 1). */
export function IdentityCell({ title, photo, identity }: { title: string; photo: string | null; identity?: string }) {
  return (
    <span className="own-id" data-testid="own-identity">
      <span className="own-id-cell" style={{ ['--tc' as string]: `var(--id-${identity ?? 'none'})` }} aria-hidden="true">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- the build's own rendition
          <img src={sizedImage(photo, 320)} alt="" width={32} height={32} loading="lazy" decoding="async" />
        ) : (
          <Icon name="mountain" size={16} />
        )}
      </span>
      <span className="own-id-title">{title}</span>
    </span>
  );
}

/** The first read of the document and the plan model: the cover and three day cards as skeletons (components 6.2). */
export function TripSkeleton() {
  return (
    <div className="own-state-page" aria-busy="true" aria-label="Loading your trip" role="status">
      <div className="own-sk-cover">
        <Skeleton className="sk-fill" />
      </div>
      <div className="own-sk-days">
        <Skeleton height={64} width="100%" />
        <Skeleton height={64} width="100%" />
        <Skeleton height={64} width="100%" />
      </div>
    </div>
  );
}

/** Not on this device and not in this account; another account's id reads the same (no existence signal, edit-mode-spec 15). */
export function NotFound() {
  return (
    <EmptyState
      glyph="info"
      title="This trip is not on this device or in your account."
      why="Trips you copy are kept in this browser, or in your account when you are signed in."
      action={<ButtonLink variant="primary" href="/mine/">Open Mine</ButtonLink>}
    />
  );
}

/** A document written by a newer version of the site: read-only, nothing is changed. */
export function Newer() {
  return (
    <EmptyState
      quiet
      glyph="warn"
      title="This trip was changed by a newer version of the site"
      why="Reload the page to open it. Nothing has been changed."
      action={<button type="button" className="btn btn-primary" onClick={() => location.reload()}>Reload</button>}
    />
  );
}

/** A built trip with no build yet: resume never builds by itself (TF14). */
export function NotBuilt({ id }: { id: string }) {
  return (
    <EmptyState
      glyph="info"
      title="Not built yet"
      why="This trip has places but no days yet."
      action={<ButtonLink variant="primary" href={`/plan/?draft=${id}&s=4`}>Open the builder</ButtonLink>}
    />
  );
}

/** "4 changes from our plan · Show": one collapsed line above Day 1 (P3); Show opens the changes sheet (edit-mode-spec 10). */
export function ChangesLine({ text, onShow }: { text: string; onShow: () => void }) {
  return (
    <p className="own-changes-line" data-print="hide">
      <b>{text}</b> · <button type="button" className="own-link" onClick={onShow}>Show</button>
    </p>
  );
}
