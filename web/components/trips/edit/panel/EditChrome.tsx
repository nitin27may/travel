'use client';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { SyncWord } from '@/lib/trip-edit/open';
import { SyncState } from '../shell/StateBits';

interface ToolsProps {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  onUndo: () => void;
  onRedo: () => void;
  changes: number;
  onShowChanges: () => void;
  word: SyncWord;
  onRetry: (() => void) | null;
  onSettings: () => void;
  onDone: () => void;
}

/** The sticky day bar's right end from 640 px (patterns 3.13 item 4): Undo, Redo, the changes count, the sync word, Settings, then Done, the one filled button. */
export function EditTools(p: ToolsProps) {
  return (
    <div className="edit-tools" role="group" aria-label="Edit tools">
      <Button icon variant="ghost" aria-label={p.undoLabel ? `Undo: ${p.undoLabel}` : 'Undo'} disabled={!p.canUndo} onClick={p.onUndo}>
        <Icon name="undo" size={18} />
      </Button>
      <Button icon variant="ghost" aria-label={p.redoLabel ? `Redo: ${p.redoLabel}` : 'Redo'} disabled={!p.canRedo} onClick={p.onRedo}>
        <Icon name="redo" size={18} />
      </Button>
      {p.changes > 0 ? (
        <button type="button" className="edit-changes-btn num" onClick={p.onShowChanges}>
          {p.changes} {p.changes === 1 ? 'change' : 'changes'}
        </button>
      ) : null}
      <SyncState word={p.word} onRetry={p.onRetry} />
      <Button onClick={p.onSettings}>Settings</Button>
      <Button variant="primary" onClick={p.onDone}>Done</Button>
    </div>
  );
}

/** The phone's edit bar (components 8.6): Settings left, Done right, nothing else. It replaces the public bottom bar. */
export function EditBar({ title, onSettings, onDone }: { title: string; onSettings: () => void; onDone: () => void }) {
  return (
    <div className="edit-bar" role="group" aria-label={`Editing ${title}`} data-print="hide">
      <Button size="lg" onClick={onSettings}>Settings</Button>
      <Button size="lg" variant="primary" onClick={onDone}>Done</Button>
    </div>
  );
}
