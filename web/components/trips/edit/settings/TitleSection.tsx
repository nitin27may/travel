'use client';

import { useEffect, useState } from 'react';
import { Field, Input } from '@/components/ui/Input';
import { TRIP_NAME_MAX } from '@/lib/config/product';
import type { PlanOp } from '@/lib/trip-edit/model';
import { renameOps } from '@/lib/trip-edit/titleOps';
import type { Where } from '@/lib/trip-edit/open';

interface Props {
  title: string;
  ourTitle: string | null;
  where: Where;
  open: boolean;
  run: (ops: PlanOp[], label: string) => boolean;
}

/** The trip's name, capped at `TRIP_NAME_MAX` (SW-012). Saves on Enter or when the field loses focus; empty puts our trip's name back. */
export function TitleSection({ title, ourTitle, where, open, run }: Props) {
  const [name, setName] = useState(title);
  // the field follows the page's title when it changes elsewhere or the sheet reopens
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setName(title), [title, open]);
  const commit = () => {
    const r = renameOps(title, name, ourTitle, where);
    if (r) run(r.ops, r.label);
  };
  return (
    <Field label="Trip name" help={ourTitle ? `Left empty, it reads ${ourTitle}.` : undefined}>
      {(c) => (
        <Input
          {...c}
          value={name}
          maxLength={TRIP_NAME_MAX}
          placeholder={ourTitle ?? 'Your trip'}
          suffix={<span className="num own-set-count" aria-hidden="true">{name.length}/{TRIP_NAME_MAX}</span>}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
      )}
    </Field>
  );
}
