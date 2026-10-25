// The one glob form the seed contract uses: repository-relative paths, `*` matching any run of characters inside ONE path segment
// (never a `/`), no `**`, no braces. Pure.

const cache = new Map<string, RegExp>();

/** The pattern as an anchored regular expression. */
export function globRegExp(pattern: string): RegExp {
  let re = cache.get(pattern);
  if (!re) {
    const body = pattern
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join("[^/]*");
    re = new RegExp(`^${body}$`);
    cache.set(pattern, re);
  }
  return re;
}

/** True when the repository path matches the pattern. */
export const globMatch = (pattern: string, path: string): boolean => globRegExp(pattern).test(path);
