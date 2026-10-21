'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { reportProblem } from '@/lib/client/data';

/** The anchor itself: nothing when there is no URL, so a switched-off report never leaves a dead link (P4). */
export function ReportAnchor({ url, children = 'Report a problem' }: { url: string | null; children?: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="report-link">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function useReportUrl(): string | null {
  const path = usePathname() ?? '/';
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void reportProblem({ page: path }).then((r) => {
      if (live) setUrl(r.kind === 'link' ? r.url : null);
    });
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

/** "Report a problem": the feedback form with the page path prefilled. Renders nothing while `reportUrl` is null. */
export function ReportLink({ joiner = false }: { joiner?: boolean }) {
  const url = useReportUrl();
  if (!url) return null;
  return (
    <>
      {joiner ? ' · ' : null}
      <ReportAnchor url={url} />
    </>
  );
}

/** The About page's list item for the same link, with a line saying what it is for. Nothing while the link is off. */
export function ReportAboutItem() {
  const url = useReportUrl();
  if (!url) return null;
  return (
    <li>
      <ReportAnchor url={url} />: a wrong fact, a broken link or a photo that does not belong. It opens a public form on GitHub with this page already filled in; please keep personal details out of it.
    </li>
  );
}
