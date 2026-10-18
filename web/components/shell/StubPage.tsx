import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';

interface Props {
  /** The page title in Big Shoulders 72 (what the real page will show). */
  title: string;
  /** Names the lane that fills it, for the verifier's search of leftover stubs. */
  stub: string;
  note?: string;
}

/** Placeholder for a route whose page a wave-2 lane builds: the title and a skeleton, marked with `data-stub`. */
export function StubPage({ title, stub, note }: Props) {
  return (
    <div className="stub" data-stub={stub}>
      <h1 className="stub-title">{title}</h1>
      {note ? <p className="lede">{note}</p> : null}
      <Skeleton height={20} width="40%" />
      <div className="card-grid">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

/** "dolomites-2027" to "Dolomites 2027". */
export const titleFromSlug = (slug: string) =>
  decodeURIComponent(slug)
    .split(/[-/]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
