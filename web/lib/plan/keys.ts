/**
 * The builder's device keys and event (ISO-3; trip-builder 15.1). The one file that names them: every key starts `travel.plans.`
 * (web/tests/plan/isolation.test.ts G2). Literals, so the start chunk needs no schema code to read them.
 */
/** The device list of plan documents: `plan-drafts/1` (the same list EM-5 folds the copies into). */
export const PLANS_LOCAL_KEY = 'travel.plans.local';
/** The builder's own screen state (stage, filters, the draft being asked); UI only, never a document. */
export const PLANS_UI_KEY = 'travel.plans.ui';
/** Dispatched on `window` after the builder writes the list in this tab (the `storage` event covers other tabs). */
export const PLANS_CHANGED_EVENT = 'travel:plans-changed';
/** The schema words of the list and of a draft, as the core writes them (a unit test pins both). */
export const PLAN_DRAFTS_SCHEMA_ID = 'plan-drafts/1';
export const PLAN_DRAFT_SCHEMA_ID = 'plan-draft/1';
