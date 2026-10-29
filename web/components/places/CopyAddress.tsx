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
  // the name starts with the visible words (WCAG 2.5.3, axe label-content-name-mismatch), then says which place
  const label = withPoint ? 'Copy address and point' : 'Copy address';
  return (
    <Button
      size="sm"
      className="pl-addr-copy"
      aria-label={`${label} of ${name}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast({ message: withPoint ? 'Address and map point copied' : 'Address copied' });
        } catch {
          toast({ message: 'Could not copy the address' });
        }
      }}
    >
      <Icon name="copy" size={14} /> {label}
    </Button>
  );
}
