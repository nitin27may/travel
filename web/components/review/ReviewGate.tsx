'use client';

import dynamic from 'next/dynamic';
import { EDITING } from './api';
import './review.css';

// In a build without NEXT_PUBLIC_EDITING=local the queue is never imported, so the public site carries none of it.
const ReviewApp = EDITING ? dynamic(() => import('./ReviewApp'), { loading: () => <p className="rv-note">Loading the review queue</p> }) : null;

export function ReviewGate() {
  if (!ReviewApp) {
    return (
      <div className="rv">
        <div className="page-head">
          <h1>Review</h1>
          <p className="lede">Review runs on the owner&apos;s machine. It reads proposals from the local server, so it is switched off in the published site.</p>
        </div>
      </div>
    );
  }
  return <ReviewApp />;
}
