'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { ExportMenu as ExportMenuType } from '@/components/actions/ExportMenu';

// The export code (generators and the licence guard) is the heaviest part of a place page; it loads after hydration
// so the page stays inside the JS budget. Until then a plain disabled button holds the place.
const ExportMenu = dynamic(() => import('@/components/actions/ExportMenu').then((m) => m.ExportMenu), {
  ssr: false,
  loading: () => (
    <button type="button" className="btn" disabled>
      <Icon name="download" size={15} /> Export
    </button>
  ),
});

export function ExportMenuLazy(props: ComponentProps<typeof ExportMenuType>) {
  return <ExportMenu {...props} />;
}
