import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SignInCardLazy } from '@/components/auth/AuthLazy';
import { authFlags, turnstileSiteKey } from '@/lib/auth/flags';
import { capabilities } from '@/lib/capabilities';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({ title: 'Create an account', description: 'Create a trip planner account.', path: '/sign-up/', noindex: true });

/** Registration, same shell as sign-in. When the account path is off, a one-screen noindex notice for old links (a real page with `<html lang>`, not a 404). */
export default function SignUp() {
  if (!capabilities.signIn) {
    return (
      <div className="prose sign-in">
        <span className="empty-glyph" aria-hidden="true">
          <Icon name="user" size={32} />
        </span>
        <h1>Create account</h1>
        <p>Accounts come with the planner. Everything here works without one.</p>
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
        <h1>Create an account</h1>
        <p className="auth-sub">Start saving your trip drafts.</p>
      </header>
      <SignInCardLazy mode="sign-up" codeOn={authFlags.signInCode} googleOn={authFlags.signInGoogle} siteKey={turnstileSiteKey} />
    </div>
  );
}
