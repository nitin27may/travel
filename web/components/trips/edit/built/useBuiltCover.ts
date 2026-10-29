'use client';

// A built trip has no photo of its own (RB-015). The copy's cover is its public trip's photo; a built trip's is the first of its picks that
// has one, from the same small card file the globe and Mine already read (one file per place, same-origin, never Commons: P8, P9). Nothing
// is asked for a trip that already has a photo.
import { useEffect, useState } from 'react';

const TRY = 4;

/** The `/img/` path of the first picked place with a photo, or null (none yet, none at all, or the card files are not on this site). */
export function useBuiltCover(slugs: readonly string[], enabled: boolean): string | null {
  const key = slugs.slice(0, TRY).join(',');
  const [found, setFound] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!enabled || !key) return;
    let live = true;
    void (async () => {
      const { globeCard } = await import('@/lib/client/data');
      for (const slug of key.split(',')) {
        const f = await globeCard(`place:${slug}`).catch(() => null);
        const url = f?.card.image?.url;
        if (url && url.startsWith('/img/')) {
          if (live) setFound({ key, url });
          return;
        }
      }
      if (live) setFound({ key, url: null });
    })();
    return () => {
      live = false;
    };
  }, [key, enabled]);
  return enabled && found && found.key === key ? found.url : null;
}
