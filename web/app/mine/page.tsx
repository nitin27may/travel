import { capabilities } from '@/lib/capabilities';
import { pageMetadata } from '@/lib/site';
import { MineShell } from './MineShell';
import './mine.css';

export const metadata = pageMetadata({ title: 'Mine', description: 'The trips you copied and the places you favourited, kept in this browser or your account.', path: '/mine/', noindex: true });

/** The visitor's own page (nav spec 2, mine-and-bar-spec 5). Static: everything personal is read in the browser. */
export default function MinePage() {
  return (
    <>
      <header className="page-head">
        <h1>Mine</h1>
      </header>
      <MineShell signIn={capabilities.signIn} />
    </>
  );
}
