import type { ReactNode } from 'react';
import { cx } from '@/components/ui/cx';

/**
 * The section frame of /account/ (spec 2.1): a `<section>` named by its `h2`, a hairline above, one rhythm. "Ways to sign in" draws its
 * own frame (GSI-WAYS) and takes the same hairline from the CSS. ACCT-P2's Travellers section uses this frame too.
 */
export function AccountSection({ id, title, count, className, children }: { id: string; title: string; count?: number; className?: string; children: ReactNode }) {
  return (
    <section className={cx('acct-section', className)} aria-labelledby={id}>
      <h2 id={id} className="acct-h">
        {title}
        {count !== undefined ? <span className="acct-h-count"> &middot; {count}</span> : null}
      </h2>
      {children}
    </section>
  );
}
