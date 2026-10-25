import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Look {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square icon button; the caller must give an aria-label. */
  icon?: boolean;
  className?: string;
}

/** Class list shared by Button and ButtonLink (components 2.1). `btn-primary` is kept for pages that still use plain anchors. */
export function buttonClass({ variant = 'secondary', size = 'md', icon, className }: Look = {}): string {
  return cx('btn', variant !== 'secondary' && `btn-${variant}`, size !== 'md' && `btn-${size}`, icon && 'btn-icon', className);
}

interface ButtonProps extends Look, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** Swaps the label for a spinner without changing the width. */
  loading?: boolean;
}

export function Button({ variant, size, icon, className, loading, children, type = 'button', disabled, ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass({ variant, size, icon, className })} disabled={disabled || undefined} aria-busy={loading || undefined} data-loading={loading || undefined} {...rest}>
      {loading ? <span className="btn-spin" aria-hidden="true" /> : null}
      {/* Icon-only buttons that are not loading need no label wrapper: the icon is aria-hidden and `.btn` already centres it. The wrapper only exists for the loading opacity-swap, so text buttons and loading icon buttons keep it. */}
      {icon && !loading ? children : <span className="btn-label">{children}</span>}
    </button>
  );
}

interface ButtonLinkProps extends Look, Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'href'> {
  href: string;
  children: ReactNode;
}

/** A link that looks like a button. App routes use the client router; anything else is a plain anchor. */
export function ButtonLink({ variant, size, icon, className, href, children, ...rest }: ButtonLinkProps) {
  const cls = buttonClass({ variant, size, icon, className });
  if (href.startsWith('/') && !href.startsWith('//')) {
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={cls} {...rest}>
      {children}
    </a>
  );
}
