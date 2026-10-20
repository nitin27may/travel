'use client';

import { Icon } from '@/components/ui/Icon';
import type { Crumb } from '@/lib/globe/controller';

interface Props {
  crumbs: Crumb[];
  canBack: boolean;
  onBack(): void;
  onCrumb(path: string[]): void;
}

/** Breadcrumb chip, top-left (components 1.5, 7.2): World › Italy › South Tyrol, with a Back button. Each crumb has a 36 px hit height. */
export function GlobeCrumbs({ crumbs, canBack, onBack, onCrumb }: Props) {
  const all = [{ label: 'World', path: [] as string[] }, ...crumbs];
  return (
    <nav className="globe-crumbs" aria-label="Globe level" data-long={all.length > 3 || all.reduce((n, c) => n + c.label.length, 0) > 26 ? 'true' : undefined}>
      {canBack ? (
        <button type="button" className="globe-back" onClick={onBack} aria-label="Back one level">
          <Icon name="chevronLeft" size={16} />
        </button>
      ) : null}
      <ol>
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={c.path.join('/') || 'world'}>
              {i > 0 ? <span className="globe-crumb-sep" aria-hidden="true">›</span> : null}
              {last ? <span className="globe-crumb-cur" aria-current="page">{c.label}</span> : <button type="button" className="globe-crumb" onClick={() => onCrumb(c.path)}>{c.label}</button>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
