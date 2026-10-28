// The words of a warning as the page says them. Today it rewords one sentence: the scheduler's "Day 9 is 10 h 25 away from base, over 10 h for
// a standard family day" reads as a distance, not as how long the day is (ER-003). The rewrite lives here, not in the scheduler, so the public
// page and the edit blocks say it the same way; once the scheduler's own message is changed this function passes it through unchanged.

const DAY_CAP = /^(Day \d+) is (.+?) away from base, over (.+?) for an? (.+?) day\.(.*)$/s;

/** "Day 9 is 10 h 25 from leaving the base to getting back; a standard family day is 10 h." */
export function warnText(message: string): string {
  const m = DAY_CAP.exec(message);
  if (!m) return message;
  const [, day, away, cap, kind, rest] = m;
  return `${day} is ${away} from leaving the base to getting back; ${/^[aeiou]/i.test(kind!) ? 'an' : 'a'} ${kind} day is ${cap}.${rest}`;
}
