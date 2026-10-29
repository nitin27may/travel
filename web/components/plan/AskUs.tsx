'use client';

import { useEffect, useState } from 'react';

/** "Ask us for more" (FLOW F-Q1, L-R4): its own link, never inside a count button. Nothing is drawn while the feedback form is off. */
export function AskUs({ label = 'Ask us for more' }: { label?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void import('@/lib/client/data').then(({ reportProblem }) => reportProblem({ page: '/plan/' })).then((r) => {
      if (live && r.kind === 'link') setUrl(r.url);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!url) return null;
  return (
    <a className="plan-ask" href={url} target="_blank" rel="noopener noreferrer">
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
