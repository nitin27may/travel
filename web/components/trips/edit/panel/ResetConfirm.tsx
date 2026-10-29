'use client';

import { Button } from '@/components/ui/Button';

/**
 * The one confirm in edit mode that Reset to our plan keeps (patterns 4.4, ruling R7): inline and specific, Cancel first in the tab order,
 * the danger button last and named for what it does. Asked only above `PLAN_EDIT.resetConfirmOver` changes.
 */
export function ResetConfirm({ changes, ours, onCancel, onReset }: { changes: number; /** a converted trip: our trip's name, and the confirm says what replaces it */ ours?: string; onCancel: () => void; onReset: () => void }) {
  return (
    <div className="edit-confirm" role="alertdialog" aria-labelledby="edit-confirm-h">
      <p id="edit-confirm-h" className="edit-confirm-text">
        {ours !== undefined
          ? `Reset to our plan? This replaces your trip with a fresh copy of our ${ours || 'trip'} plan. Your changes are removed. You can undo this until you leave the page.`
          : `Reset to our plan? Your ${changes} changes are removed. You can undo this until you leave the page.`}
      </p>
      <div className="edit-confirm-foot">
        <Button onClick={onCancel} autoFocus>Cancel</Button>
        <Button variant="danger" onClick={onReset}>Reset</Button>
      </div>
    </div>
  );
}
