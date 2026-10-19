import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({ title: 'Not here', description: 'That page does not exist on this site.', path: '/404/', noindex: true });

/** 404 (components 6.3): "Not here", a search field and links to Home, Trips, Places, Globe and About. */
export default function NotFound() {
  return (
    <div className="prose not-found">
      <h1>Not here</h1>
      <p>That page does not exist on this site. Search for a trip or a place, or start from one of the lists.</p>
      <form className="not-found-search" action="/places/" role="search">
        <label className="sr-only" htmlFor="nf-q">
          Search places
        </label>
        <span className="search">
          <Icon name="search" size={16} />
          <input id="nf-q" name="q" type="search" placeholder="Search places" autoComplete="off" />
        </span>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>
      <div className="hero-links">
        <ButtonLink href="/">Home</ButtonLink>
        <ButtonLink href="/trips/">Trips</ButtonLink>
        <ButtonLink href="/places/">Places</ButtonLink>
        <ButtonLink href="/globe/">Globe</ButtonLink>
        <ButtonLink href="/about/">About</ButtonLink>
      </div>
    </div>
  );
}
