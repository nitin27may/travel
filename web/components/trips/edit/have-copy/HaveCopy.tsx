'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CHANGED_EVENT } from '@/lib/mine/keys';
import { localStore } from '@/lib/storage/safe';
import { findCopyId } from './find';
import './have-copy.css';

/**
 * "You have a copy of this trip · Open it" (patterns 3.7): one line under the public trip's cover actions when this device or the
 * signed-in account already holds a copy. A lazy chunk, mounted after hydration by `TripActions` only with `tripEdit` on, so the server
 * HTML and the start JS of `/trips/<slug>/` do not change (EA12). It reads two lists on the device and fetches nothing.
 */
export function HaveCopy({ slug }: { slug: string }) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      const store = localStore();
      try {
        setId(store ? findCopyId(store, slug) : null);
      } catch {
        setId(null);
      }
    };
    read();
    // a copy made, removed or merged in this tab or another changes the answer
    for (const e of [CHANGED_EVENT, 'storage']) addEventListener(e, read);
    return () => {
      for (const e of [CHANGED_EVENT, 'storage']) removeEventListener(e, read);
    };
  }, [slug]);
  if (!id) return null;
  return (
    <p className="have-copy">
      You have a copy of this trip · <Link href={`/t/${id}/`}>Open it</Link>
    </p>
  );
}
