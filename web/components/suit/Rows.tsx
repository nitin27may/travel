import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Row } from '@/lib/public/sections';
import type { SuitRow } from '@/lib/public/suitability';
import type { PVal } from '@/lib/public/vals';

// One row of a section or of a "Who it suits" group, drawn by what it holds, never by the type of the place (S3). A value with a
// provenance is a disclosure: the row line, then basis, quote, source and every conflict one click away (display 2, D7). Native
// <details> keeps this out of the page's JavaScript and out of the RSC payload; `Interactions` adds Esc and the glance link jump.

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTH[Number(m[2]) - 1]} ${m[1]}` : iso;
}

/** What a row needs to draw; a section Row and a suitability SuitRow both fit. */
export interface ShowRow {
  key: string;
  label: string;
  text: string | null;
  look: Row['look'];
  gap: boolean;
  val: PVal | null;
  honesty?: string | null;
  valueType?: string;
  value?: unknown;
  links?: { ref: string; name: string }[];
  gapWording?: string;
  echo?: boolean;
}
export const fromRow = (r: Row): ShowRow => r;
export const fromSuit = (r: SuitRow): ShowRow => ({ ...r, text: r.gap ? null : r.text, gapWording: r.gap && r.text !== 'Not checked yet' ? r.text : undefined });

export const GAP_WORDS = 'Not checked yet';

/** A stored value as words: never JSON on a page. */
export function valueWords(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v).replace(/_/g, ' ');
  if (Array.isArray(v)) return v.map(valueWords).filter(Boolean).join(', ');
  return Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k.replace(/_/g, ' ')} ${valueWords(x)}`)
    .join(' · ');
}

export function RefLink({ r, slugs }: { r: { ref: string; name: string }; slugs: Record<string, string> }) {
  const slug = slugs[r.ref];
  return slug ? <Link href={`/places/${slug}/`}>{r.name}</Link> : <>{r.name}</>;
}

export function GapChip({ children = GAP_WORDS }: { children?: ReactNode }) {
  return <span className="su-gapchip">{children}</span>;
}

/** "operator rule · read 12 Oct 2026": the stub that follows a value. */
export function stubOf(val: PVal | null, extra?: string): string {
  if (!val) return extra ?? '';
  const bits = [val.basisLabel, val.read ? `read ${longDate(val.read)}` : null, extra].filter(Boolean);
  return bits.join(' · ');
}

/** The body of a provenance disclosure: basis in words, the quote, the source with its publisher, the read date, every conflict. */
/** A source worth showing to a visitor: a public web page. Our own repo, a plan file or a relative path is the workshop, never a source. */
const publicSource = (s: PVal['sources'][number]): boolean => /^https?:\/\//.test(s.url) && !/this repo|^repo$/i.test(s.publisher) && !/^trip plan$/i.test(s.title);

export function ProvPanel({ val }: { val: PVal }) {
  // free-text notes of the workshop (method notes, file and record names) are not published here; the quote is the source's own words (3.27)
  const sources = val.sources.filter(publicSource);
  return (
    <div className="su-pop" role="group" aria-label="Where this comes from">
      <p className="su-pop-basis">
        {val.basisLabel ? <strong>{val.basisLabel}</strong> : <strong>Source</strong>}
        {val.read ? <span> · read {longDate(val.read)}</span> : null}
        {val.appliesTo ? <span> · {val.appliesTo.replace(/_/g, ' ')}</span> : null}
      </p>
      {val.quote ? <blockquote className="su-pop-quote">{val.quote}</blockquote> : null}
      {sources.length ? (
        <ul className="su-pop-src">
          {sources.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title.replace(/\bOSM (node|way|relation)\b/gi, 'OpenStreetMap $1')}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <span>
                {' '}
                · {s.publisher}
                {s.read ? ` · read ${longDate(s.read)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {val.conflicts.length ? (
        <div className="su-pop-conf">
          <p>
            <strong>Sources disagree</strong>
          </p>
          <ul>
            {val.conflicts.map((c, i) => (
              <li key={i}>
                {valueWords(c.value)}
                {c.basisLabel ? ` · ${c.basisLabel}` : ''}
                {c.sources.filter(publicSource)[0] ? ` · ${c.sources.filter(publicSource)[0]!.publisher}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The value of a row by its value type: a price list is a list, a relation is links, the rest is words. */
export function RowValue({ row, slugs }: { row: ShowRow; slugs: Record<string, string> }) {
  if (row.links && row.links.length > 0) {
    return (
      <>
        {row.links.map((l, i) => (
          <span key={l.ref}>
            {i ? ', ' : ''}
            <RefLink r={l} slugs={slugs} />
          </span>
        ))}
      </>
    );
  }
  if (row.valueType === 'price_list' && Array.isArray(row.value) && row.value.length > 1) {
    return (
      <ul className="su-prices">
        {(row.value as Record<string, unknown>[]).map((p, i) => (
          <li key={i}>
            <span>{typeof p.who === 'string' ? p.who : p.age_from !== undefined ? `Ages ${String(p.age_from)}${p.age_to !== undefined ? `–${String(p.age_to)}` : '+'}` : String(p.per ?? 'Price').replace(/_/g, ' ')}</span>
            <strong>{Number(p.amount) === 0 ? 'free' : `${String(p.currency)} ${String(p.amount)}`}</strong>
          </li>
        ))}
      </ul>
    );
  }
  return <>{row.text}</>;
}

/**
 * One row. A gap keeps its row and shows the dashed chip (D8); a searched-none value is a sentence in the muted ink with no
 * dashed border (D3); a value with provenance is a disclosure whose summary is the row.
 */
export function RowLine({ row, slugs, id }: { row: ShowRow; slugs: Record<string, string>; id?: string }) {
  const anchor = id ?? `row-${row.key}`;
  if (row.gap) {
    return (
      <div className="su-row" id={anchor} data-gap>
        <span className="su-lab">{row.label}</span>
        <span className="su-val">
          <GapChip />
          {row.gapWording ? <span className="su-gapnote"> {row.gapWording}</span> : null}
        </span>
      </div>
    );
  }
  const sentence = row.look === 'sentence';
  const body = (
    <>
      <span className="su-lab">{row.label}</span>
      <span className="su-val" data-look={row.look}>
        <RowValue row={row} slugs={slugs} />
        {row.honesty ? <span className="su-honest">{row.honesty}</span> : null}
        {!sentence && row.val ? <span className="su-stub">{stubOf(row.val)}</span> : null}
      </span>
    </>
  );
  const hasLinks = !!row.links && row.links.length > 0;
  if (!row.val || hasLinks) {
    return (
      <div className="su-row" id={anchor} data-look={row.look}>
        {body}
      </div>
    );
  }
  return (
    <details className="su-row su-prov" id={anchor} data-look={row.look}>
      <summary>{body}<span className="su-chev" aria-hidden="true" /></summary>
      <ProvPanel val={row.val} />
    </details>
  );
}
