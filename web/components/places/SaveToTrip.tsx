'use client';

import { useId, useState } from 'react';
import type { ExportFormat } from '@/components/actions/ExportMenu';
import { ExportMenuLazy as ExportMenu } from './ExportMenuLazy';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';

/**
 * "Save to a trip" for a visitor: the public site has no account, so the button opens a notice with Copy link and
 * the GPX export (patterns 3.6). Signed-in behaviour (the trip switcher) arrives with the planner.
 */
export function SaveToTrip({ url, slug, formats }: { url: string; slug: string; formats: ExportFormat[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: 'Link copied' });
    } catch {
      toast({ message: 'Could not copy the link' });
    }
  };
  return (
    <div className="pl-save">
      <Button variant="primary" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="plus" size={15} /> Save to a trip
      </Button>
      {open ? (
        <div id={id} className="pl-save-note" role="status">
          <p>Sign in to add this to a trip.</p>
          <p className="pl-save-actions">
            <Button size="sm" onClick={copy}>
              <Icon name="copy" size={13} /> Copy link
            </Button>
            {formats.length ? <ExportMenu target={{ type: 'place', slug }} formats={formats} /> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
