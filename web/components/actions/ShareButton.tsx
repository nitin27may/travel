'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

/**
 * Share (patterns 3.6): the native share sheet where the browser has one (phones), otherwise the link goes to the
 * clipboard with a "Link copied" toast. Final props (lane L0): `{ url, title }`. Pass the canonical URL with the anchor or
 * list state already on it (see `shareUrl` and `listShareUrl` in lib/export/share).
 */
export interface ShareButtonProps {
  url: string;
  title: string;
}

export function ShareButton({ url, title }: ShareButtonProps) {
  const { toast } = useToast();
  // Desktop browsers that expose share() show a system dialog nobody asked for; only coarse-pointer devices get it.
  const native = useSyncExternalStore(
    () => () => undefined,
    () => typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches,
    () => false,
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: 'Link copied' });
    } catch {
      toast({ message: 'Could not copy the link' });
    }
  };

  return (
    <Button
      data-share={native ? 'native' : 'copy'}
      aria-label={`Share ${title}`}
      onClick={async () => {
        if (native) {
          try {
            await navigator.share({ title, url });
          } catch (e) {
            // Closing the sheet is an AbortError, not a failure.
            if (!(e instanceof DOMException && e.name === 'AbortError')) await copy();
          }
          return;
        }
        await copy();
      }}
    >
      <Icon name="share" size={15} /> Share
    </Button>
  );
}

export { shareUrl, listShareUrl } from '@/lib/export/share';

/** "Copy link to this day" for an expanded day row: copies `/trips/<slug>/#day-<n>` and says so. */
export function CopyDayLink({ trip, day }: { trip: { slug: string; title: string }; day: number }) {
  const { toast } = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={`Copy link to day ${day}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}/trips/${trip.slug}/#day-${day}`);
          toast({ message: `Link to day ${day} copied` });
        } catch {
          toast({ message: 'Could not copy the link' });
        }
      }}
    >
      <Icon name="link" size={14} /> Copy link to this day
    </Button>
  );
}
