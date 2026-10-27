import { AuthFrame } from '@/components/auth/AuthFrame';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ResetFlowLazy } from '@/components/auth/AuthLazy';
import { capabilities } from '@/lib/capabilities';
import { turnstileSiteKey } from '@/lib/auth/flags';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({ title: 'Reset your password', description: 'Set a new password for your trip planner account with a code we email you.', path: '/sign-in/reset/', noindex: true });

/** Reset or set a password with an emailed code (email spec 3.1). When the account path is off, the same one-screen notice as sign-in. */
export default function ResetPassword() {
  if (!capabilities.signIn) {
    return (
      <div className="prose sign-in">
        <span className="empty-glyph" aria-hidden="true">
          <Icon name="user" size={32} />
        </span>
        <h1>Reset your password</h1>
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
    <AuthFrame title="Reset your password" sub="We email you a code, then you choose a new password. Your trip drafts stay as they are.">
      <ResetFlowLazy siteKey={turnstileSiteKey} />
    </AuthFrame>
  );
}
