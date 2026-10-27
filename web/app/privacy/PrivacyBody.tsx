import Link from 'next/link';

/** Where to write to ask a question or have an account removed, until the delete-account button ships (owner decision, 26 Oct 2026). */
export const PRIVACY_CONTACT = 'nitin27may@gmail.com';
export const PRIVACY_CHANGED = '27 October 2026';

/** The page body. `google` is true when a Google map family is on, so the page names Google Maps only when it is in use. */
export function PrivacyBody({ google }: { google: boolean }) {
  return (
    <>
      <header className="page-head">
        <h1>Privacy</h1>
        <p className="lede">What this site keeps about you, what it does not, and who handles it.</p>
      </header>
      <div className="prose">
        <h2>Reading the site</h2>
        <p>
          You do not need an account to read any trip or place. The pages hold no household data: nothing about who travels, where they live or what they
          have booked.
        </p>

        <h2>Cookies and this device</h2>
        <p>
          Reading the site sets no cookies. Signing in sets cookies that keep you signed in until you sign out; they are used for nothing else. Your
          browser also keeps a few things on this device: light or dark, km or miles, saved views and trips you are copying. They stay on the device and
          are not sent to us.
        </p>

        <h2>Page counts</h2>
        <p>
          On the live site we count page views with Cloudflare Web Analytics. It sets no cookies and does not follow you from site to site. It shows us
          totals: which pages were opened (for example <code>/trips/dolomites-2027/</code>), which site linked to them, and the country, browser,
          operating system and kind of device. It never shows us who you are. It runs only on the live site.
        </p>

        <h2>Maps and photos</h2>
        <p>
          Maps, photos and some globe facts load straight from the services that hold them: OpenFreeMap and Mapterhorn for maps, Wikimedia Commons for
          photos and Wikidata for country facts.
          {google ? (
            <>
              {' '}Trip maps use Google Maps, which loads from Google under{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                Google&rsquo;s privacy policy<span className="sr-only"> (opens in a new tab)</span>
              </a>
              .
            </>
          ) : null}{' '}
          Like any website, these services see your IP address and browser when your device asks them for a file. We send them nothing else about you.
        </p>

        <h2>Server logs</h2>
        <p>
          Our host, Vercel, keeps request logs: the page asked for, the time, the browser and the IP address the request came from. We read them only to
          find faults, and Vercel deletes them after a limited time. Our own logs never hold your email address, a sign-in code or your IP address.
        </p>

        <h2>Accounts</h2>
        <p>
          Making an account is optional. If you make one, we keep your email address, your name if you give one, your password in a scrambled form that
          cannot be read back, and the trip drafts you save. They are held by Neon, our database provider, in the United States. We use them to sign you in
          and to show you your drafts, and for nothing else.
        </p>
        <p>
          To stop repeated guessing of passwords and codes, we count attempts for each email address, for each IP address, and for the two
          together, over periods of up to one day. We keep only a scrambled form that cannot be turned back into the address or the IP. Each count
          is deleted at the next sign-in attempt by anyone once it is two days past its period, so at most three days after your attempt while the
          site is in use. Daily totals that hold no address or IP, such as how many codes were sent, are kept for 35 days.
        </p>
        <p>
          Cloudflare Turnstile runs on the sign-in and sign-up forms to tell a person from a bot. To do that, Cloudflare looks at your browser, and our
          server sends Cloudflare your IP address with the check. It never runs on trip or place pages.
        </p>

        <h2>Email</h2>
        <p>
          Sign-in, confirmation and password reset emails are sent by Neon, which runs our sign-in, from auth@mail.myneon.app under the name Neon
          Auth. They use Neon&rsquo;s standard wording. We don&rsquo;t send these emails ourselves yet. We use Resend only to send alerts to the site
          owner; it never sends you anything. Neither is used for newsletters or marketing.
        </p>

        <h2>Removing your account</h2>
        <p>
          You can delete any saved draft on your account page. To ask a question or have your account removed, email{' '}
          <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>. This is the way until an account delete button is added.
        </p>

        <h2>Rules for using the site</h2>
        <p>
          What you may and may not do with the content is on the <Link href="/terms/">terms and copyright</Link> page.
        </p>
        <p className="prose-note">Last changed {PRIVACY_CHANGED}.</p>
      </div>
    </>
  );
}
