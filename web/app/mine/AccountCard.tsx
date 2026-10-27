import { ButtonLink } from '@/components/ui/Button';

const NEXT = '?next=%2Fmine%2F';

/**
 * The account card under the page title (spec 5.1, D7): where things are kept, and the way to keep them elsewhere. `email` is the
 * signed-in address, `signIn` is the capability. The first focusable controls in `main`, so a visitor who wants the list tabs past two links.
 */
export function AccountCard({ signIn, email, note }: { signIn: boolean; email: string | null; note?: { text: string; warn?: boolean } | null }) {
  // `note` is set only with the `accountTrips` flag on (edit-my-trip 4.7): undefined keeps today's sentences exactly
  return (
    <section className="mine-card" aria-label="Your account">
      {email ? (
        <>
          <p className="mine-card-text">Signed in as {email}</p>
          <div className="mine-card-actions">
            <ButtonLink href="/account/">
              Account
            </ButtonLink>
          </div>
          {note === undefined ? <p className="mine-card-note">Copies on this device move to your account when the planner opens.</p> : note ? <p className="mine-card-note" data-warn={note.warn || undefined}>{note.text}</p> : null}
        </>
      ) : (
        <>
          <p className="mine-card-text">Kept in this browser only.</p>
          {signIn ? (
            <div className="mine-card-actions">
              <ButtonLink href={`/sign-in/${NEXT}`}>
                Sign in
              </ButtonLink>
              <ButtonLink href={`/sign-up/${NEXT}`} variant="ghost">
                Create an account
              </ButtonLink>
            </div>
          ) : null}
          {note ? <p className="mine-card-note" data-warn={note.warn || undefined}>{note.text}</p> : null}
        </>
      )}
    </section>
  );
}
