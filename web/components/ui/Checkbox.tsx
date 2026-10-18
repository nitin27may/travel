'use client';

import { useEffect, useRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';

interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children?: ReactNode;
  indeterminate?: boolean;
}

/** 20 px box, 44 px hit area through the label (components 2.5). Checked is an ink fill with a surface check. */
export function Checkbox({ children, indeterminate, className, ...rest }: CheckProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <label className={cx('check', className)} data-disabled={rest.disabled || undefined}>
      <input ref={ref} type="checkbox" {...rest} />
      <span className="check-box" aria-hidden="true">
        {indeterminate ? <span className="check-bar" /> : <Icon name="check" size={13} strokeWidth={2.6} />}
      </span>
      {children ? <span className="check-label">{children}</span> : null}
    </label>
  );
}

export function Radio({ children, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { children?: ReactNode }) {
  return (
    <label className={cx('check check-radio', className)} data-disabled={rest.disabled || undefined}>
      <input type="radio" {...rest} />
      <span className="check-box" aria-hidden="true">
        <span className="check-dot" />
      </span>
      {children ? <span className="check-label">{children}</span> : null}
    </label>
  );
}
