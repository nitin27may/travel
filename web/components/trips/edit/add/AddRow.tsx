'use client';

import { Icon } from '@/components/ui/Icon';

/** The "Add a place to Day n" row at the foot of a day (edit-mode-spec 7; the slot `addPicker`): it opens the picker, which loads on this press. */
export function AddRow({ day, onOpen }: { day: number; onOpen: (day: number) => void }) {
  return (
    <div className="tl-add" data-print="hide">
      <button type="button" className="tl-add-open" aria-haspopup="dialog" onClick={() => onOpen(day)}>
        <Icon name="plus" size={15} /> Add a place to Day {day}
      </button>
    </div>
  );
}
