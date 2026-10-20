import { Button } from '@/components/ui/Button';
import type { ViewName } from '@/lib/entities/types';

interface Props {
  view: ViewName;
  /** Placeholders to draw: the page size, so the page keeps its height when the rows arrive (CLS 0). */
  count: number;
  failed?: boolean;
  onRetry?: () => void;
}

/** What a list shows while the files that answer its query load: the same grid of the same height, empty, and a plain failure with a retry. */
export function ListSkeleton({ view, count, failed, onRetry }: Props) {
  if (failed) {
    return (
      <div className="list-failed" role="alert">
        <p>The list did not load.</p>
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  const rows = view === 'cards' || view === 'map' ? Math.min(count, 12) : Math.min(count, 14);
  return (
    <div className="list-skeleton" data-view={view} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton-block" />
      ))}
    </div>
  );
}
