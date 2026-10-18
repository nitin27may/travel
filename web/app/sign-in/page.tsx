import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({ title: 'Sign in', description: 'Sign-in comes with the planner. Everything on this site works without an account.', path: '/sign-in/', noindex: true });

/** One-screen notice: there is no account yet (build brief L0, step 5). */
export default function SignIn() {
  return (
    <div className="prose sign-in">
      <span className="empty-glyph" aria-hidden="true">
        <Icon name="user" size={32} />
      </span>
      <h1>Sign in</h1>
      <p>Sign-in comes with the planner. Everything here works without an account.</p>
      <div className="hero-links">
        <ButtonLink href="/trips/" variant="primary">
          Trips
        </ButtonLink>
        <ButtonLink href="/places/">Places</ButtonLink>
        <ButtonLink href="/globe/">Globe</ButtonLink>
      </div>
    </div>
  );
}
