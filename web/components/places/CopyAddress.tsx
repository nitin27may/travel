'use client';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

/**
 * Copies the address as the card shows it ("Near ..." kept) and the point the card goes to, on a second line, and says so (review STEP2-PRV
 * PR-013). Nothing is sent anywhere: no request, no tracking (LT-M).
 */
export function CopyAddress({ text, name }: { text: string; name: string }) {
  const { toast } = useToast();
  const withPoint = text.includes('\n');
  return (
    <Button
      size="sm"
      className="pl-addr-copy"
      aria-label={`Copy the address${withPoint ? ' and map point' : ''} of ${name}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast({ message: withPoint ? 'Address and map point copied' : 'Address copied' });
        } catch {
          toast({ message: 'Could not copy the address' });
        }
      }}
    >
      <Icon name="copy" size={14} /> {withPoint ? 'Copy address and point' : 'Copy address'}
    </Button>
  );
}
