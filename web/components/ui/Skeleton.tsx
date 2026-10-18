import { cx } from './cx';

/** A `--surface-2` block that shimmers 1.4 s; the shimmer is off under reduced motion (components 6.2). */
export function Skeleton({ className, width, height }: { className?: string; width?: string | number; height?: string | number }) {
  return <span className={cx('sk', className)} style={{ width, height }} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <article className="card card-sk" aria-busy="true" aria-label="Loading">
      <div className="card-media">
        <Skeleton className="sk-fill" />
      </div>
      <div className="card-body">
        <Skeleton height={24} width="60%" />
        <Skeleton height={12} width="80%" />
        <Skeleton height={16} width="100%" />
        <Skeleton height={16} width="70%" />
      </div>
    </article>
  );
}

export function RowSkeleton() {
  return (
    <li className="row row-sk" aria-busy="true" aria-label="Loading">
      <Skeleton className="sk-disc" width={26} height={26} />
      <div className="row-main">
        <Skeleton height={16} width="45%" />
        <Skeleton height={12} width="30%" />
      </div>
    </li>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="table-sk" aria-busy="true" aria-label="Loading table">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={36} />
      ))}
    </div>
  );
}

/** Map placeholder: `--well` with a centred mono "Loading map". */
export function MapSkeleton() {
  return (
    <div className="map-sk" aria-busy="true" role="status">
      Loading map
    </div>
  );
}
