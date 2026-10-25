import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SignInCardLazy } from '@/components/auth/AuthLazy';
import { authFlags, turnstileSiteKey } from '@/lib/auth/flags';
import { capabilities } from '@/lib/capabilities';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({ title: 'Sign in', description: 'Sign in to your trip planner account. Everything on this site works without an account.', path: '/sign-in/', noindex: true });

/** Real sign-in form when the account path is on; otherwise today's one-screen notice for old links. */
export default function SignIn() {
  if (!capabilities.signIn) {
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
  return (
    <div className="auth-page">
      <header className="auth-head">
        <h1>Sign in</h1>
        <p className="auth-sub">Save and revisit your trip drafts.</p>
      </header>
      <SignInCardLazy mode="sign-in" codeOn={authFlags.signInCode} siteKey={turnstileSiteKey} />
    </div>
  );
}
