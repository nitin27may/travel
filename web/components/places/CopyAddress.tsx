'use client';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

/** Copies the address to the clipboard and says so. Nothing is sent anywhere: no request, no tracking (LT-M). */
export function CopyAddress({ text, name }: { text: string; name: string }) {
  const { toast } = useToast();
  return (
    <Button
      size="sm"
      className="pl-addr-copy"
      aria-label={`Copy address of ${name}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast({ message: 'Address copied' });
        } catch {
          toast({ message: 'Could not copy the address' });
        }
      }}
    >
      <Icon name="copy" size={14} /> Copy address
    </Button>
  );
}
