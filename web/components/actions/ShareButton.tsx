'use client';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

/**
 * STUB (lane L0, handed to L5). Final props; the placeholder copies the link and says so in a toast.
 * L5 adds the native share sheet and keeps `{ url, title }`.
 */
export interface ShareButtonProps {
  url: string;
  title: string;
}

export function ShareButton({ url, title }: ShareButtonProps) {
  const { toast } = useToast();
  return (
    <Button
      data-stub="ShareButton"
      aria-label={`Share ${title}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast({ message: 'Link copied' });
        } catch {
          toast({ message: 'Could not copy the link' });
        }
      }}
    >
      <Icon name="share" size={15} /> Share
    </Button>
  );
}
