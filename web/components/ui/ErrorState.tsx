import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { cx } from './cx';

interface Props {
  /** "We couldn't load the places." */
  title: ReactNode;
  /** What to do next. */
  detail?: ReactNode;
  onRetry?: () => void;
  /** Cached data, shown under the message when there is any. */
  cached?: ReactNode;
  className?: string;
}

/** Inline error in place of the region (components 6.3): triangle, message, Retry, cached data below. */
export function ErrorState({ title, detail, onRetry, cached, className }: Props) {
  return (
    <div className={cx('errb', className)} role="alert">
      <Icon name="warn" size={20} />
      <div className="errb-body">
        <p className="errb-title">{title}</p>
        {detail ? <p className="errb-detail">{detail}</p> : null}
        {onRetry ? (
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {cached ? <div className="errb-cached">{cached}</div> : null}
      </div>
    </div>
  );
}
