import Link from 'next/link';
import type { ReactNode } from 'react';
import '@/styles/auth-page.css';

/**
 * The centred frame of the sign-in, sign-up and reset pages (GSI-UX, owner 27 Oct 2026): one calm panel in the middle of the page
 * holding the title, the sub-line and the lazy card, then the privacy and terms links under it. Server-rendered, so the title and the
 * frame paint before the card's chunk arrives; the card itself draws no frame of its own inside it (auth.css). The class names
 * `auth-page` and `auth-head` stay: the e2e fixtures read the first to tell a sign-in build, and the reset page's done state hides
 * the sub-line through the second.
 */
export function AuthFrame({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-page">
        <header className="auth-head">
          <h1>{title}</h1>
          <p className="auth-sub">{sub}</p>
        </header>
        {children}
      </div>
      <nav className="auth-legal" aria-label="Privacy and terms">
        <Link href="/privacy/#accounts">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms/">Terms and copyright</Link>
      </nav>
    </div>
  );
}
