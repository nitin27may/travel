'use client';

import { Icon } from '@/components/ui/Icon';

/**
 * The card's choices as links, for a copy while editing (components 9.11; edit-mode-spec 8): Change places opens the add picker on Day 1,
 * Your driving and pace goes to the Pace control in this sheet. "Where you start" converts the copy to your own trip first, which waits for
 * the builder's stages (STEP2-B2, B3), so it is not offered here yet.
 */
export function MakeItYours({ onClose }: { onClose: () => void }) {
  return (
    <section className="own-set-yours" aria-labelledby="own-yours-h">
      <h3 id="own-yours-h" className="field-label">Make it yours</h3>
      <ul className="own-set-links">
        <li>
          <button
            type="button"
            className="own-set-link"
            onClick={() => {
              onClose();
              // after the sheet has closed and given the page back
              window.setTimeout(() => document.querySelector<HTMLElement>('#day-1 .tl-add-open')?.click(), 320);
            }}
          >
            <span>Change places</span>
            <Icon name="chevronRight" size={16} />
          </button>
        </li>
        <li>
          <button
            type="button"
            className="own-set-link"
            onClick={() => {
              const pace = document.getElementById('own-pace');
              pace?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              pace?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus({ preventScroll: true });
            }}
          >
            <span>Your driving and pace</span>
            <Icon name="chevronDown" size={16} />
          </button>
        </li>
      </ul>
    </section>
  );
}
