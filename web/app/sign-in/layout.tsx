import type { ReactNode } from 'react';
import { AccountCurrent } from '@/components/shell/AccountCurrent';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AccountCurrent />
    </>
  );
}
