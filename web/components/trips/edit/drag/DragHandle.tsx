'use client';

// The leading slot of a stop in edit mode (components 8.1; STEP2-E2): the six-dot handle. It is only the target: the pointer and key
// handling is one delegated listener in DragLayer, which loads after it, so this file stays tiny. `touch-action: none` is on the handle
// only, so a press on the row body scrolls the page on a phone (Q-BE3).
import type { TimelineEntry } from '@travel/core/schedule/types.ts';
import { Icon } from '@/components/ui/Icon';
import { keyOf, remember } from './registry';
import './drag.css';

/** The id of the one description every handle points at (DragLayer renders it). */
export const DRAG_HELP_ID = 'edit-drag-help';

export function DragHandle({ entry: e }: { entry: TimelineEntry }) {
  return (
    <button
      type="button"
      className="drag-handle"
      data-drag-handle={keyOf(e)}
      aria-label={`Move ${e.title}, Day ${e.day}`}
      aria-describedby={DRAG_HELP_ID}
      ref={(el) => {
        if (el) remember(e);
      }}
    >
      <Icon name="grip" size={18} />
    </button>
  );
}
