// The old browser-held draft of a copy. NAV-2 moved it: copies now live in the copies/1 envelope (lib/mine/copies.ts), and the old key
// is read once by the core's `moveLegacyCopies`. This file only names the old key for anything that still looks for it.
export { LEGACY_COPIES_KEY as DRAFT_KEY } from '@travel/core/schema/copies.ts';
export { removeById as removeCopyById, saveCopy } from '@/lib/mine/copies';
