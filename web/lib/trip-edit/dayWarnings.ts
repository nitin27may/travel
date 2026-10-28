// The words a day's warnings take at rest in edit mode (edit-mode-spec 11.1; STEP2-E4 fills the status line, STEP2-E5 adds the one fix each).
// Two levels: To fix and To check (README 5.1). A code the level table does not know shows nothing rather than a guess, except the
// scheduler's own S_ notes (a fixed slot missed, a day over its cap), which read as To check, as the Move to day list does.
import { warnLevel } from '@travel/core/plan/warnings.ts';

export type Level = 'fix' | 'check';
export interface LevelLine {
  level: Level;
  /** "To fix" or "To check" */
  word: string;
  /** the first warning's message, a sentence */
  text: string;
  /** how many more of this level the day has */
  more: number;
}

export function levelOf(code: string): Level | null {
  const l = warnLevel(code);
  if (l === 'hidden') return null;
  return l ?? (code.startsWith('S_') ? 'check' : null);
}

/** One line per level present, Fix first. */
export function levelLines(ws: readonly { code: string; message: string }[]): LevelLine[] {
  const out: LevelLine[] = [];
  for (const level of ['fix', 'check'] as const) {
    const list = ws.filter((w) => levelOf(w.code) === level);
    if (list.length) out.push({ level, word: level === 'fix' ? 'To fix' : 'To check', text: list[0]!.message, more: list.length - 1 });
  }
  return out;
}
