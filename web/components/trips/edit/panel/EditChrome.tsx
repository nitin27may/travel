'use client';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { SyncWord } from '@/lib/trip-edit/open';
import { SyncState } from '../shell/StateBits';
import { WarnCount } from '../warnings/WarnCount';

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

/** The sticky day bar's right end from 640 px (patterns 3.13 item 4): Undo, Redo, the changes count, a sync that failed, Settings, then Done, the one filled button. */
export function EditTools(p: ToolsProps) {
  return (
    <div className="edit-tools" role="group" aria-label="Edit tools">
      <WarnCount />
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
      {/* the quiet sync words live in the cover meta (ER-022), so the tools fit beside the day strip more often; a sync that needs the
          person (not synced, Retry) stays here, where they are working (P6) */}
      {p.word.startsWith('Not synced') ? <SyncState word={p.word} onRetry={p.onRetry} /> : null}
      <Button onClick={p.onSettings}>Settings</Button>
      <Button variant="primary" onClick={p.onDone}>Done</Button>
    </div>
  );
}

interface BarProps {
  title: string;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  onUndo: () => void;
  onRedo: () => void;
  onSettings: () => void;
  onDone: () => void;
}

/** The phone's edit bar (components 8.6): Undo and Redo icon buttons, then Settings and Done. It replaces the public bottom bar. After the toast is gone a mistake is still one tap from undone (P3). */
export function EditBar(p: BarProps) {
  return (
    <div className="edit-bar" role="group" aria-label={`Editing ${p.title}`} data-print="hide">
      <Button icon variant="ghost" className="edit-bar-step" aria-label={p.undoLabel ? `Undo: ${p.undoLabel}` : 'Undo'} disabled={!p.canUndo} onClick={p.onUndo}>
        <Icon name="undo" size={20} />
      </Button>
      <Button icon variant="ghost" className="edit-bar-step" aria-label={p.redoLabel ? `Redo: ${p.redoLabel}` : 'Redo'} disabled={!p.canRedo} onClick={p.onRedo}>
        <Icon name="redo" size={20} />
      </Button>
      <Button size="lg" onClick={p.onSettings}>Settings</Button>
      <Button size="lg" variant="primary" onClick={p.onDone}>Done</Button>
    </div>
  );
}
