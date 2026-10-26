import { ButtonLink } from '@/components/ui/Button';

const NEXT = '?next=%2Fmine%2F';

/**
 * The account card under the page title (spec 5.1, D7): where things are kept, and the way to keep them elsewhere. `email` is the
 * signed-in address, `signIn` is the capability. The first focusable controls in `main`, so a visitor who wants the list tabs past two links.
 */
export function AccountCard({ signIn, email }: { signIn: boolean; email: string | null }) {
  return (
    <section className="mine-card" aria-label="Your account">
      {email ? (
        <>
          <p className="mine-card-text">Signed in as {email}</p>
          <div className="mine-card-actions">
            <ButtonLink href="/account/" size="sm">
              Account
            </ButtonLink>
          </div>
          <p className="mine-card-note">Copies on this device move to your account when the planner opens.</p>
        </>
      ) : (
        <>
          <p className="mine-card-text">Kept in this browser only.</p>
          {signIn ? (
            <div className="mine-card-actions">
              <ButtonLink href={`/sign-in/${NEXT}`} size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href={`/sign-up/${NEXT}`} variant="ghost" size="sm">
                Create an account
              </ButtonLink>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
