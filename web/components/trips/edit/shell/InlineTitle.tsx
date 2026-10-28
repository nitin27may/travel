'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { TRIP_NAME_MAX } from '@/lib/config/product';
import type { PlanOp } from '@/lib/trip-edit/model';
import type { Where } from '@/lib/trip-edit/open';
import { renameOps } from '@/lib/trip-edit/titleOps';

interface Props {
  title: string;
  ourTitle: string | null;
  where: Where;
  /** the edit session's commit: one undo step with a toast; false when it could not be made */
  commit: (ops: PlanOp[], label: string) => boolean;
}

/**
 * The cover's display title while editing (patterns 4.3, G-12): the heading stays in its display font, size and box and becomes the input
 * (a dashed underline), never a smaller boxed field. A press or Enter on the name opens it; Enter saves, Esc puts the name back, leaving the
 * field saves. One undo step, "Renamed the trip to …". Capped at `TRIP_NAME_MAX`; an empty name puts our trip's name back.
 */
export function InlineTitle({ title, ourTitle, where, commit }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(title);
  const field = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);

  // the field is as tall as the words it holds: a long name wraps in the heading's own box
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [open, text]);
  useEffect(() => {
    if (open) {
      field.current?.focus();
      field.current?.select();
    }
  }, [open]);

  const begin = () => {
    cancelled.current = false;
    setText(title);
    setOpen(true);
  };
  const leave = (save: boolean) => {
    setOpen(false);
    if (save) {
      const r = renameOps(title, text, ourTitle, where);
      if (r) commit(r.ops, r.label);
    }
    window.setTimeout(() => opener.current?.focus({ preventScroll: true }), 0);
  };

  if (!open) {
    return (
      <button ref={opener} type="button" className="trip-title-edit" onClick={begin} aria-label={`Rename the trip, now ${title}`}>
        <span>{title}</span>
        <Icon name="pencil" size={20} />
      </button>
    );
  }
  return (
    <textarea
      ref={field}
      className="trip-title-input"
      rows={1}
      value={text}
      maxLength={TRIP_NAME_MAX}
      placeholder={ourTitle ?? 'Your trip'}
      aria-label={`Trip name, up to ${TRIP_NAME_MAX} characters. Enter saves, Escape cancels.`}
      onChange={(e) => setText(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          cancelled.current = true;
          leave(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancelled.current = true;
          leave(false);
        }
      }}
      onBlur={() => {
        if (!cancelled.current) leave(true);
      }}
    />
  );
}
