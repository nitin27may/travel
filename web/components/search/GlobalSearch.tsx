'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useState } from 'react';
import { SearchInput } from '@/components/ui/Input';

/**
 * STUB (lane L0, handed to L1). Final props; the placeholder renders the search field and a note.
 * L1 replaces the body with grouped results (trips, places, countries) and keeps `{ open, onClose }`.
 */
export interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [q, setQ] = useState('');
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="scrim" />
        <Dialog.Popup className="search-dialog" data-stub="GlobalSearch" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Search trips, places and countries</Dialog.Title>
          <SearchInput value={q} onChange={setQ} label="Search trips, places and countries" autoFocus />
          <p className="search-dialog-note">Search across trips and places arrives with the home page.</p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
