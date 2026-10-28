// The Mine page's data layer, loaded on demand by the shell (`import('@/lib/mine/data')`): it carries the core readers and their Zod
// schemas, which must not sit in the page's start chunk (budget: 200 KB gzipped at load, web/tests/budget.test.ts).
export { defaultTab, noticeDue, parseShow, pruneOrphanEdits, readOverview, snoozeNoticeNow } from './overview';
export { mineStorage } from './storage';
export { moveLegacyOnce } from './copies';
