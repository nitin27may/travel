// A visitor's copy, held in this browser only until they sign in (public-trips-dateless.md, "Picking dates").
// Kept deliberately small and in one place so the planner lane can read it on sign-in and then clear it.

export const DRAFT_KEY = 'travel:v1:copy-drafts';

export interface CopyDraft {
  slug: string;
  /** ISO date of Day 1. */
  start: string;
  adults: number;
  /** Ages of the children going. */
  children: number[];
  savedAt: string;
}

function read(): CopyDraft[] {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as CopyDraft[]) : [];
  } catch {
    return [];
  }
}

/** Saves (replacing an earlier draft of the same trip). Returns false when the browser refuses storage. */
export function saveDraft(d: Omit<CopyDraft, 'savedAt'>, now: Date = new Date()): boolean {
  try {
    const rest = read().filter((x) => x.slug !== d.slug);
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify([...rest, { ...d, savedAt: now.toISOString() }]));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(slug: string): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(read().filter((x) => x.slug !== slug)));
  } catch {
    /* storage unavailable: nothing to undo */
  }
}

export const listDrafts = read;
