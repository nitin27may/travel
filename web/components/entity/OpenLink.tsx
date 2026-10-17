'use client';

import type { MouseEvent, ReactNode } from 'react';
import { encodeState } from '@/lib/entities/url';
import type { ListState } from '@/lib/entities/types';

interface Props {
  id: string;
  state: ListState;
  /** For 'link' entities this is the destination; for 'sheet' entities the sheet opens. */
  href: string | null;
  primary: 'sheet' | 'link';
  onOpen: (id: string, trigger: HTMLElement) => void;
  className?: string;
  children: ReactNode;
}

/**
 * The stretched link behind a card or row. For sheet entities its href is the same page with
 * ?focus=<id>, so it works in a new tab and when shared; a plain click opens the sheet in place.
 */
export function OpenLink({ id, state, href, primary, onOpen, className, children }: Props) {
  if (primary === 'link' && href) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }
  const q = encodeState({ ...state, focus: id });
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(id, e.currentTarget);
  };
  return (
    <a className={className} href={`?${q}`} onClick={onClick} aria-haspopup="dialog" data-open-id={id}>
      {children}
    </a>
  );
}
