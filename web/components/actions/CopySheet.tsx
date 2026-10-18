'use client';

import { SideSheet } from '@/components/ui/SideSheet';
import { Button } from '@/components/ui/Button';

/**
 * STUB (lane L0, handed to L5). Final props; the placeholder renders a sheet with a note.
 * L5 replaces the body with the start-date picker and traveller toggles, and keeps this prop shape.
 */
export interface CopySheetProps {
  trip: { slug: string; title: string; nights: number; days: number; window?: { from: string; to: string } };
  open: boolean;
  onClose: () => void;
}

export function CopySheet({ trip, open, onClose }: CopySheetProps) {
  return (
    <SideSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Copy to my trips"
      kicker={trip.title}
      footer={<Button onClick={onClose}>Close</Button>}
      className="copy-sheet"
    >
      <div data-stub="CopySheet" data-trip={trip.slug}>
        <p>
          Copying {trip.title} ({trip.days} days, {trip.nights} nights) comes with the planner. Everything on this page works without an account.
        </p>
      </div>
    </SideSheet>
  );
}
