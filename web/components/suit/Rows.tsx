import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Row } from '@/lib/public/sections';
import type { SuitRow } from '@/lib/public/suitability';
import { GAP_WORDS, longDate, rowLine, rowsHtml, stubOf, type ShowRow, type Slugs } from './html';

// Rows of a section or of a "Who it suits" group, drawn by what they hold, never by the type of the place (S3). The markup itself is
// built as a string in `html.ts` (see the note there on payload size); these are the React entry points. A value with a source,
// quote or conflict is a native <details>; `Interactions` adds Esc and the glance link jump.

export { GAP_WORDS, longDate, stubOf };
export type { ShowRow };
export const fromRow = (r: Row): ShowRow => r;
export const fromSuit = (r: SuitRow): ShowRow => ({ ...r, text: r.gap ? null : r.text, gapWording: r.gap && r.text !== GAP_WORDS ? r.text : undefined });

export function RefLink({ r, slugs }: { r: { ref: string; name: string }; slugs: Slugs }) {
  const slug = slugs[r.ref];
  return slug ? <Link href={`/places/${slug}/`}>{r.name}</Link> : <>{r.name}</>;
}

export function GapChip({ children = GAP_WORDS }: { children?: ReactNode }) {
  return <span className="gc">{children}</span>;
}

/** Several rows as one block of markup. */
export function RowsHtml({ rows, slugs, idOf }: { rows: ShowRow[]; slugs: Slugs; idOf?: (r: ShowRow) => string }) {
  return <div className="srs" dangerouslySetInnerHTML={{ __html: rowsHtml(rows, slugs, idOf) }} />;
}

/** One row. */
export function RowLine({ row, slugs, id }: { row: ShowRow; slugs: Slugs; id?: string }) {
  return <div className="su-c" dangerouslySetInnerHTML={{ __html: rowLine(row, slugs, id) }} />;
}
