'use client';

// Who is going, for the builder: the device party, which the account seeds when signed in (ACCT-P) and the party editor writes. Household data: it is read here and sent in the build body only, never saved in a document, a URL or a log.
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PARTY, type Party } from '@travel/core/trips/party.ts';
import { PARTY_CHANGED_EVENT, readParty, readPartySource, writeParty } from '@/lib/storage/partyKey';

export interface PartyState {
  party: Party;
  /** a party is kept on this device (else the default of two adults is shown) */
  kept: boolean;
  /** the account seeded it */
  fromAccount: boolean;
  set: (p: Party) => boolean;
}

export function useParty(): PartyState {
  const [state, setState] = useState<{ party: Party; kept: boolean; fromAccount: boolean }>({ party: DEFAULT_PARTY, kept: false, fromAccount: false });
  useEffect(() => {
    const read = () => {
      const p = readParty();
      setState({ party: p ?? DEFAULT_PARTY, kept: p !== null, fromAccount: readPartySource() !== null });
    };
    read();
    addEventListener(PARTY_CHANGED_EVENT, read);
    addEventListener('storage', read);
    return () => {
      removeEventListener(PARTY_CHANGED_EVENT, read);
      removeEventListener('storage', read);
    };
  }, []);
  const set = useCallback((p: Party) => writeParty(p), []);
  return { ...state, set };
}
