import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { KindGlyph } from './KindGlyph';
import { cx } from './cx';

interface Props {
  kind?: string;
  icon?: IconName;
  /** The title; pass a link with class `row-open` to make the whole row one link. */
  title: ReactNode;
  meta?: ReactNode;
  summary?: ReactNode;
  chips?: ReactNode;
  selected?: boolean;
  /** Shows the right chevron (rows that open something). */
  chevron?: boolean;
  className?: string;
  'data-entity-id'?: string;
  'data-focused'?: true;
}

/** 56 px list row (components 3.2): kind glyph 26, serif 17/600 title, mono meta, chips right. */
export function ListRow({ kind, icon, title, meta, summary, chips, selected, chevron = true, className, ...data }: Props) {
  return (
    <li className={cx('row', className)} data-selected={selected || undefined} {...data}>
      <KindGlyph kind={kind} icon={icon} size="sm" />
      <div className="row-main">
        <h3 className="row-title">{title}</h3>
        {meta ? <p className="row-sub">{meta}</p> : null}
        {summary ? <p className="row-note">{summary}</p> : null}
      </div>
      {chips ? <div className="row-chips">{chips}</div> : null}
      {chevron ? <Icon name="chevronRight" size={16} className="row-chevron" /> : null}
    </li>
  );
}
