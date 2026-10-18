'use client';

import { lazyComponent } from '@/components/entity/lazyComponent';
import type { Crumb } from './Breadcrumbs';

type Props = { hidden: Crumb[] };

/** Same button as the real trigger, inert until the menu code has loaded (see lazyComponent). */
function Placeholder() {
  return (
    <button type="button" className="crumb-more-btn" aria-label="Earlier levels" aria-disabled="true">
      &hellip;
    </button>
  );
}

export const CrumbMore = lazyComponent<Props>(() => import('./CrumbMoreMenu').then((m) => m.CrumbMoreMenu), Placeholder);
