'use client';

import { Button } from '@/components/ui/Button';

/**
 * The one confirm in edit mode that Reset to our plan keeps (patterns 4.4, ruling R7): inline and specific, Cancel first in the tab order,
 * the danger button last and named for what it does. Asked only above `PLAN_EDIT.resetConfirmOver` changes.
 */
export function ResetConfirm({ changes, onCancel, onReset }: { changes: number; onCancel: () => void; onReset: () => void }) {
  return (
    <div className="edit-confirm" role="alertdialog" aria-labelledby="edit-confirm-h">
      <p id="edit-confirm-h" className="edit-confirm-text">
        Reset to our plan? Your {changes} changes are removed. You can undo this until you leave the page.
      </p>
      <div className="edit-confirm-foot">
        <Button onClick={onCancel} autoFocus>Cancel</Button>
        <Button variant="danger" onClick={onReset}>Reset</Button>
      </div>
    </div>
  );
}
