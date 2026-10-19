import { emptyState, encodeState } from '@/lib/entities/url';

/** The list a parse opens: `/places/?...` or `/trips/?...`, in the canonical order of the list's own URL state. */
export function hrefFor(target: 'places' | 'trips', facets: Record<string, string[]>, q: string): string {
  return `${target === 'places' ? '/places/' : '/trips/'}?${encodeState({ ...emptyState(), q, facets })}`;
}
