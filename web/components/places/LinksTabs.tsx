'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { LinkTab } from './model';

/** Links as tabs by group, with a count on each (patterns 3.6). Arrow keys move between tabs. */
export function LinksTabs({ tabs, checked }: { tabs: LinkTab[]; checked: string | null }) {
  const id = useId();
  const first = tabs.find((t) => t.links.length)?.id ?? tabs[0].id;
  const [current, setCurrent] = useState(first);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    setCurrent(tabs[n].id);
    refs.current[n]?.focus();
  };
  const active = tabs.find((t) => t.id === current) ?? tabs[0];
  return (
    <div className="pl-tabs">
      <div role="tablist" aria-label="Links by group" className="pl-tablist">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${t.id}`}
            aria-selected={t.id === current}
            aria-controls={`${id}-panel`}
            tabIndex={t.id === current ? 0 : -1}
            className="pl-tab"
            onClick={() => setCurrent(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label} <span className="num pl-tab-n">{t.links.length}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active.id}`} className="pl-tabpanel">
        {active.links.length ? (
          <ul className="pl-links">
            {active.links.map((l, i) => (
              <li key={`${l.url}-${i}`}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  <Icon name="link" size={13} />
                  <span>{l.label}</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {l.linkOnly ? (
                  <span className="pl-linkonly" title="The platform's terms allow a link only; we never copy its data">
                    link only
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Nothing recorded in this group yet.</p>
        )}
      </div>
      <p className="muted small pl-checked">{checked ? `Researched ${checked}; links are not re-checked automatically.` : 'The link check date is not recorded yet.'}</p>
    </div>
  );
}
