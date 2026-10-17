import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Icon } from '@/components/ui/Icon';
import { travelRoot } from '@/lib/data/root';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'About the data',
  description: 'Where the maps, places, photographs and weather on this site come from, and the licence each one is used under.',
  path: '/about/data/',
});

interface Licence {
  id: string;
  name: string;
  url: string;
  licence: string;
  attribution: string;
  covers: string;
}

export default function AboutData() {
  const doc = JSON.parse(readFileSync(path.join(travelRoot(), 'data', 'reference', 'licences.json'), 'utf8')) as { sources: Licence[]; privacy: string };
  return (
    <>
      <header className="page-head">
        <h1>About the data</h1>
        <p className="lede">Where everything on this site comes from, and the licence each source is used under.</p>
      </header>
      <div className="prose">
        <p className="private-note">{doc.privacy}</p>
        <h2>Sources</h2>
        <ul className="licence-list">
          {doc.sources.map((s) => (
            <li key={s.id} id={s.id}>
              <h3>{s.name}</h3>
              <p className="card-sub">{s.licence}</p>
              <p>{s.attribution}</p>
              <p className="muted">Used for: {s.covers}</p>
              {s.url.startsWith('http') ? (
                <p>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    Source and terms <Icon name="external" size={12} />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
