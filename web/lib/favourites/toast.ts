/**
 * The words of the heart's toasts (mine-and-bar-spec 7). Never "saved" (visitor spec 3). Plain strings, so a test pins each one and the
 * heart and Mine's row share them. `ms` is the time the toast stays; 8 s for the first-save note and 6 s with an Undo (components 5.3).
 */
import { FAVOURITES_TOAST_TIMES } from '@/lib/config/product';
/** The device cap, written out: importing it from core would pull the schema (and Zod) into the heart's chunk. tests/favourites/toast.test.ts pins it to `FAVOURITES_CAP`. */
export const CAP = 500;
export const FIRST_TOAST: number = FAVOURITES_TOAST_TIMES.first;
export const UNDO_TOAST: number = FAVOURITES_TOAST_TIMES.undo;

export const added = (name: string): string => `Added ${name} to favourites`;
export const removed = (name: string): string => `Removed ${name} from favourites`;
/** The first favourite on a device. Sign-in on: the sentence before the Sign in link; off: the browser-only sentence. */
export const firstNote = (signIn: boolean): string => (signIn ? 'Added to favourites on this device. Sign in to keep them on every device.' : 'Added to favourites. They are kept in this browser.');
/** Just the Sign in link's sentence is the whole of `firstNote(true)`; the link follows it. */
export const FIRST_SIGN_IN_TEXT = 'Added to favourites on this device.';
export const FIRST_SIGN_IN_LINK = 'Sign in to keep them on every device.';
export const capReached = `You have ${CAP} favourites, the most we keep. Remove one to add another.`;
/** The memory list: it lasts until the visitor leaves this page, which is shorter than the spec's "until you close this tab" (UI-NOTES). */
export const sessionOnly = 'This browser is not keeping data, so this favourite lasts only until you leave this page.';
export const cannotChange = 'We could not change your favourites. Reload the page and try again.';
export const changedElsewhere = 'Your favourites changed in another tab. Try again.';
export const cannotRestore = (name: string): string => `Could not put ${name} back: you hearted it again or the list is full.`;
export const outOfSpace = 'This browser is out of space for this site, so nothing was written.';
