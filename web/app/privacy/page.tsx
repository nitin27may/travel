import Link from 'next/link';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Privacy',
  description: 'What this site keeps and what it does not: page views counted without cookies, accounts only if you make one, and no household data on any public page.',
  path: '/privacy/',
});

/** Plain-words privacy note (GSI-P). The copy is owner-approved wording; tests/shell/privacy-page.test.ts pins its key sentences. */
export default function PrivacyPage() {
  return (
    <>
      <header className="page-head">
        <h1>Privacy</h1>
        <p className="lede">What this site keeps, what it does not, and who handles it.</p>
      </header>
      <div className="prose">
        <h2>Reading the site</h2>
        <p>
          You do not need an account to read any trip or place, and the pages set no tracking cookies. The pages hold no household data: nothing about who
          travels, where they live or what they have booked.
        </p>

        <h2>Page counts</h2>
        <p>
          On the live site we count page views with Cloudflare Web Analytics. It uses no cookies and does not follow you from site to site. We see how many
          times each page was opened, by path (for example <code>/trips/dolomites-2027/</code>), and nothing else about you. It is off everywhere except
          the live site.
        </p>

        <h2>Server logs</h2>
        <p>
          Our host, Vercel, keeps ordinary request logs: the page asked for, the time and the address the request came from. We use them to find faults.
          They are not used to profile anyone.
        </p>

        <h2>Accounts</h2>
        <p>
          Making an account is optional. If you do, your email address and sign-in details are stored with Neon, our database provider. We use them to
          sign you in and for nothing else.
        </p>
        <p>
          Where a sign-in or sign-up form shows a Turnstile check, Cloudflare runs it to tell people from bots. It is shown only when it is turned on.
        </p>

        <h2>Email</h2>
        <p>
          We use Resend only to send alerts to the site owner. It is not used for newsletters, marketing or messages to visitors.
        </p>

        <h2>Rules for using the site</h2>
        <p>
          What you may and may not do with the content is on the <Link href="/terms/">terms and copyright</Link> page.
        </p>
      </div>
    </>
  );
}
