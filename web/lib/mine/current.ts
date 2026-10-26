/**
 * Mine is the current item on its own page ("page") and in the account flow it holds ("true": same look, not the page itself). The
 * account routes are placeholders when sign-in is off, so Mine is not lit there. Lives here, not in the bar: `MineLink` (lazy) applies
 * it, so the route rules stay out of the start chunk.
 */
export function mineCurrent(path: string, signIn: boolean): 'page' | 'true' | undefined {
  if (path.startsWith('/mine/')) return 'page';
  return signIn && /^\/(account|sign-in|sign-up)\//.test(path) ? 'true' : undefined;
}
