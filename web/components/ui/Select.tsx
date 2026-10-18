import type { ReactNode, SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** 34 px in toolbars, 42 px in forms (components 2.3). */
  compact?: boolean;
  error?: boolean;
  children: ReactNode;
}

/**
 * A native select styled as the foundation's select box. The browser supplies the menu, type-ahead and the
 * phone picker, which is what components 2.3 asks for on phones; the custom menu is not worth losing them.
 */
export function Select({ compact, error, className, children, ...rest }: SelectProps) {
  return (
    <span className={cx('selbox', compact && 'selbox-sm', error && 'input-error', className)} data-disabled={rest.disabled || undefined}>
      <select aria-invalid={error || undefined} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={14} />
    </span>
  );
}
