'use client';

import { useEffect, useId, useRef } from 'react';
import type { InputHTMLAttributes, ReactNode, RefObject, TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';
import { cx } from './cx';

interface FieldProps {
  label: string;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: (control: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true; 'aria-required'?: true }) => ReactNode;
}

/** Label above, help or error below (components 2.2). The control comes in as a render function so ids line up. */
export function Field({ label, help, error, required, className, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? help;
  return (
    <div className={cx('field', className)}>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? <span aria-hidden="true"> &middot;</span> : null}
      </label>
      {children({ id, 'aria-describedby': note ? noteId : undefined, 'aria-invalid': error ? true : undefined, 'aria-required': required ? true : undefined })}
      {error ? (
        <p id={noteId} className="field-error">
          <Icon name="warn" size={13} />
          {error}
        </p>
      ) : help ? (
        <p id={noteId} className="field-help">
          {help}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  error?: boolean;
  /** Mono text for codes, times and money. */
  mono?: boolean;
  /** Unit before or after the value (km, EUR). */
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Async validation in flight. */
  loading?: boolean;
  ref?: RefObject<HTMLInputElement | null>;
}

export function Input({ error, mono, prefix, suffix, loading, className, readOnly, ref, ...rest }: InputProps) {
  return (
    <span className={cx('input', mono && 'input-mono', error && 'input-error', readOnly && 'input-ro', className)} data-disabled={rest.disabled || undefined}>
      {prefix ? <span className="input-affix">{prefix}</span> : null}
      <input ref={ref} readOnly={readOnly} aria-invalid={error || undefined} {...rest} />
      {loading ? <span className="input-spin" aria-hidden="true" /> : null}
      {suffix ? <span className="input-affix">{suffix}</span> : null}
    </span>
  );
}

export function Textarea({ error, className, ...rest }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'> & { error?: boolean }) {
  return <textarea className={cx('input textarea', error && 'input-error', className)} aria-invalid={error || undefined} {...rest} />;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name; also the placeholder unless `placeholder` is given. */
  label: string;
  placeholder?: string;
  /** Focus the field when "/" is pressed outside another input (components 2.10). */
  shortcut?: boolean;
  /** Polite live text for the result count, e.g. "12 trips". */
  status?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
  autoFocus?: boolean;
}

/** 42 px search field: icon left, "/" hint right, clear button with content, Esc clears then blurs. */
export function SearchInput({ value, onChange, label, placeholder, shortcut, status, inputRef, className, autoFocus }: SearchInputProps) {
  const own = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? own;
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut, ref]);
  return (
    <div className={cx('search', className)}>
      <Icon name="search" size={16} />
      <input
        ref={ref}
        type="search"
        placeholder={placeholder ?? label}
        aria-label={label}
        aria-keyshortcuts={shortcut ? '/' : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          if (value) {
            e.preventDefault();
            onChange('');
          } else ref.current?.blur();
        }}
      />
      {value ? (
        <button type="button" className="search-clear" aria-label="Clear search" onClick={() => { onChange(''); ref.current?.focus(); }}>
          <Icon name="close" size={14} />
        </button>
      ) : shortcut ? (
        <kbd className="kbd" aria-hidden="true">
          /
        </kbd>
      ) : null}
      {status !== undefined ? (
        <span className="sr-only" role="status" aria-live="polite">
          {status}
        </span>
      ) : null}
    </div>
  );
}
