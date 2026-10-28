// The operation behind renaming the trip (the Settings field and the cover's inline title edit): pure, so both say the same thing.
import type { PlanOp } from './model';
import type { Where } from './open';
import { newOpId } from './stopOps';

/**
 * `title` is the name now shown, `next` what the person typed. An empty name puts our trip's name back: a device copy keeps its name as the
 * copy's title, an account trip derives it (null). Null when nothing changes.
 */
export function renameOps(title: string, next: string, ourTitle: string | null, where: Where, newId: () => string = newOpId): { ops: PlanOp[]; label: string } | null {
  const name = next.trim();
  if (name === title) return null;
  const put = name === '' ? (where === 'device' ? ourTitle : null) : name;
  if (name === '' && put === title) return null;
  return {
    ops: [{ kind: 'setTitle', id: newId(), title: put }],
    label: put ? `Renamed the trip to ${put}` : `The trip is named ${ourTitle ?? 'as it was'} again`,
  };
}
