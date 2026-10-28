'use client';

// The `?` list of edit mode's keys, with the one setting that turns the single-letter ones off (patterns 1.3; WCAG 2.1.4).
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SideSheet } from '@/components/ui/SideSheet';
import { Switch } from '@/components/ui/Switch';
import { usePhone } from '../panel/useMatchMedia';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const ROWS: { keys: string[]; what: string }[] = [
  { keys: ['Space', 'Enter'], what: 'on a stop\'s handle: lift it, and drop it' },
  { keys: ['↑', '↓'], what: 'while lifted: move it within the day' },
  { keys: ['Page Up', 'Page Down'], what: 'while lifted: previous or next day' },
  { keys: ['Home', 'End'], what: 'while lifted: top or bottom of the day' },
  { keys: ['Esc'], what: 'while lifted: put it back' },
  { keys: ['Alt', '↑ ↓'], what: 'move a stop without lifting it' },
  { keys: [`${MOD} Z`, `${MOD} Shift Z`], what: 'undo, redo' },
];
const SINGLE: { keys: string[]; what: string }[] = [
  { keys: ['M'], what: 'on a stop: Move to day…' },
  { keys: ['S'], what: 'on a stop: Swap with…' },
  { keys: ['A'], what: 'on a day or a stop: add a place to that day' },
  { keys: ['Delete'], what: 'on a stop: remove it' },
  { keys: ['E'], what: 'finish editing' },
  { keys: ['?'], what: 'this list' },
];

function List({ rows, muted }: { rows: typeof ROWS; muted?: boolean }) {
  return (
    <dl className="keys-list" data-muted={muted || undefined}>
      {rows.map((r) => (
        <div key={r.what} className="keys-row">
          <dt>
            {r.keys.map((k, i) => (
              <span key={k}>{i ? ' or ' : ''}<kbd>{k}</kbd></span>
            ))}
          </dt>
          <dd>{r.what}</dd>
        </div>
      ))}
    </dl>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  single: boolean;
  onSingle: (on: boolean) => void;
}

export function KeysHelp({ open, onClose, single, onSingle }: Props) {
  const phone = usePhone();
  const change = (o: boolean) => {
    if (!o) onClose();
  };
  const body = (
    <div className="keys-help">
      <h3 className="keys-h">Move and undo</h3>
      <List rows={ROWS} />
      <h3 className="keys-h">Single letters</h3>
      <Switch checked={single} onCheckedChange={onSingle}>Single-letter shortcuts</Switch>
      <p className="edit-why">Turn these off if a letter key gets in the way of speech input or a switch device. Saved on this device.</p>
      <List rows={SINGLE} muted={!single} />
    </div>
  );
  const title = 'Keys in edit mode';
  return phone ? (
    <BottomSheet open={open} onOpenChange={change} title={title} snaps={['half', 'full']} initial="half" className="edit-sheet">{body}</BottomSheet>
  ) : (
    <SideSheet open={open} onOpenChange={change} title={title} className="edit-sheet">{body}</SideSheet>
  );
}
